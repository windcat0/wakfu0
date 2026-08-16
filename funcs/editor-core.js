// ============================================================
//  editor-core.js — 多标签在线编辑器核心引擎
//  「透明 textarea + 高亮镜像层 + 行号栏」架构：
//    - 多标签页：每个标签独立内容 / 模式 / 视图 / 文件名 / 未保存标记
//    - 本地文件关联（File System Access API）：打开的文件可 Ctrl+S
//      直接写回磁盘；句柄存 IndexedDB，刷新后仍可继续保存；
//      不支持的浏览器自动回退为「上传 + 下载副本」
//    - JSON / Markdown 编辑期语法高亮（内置 tokenizer，零依赖）
//    - 搜索替换：正则 / 大小写 / 全部高亮 / 逐个跳转 / 全部替换
//  Markdown 渲染与 mermaid/highlight.js 集成在 editor-md.js 中注册。
// ============================================================
(function () {
  'use strict';

  var ED = window.ED = {
    mode: 'md',            // 当前标签的显示状态（切标签时同步）
    view: 'split',
    tabs: [],              // {id, name, mode, view, content, saved, dirty, handle}
    activeTab: 0,
    tocOn: true,           // 文档大纲开关
    samples: { json: '', md: '' },
    mdRender: null,        // 由 editor-md.js 注入
    renderPreview: null,
    _t: {}
  };

  var tabSeq = 0;

  var $ = function (sel) { return document.querySelector(sel); };

  var el = {};

  var LINE_H = 21; // 与 CSS --ed-font 的行高一致

  var search = {
    open: false, find: '',
    caseSensitive: false, regex: false,
    matches: [], cur: -1, badRegex: false
  };

  // ================= 基础工具 =================
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function nowTime() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function showMsg(type, html) {
    el.msgbar.className = 'msgbar show ' + type;
    el.msgbar.innerHTML = html;
  }
  function clearMsg() {
    el.msgbar.className = 'msgbar';
    el.msgbar.innerHTML = '';
  }
  ED.showMsg = showMsg;
  ED.clearMsg = clearMsg;

  // 保留撤销栈的文本替换（execCommand 不可用时回退 setRangeText）
  function replaceRange(start, end, text) {
    var ta = el.editor;
    ta.focus();
    ta.setSelectionRange(start, end);
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, start, end, 'end');
      onContentChanged();
    }
    return ok;
  }

  function setContent(text) {
    replaceRange(0, el.editor.value.length, text);
  }

  // ================= Tokenizer：JSON =================
  var JSON_RE = /"(?:[^"\\\r\n]|\\.)*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b|[{}[\],:]/g;

  function tokenizeJSON(text) {
    var out = [], m;
    JSON_RE.lastIndex = 0;
    while ((m = JSON_RE.exec(text)) !== null) {
      var t = m[0], cls;
      if (t.charAt(0) === '"') {
        cls = /^\s*:/.test(text.slice(m.index + t.length)) ? 'tok-key' : 'tok-str';
      } else if (t === 'true' || t === 'false') cls = 'tok-bool';
      else if (t === 'null') cls = 'tok-null';
      else if (/^[-\d]/.test(t)) cls = 'tok-num';
      else cls = 'tok-punct';
      out.push({ s: m.index, e: m.index + t.length, cls: cls });
    }
    return out;
  }

  // ================= Tokenizer：Markdown =================
  var INLINE_SRC = '`[^`\\n]+`|\\*\\*[^*\\n]+\\*\\*|\\*[^*\\s][^*\\n]*?\\*|~~[^~\\n]+~~|!?\\[[^\\]\\n]*\\]\\([^)\\s]*\\)';

  function pushInline(out, str, base) {
    var re = new RegExp(INLINE_SRC, 'g'), m;
    while ((m = re.exec(str)) !== null) {
      var t = m[0], c0 = t.charAt(0), cls;
      if (c0 === '`') cls = 'md-code';
      else if (t.indexOf('**') === 0) cls = 'md-b';
      else if (c0 === '~') cls = 'md-del';
      else if (c0 === '[' || c0 === '!') cls = 'md-link';
      else cls = 'md-i';
      out.push({ s: base + m.index, e: base + m.index + t.length, cls: cls });
    }
  }

  function tokenizeMD(text) {
    var out = [];
    var lines = text.split('\n');
    var off = 0, fence = false, m;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var s = off, e = off + line.length;
      if (/^\s{0,3}```/.test(line)) {
        out.push({ s: s, e: e, cls: 'md-fence' });
        fence = !fence;
      } else if (fence) {
        out.push({ s: s, e: e, cls: 'md-code' });
      } else if ((m = line.match(/^\s{0,3}(#{1,6})(\s|$)/))) {
        out.push({ s: s, e: e, cls: m[1].length === 1 ? 'md-h md-h1' : 'md-h' });
      } else if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
        out.push({ s: s, e: e, cls: 'md-hr' });
      } else if (/^\s{0,3}>/.test(line)) {
        m = line.match(/^\s{0,3}(>+)/);
        out.push({ s: s, e: s + m[0].length, cls: 'md-quote' });
        pushInline(out, line.slice(m[0].length), s + m[0].length);
      } else if ((m = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)/))) {
        out.push({ s: s + m[1].length, e: s + m[1].length + m[2].length, cls: 'md-li' });
        pushInline(out, line.slice(m[0].length), s + m[0].length);
      } else {
        pushInline(out, line, s);
      }
      off = e + 1;
    }
    return out;
  }

  ED._t.tokenizeJSON = tokenizeJSON;
  ED._t.tokenizeMD = tokenizeMD;

  // ================= 镜像渲染 =================
  function buildMirrorHtml(text, tokens, matches, curIdx) {
    var marks = [];
    for (var i = 0; i < matches.length; i++) {
      if (matches[i][1] > matches[i][0]) marks.push({ s: matches[i][0], e: matches[i][1], cur: i === curIdx });
    }

    var pts = [0, text.length];
    var k;
    for (k = 0; k < tokens.length; k++) { pts.push(tokens[k].s, tokens[k].e); }
    for (k = 0; k < marks.length; k++) { pts.push(marks[k].s, marks[k].e); }
    pts.sort(function (a, b) { return a - b; });

    var html = '';
    var ti = 0, mi = 0;
    var i2 = 0;
    while (i2 < pts.length - 1) {
      var a = pts[i2];
      var j = i2 + 1;
      while (j < pts.length && pts[j] === a) j++;
      if (j >= pts.length) break;
      var b = pts[j];
      i2 = j;
      if (b <= a) continue;

      while (ti < tokens.length && tokens[ti].e <= a) ti++;
      var tok = (ti < tokens.length && tokens[ti].s <= a && tokens[ti].e >= b) ? tokens[ti].cls : '';

      while (mi < marks.length && marks[mi].e <= a) mi++;
      var mk = '';
      if (mi < marks.length && marks[mi].s <= a && marks[mi].e >= b) {
        mk = marks[mi].cur ? 'm-cur' : 'm-all';
      }

      var cls = mk ? (mk + ' ' + tok) : tok;
      html += cls ? '<span class="' + cls + '">' + esc(text.slice(a, b)) + '</span>'
        : esc(text.slice(a, b));
    }
    return html + '\n';
  }

  function tokenize(text) {
    if (text.length > 300000) return [];
    return ED.mode === 'json' ? tokenizeJSON(text) : tokenizeMD(text);
  }

  function renderMirror() {
    var text = el.editor.value;
    var marks = search.open ? search.matches : [];
    el.hlCode.innerHTML = buildMirrorHtml(text, tokenize(text), marks, search.cur);
  }

  function renderGutter() {
    var text = el.editor.value;
    var total = text.split('\n').length;
    var curLine = text.slice(0, el.editor.selectionStart).split('\n').length;
    var html = '';
    for (var i = 1; i <= total; i++) {
      html += i === curLine ? '<span class="cur-line-no">' + i + '</span>' : i;
      if (i < total) html += '\n';
    }
    el.gutter.innerHTML = html;
  }

  function updateStatus() {
    var text = el.editor.value;
    var pos = el.editor.selectionStart;
    var before = text.slice(0, pos);
    el.stLn.textContent = before.split('\n').length;
    el.stCol.textContent = pos - before.lastIndexOf('\n');
    el.stChars.textContent = text.length;
    el.stBytes.textContent = new TextEncoder().encode(text).length;
    el.stLines.textContent = text.split('\n').length;
  }

  function syncScroll() {
    var ta = el.editor;
    el.hlPre.scrollTop = ta.scrollTop;
    el.hlPre.scrollLeft = ta.scrollLeft;
    el.gutter.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
    if (ED.mode === 'md' && ED.view === 'split') {
      var max = ta.scrollHeight - ta.clientHeight;
      var ratio = max > 0 ? ta.scrollTop / max : 0;
      var pvMax = el.preview.scrollHeight - el.preview.clientHeight;
      if (pvMax > 0) el.preview.scrollTop = ratio * pvMax;
    }
    updateTocActive();
  }

  // ================= 搜索 / 替换 =================
  function findRegex() {
    if (!search.find) return null;
    var src = search.regex ? search.find : search.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return new RegExp(src, search.caseSensitive ? 'g' : 'gi');
    } catch (e) {
      return null;
    }
  }

  function refreshMatches(keepCur) {
    search.badRegex = false;
    search.matches = [];
    if (!search.open || !search.find) {
      search.cur = -1;
      updateCountUI();
      renderMirror();
      return;
    }
    var re = findRegex();
    if (!re) {
      search.badRegex = true;
      search.cur = -1;
      updateCountUI();
      renderMirror();
      return;
    }
    var text = el.editor.value;
    var m, guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 20000) {
      search.matches.push([m.index, m.index + m[0].length]);
      if (m[0] === '') re.lastIndex++;
    }
    if (!keepCur) search.cur = search.matches.length ? 0 : -1;
    else if (search.cur >= search.matches.length) search.cur = search.matches.length - 1;
    updateCountUI();
    renderMirror();
  }

  function updateCountUI() {
    el.findInput.classList.toggle('bad', search.badRegex);
    if (search.badRegex) {
      el.matchCount.innerHTML = '<span style="color:var(--red)">正则错误</span>';
    } else if (!search.find) {
      el.matchCount.textContent = '–';
    } else if (!search.matches.length) {
      el.matchCount.textContent = '无结果';
    } else {
      el.matchCount.innerHTML = '<span class="cur">' + (search.cur + 1) + '</span>/' + search.matches.length;
    }
  }

  function scrollToPos(pos) {
    var ta = el.editor;
    var line = ta.value.slice(0, pos).split('\n').length - 1;
    ta.scrollTop = Math.max(0, line * LINE_H + 12 - ta.clientHeight / 2);
    syncScroll();
  }

  function gotoMatch(idx) {
    if (!search.matches.length) return;
    search.cur = ((idx % search.matches.length) + search.matches.length) % search.matches.length;
    var m = search.matches[search.cur];
    el.editor.focus();
    el.editor.setSelectionRange(m[0], m[1]);
    scrollToPos(m[0]);
    updateCountUI();
    renderMirror();
  }

  function nextMatch() { gotoMatch(search.cur + 1); }
  function prevMatch() { gotoMatch(search.cur - 1); }

  function applyReplacement(matchedText) {
    var rep = el.replaceInput.value;
    if (!search.regex) return rep;
    var single = findRegex();
    if (!single) return rep;
    single.lastIndex = 0;
    return matchedText.replace(single, rep);
  }

  function replaceOne() {
    var m = search.matches[search.cur];
    if (!m) return;
    var text = el.editor.value;
    var rep = applyReplacement(text.slice(m[0], m[1]));
    replaceRange(m[0], m[1], rep);
    refreshMatches(true);
    if (search.matches.length) gotoMatch(Math.min(search.cur, search.matches.length - 1));
    else updateCountUI();
  }

  function replaceAllMatches() {
    if (!search.matches.length) { showMsg('ok', '没有可替换的内容'); return; }
    var text = el.editor.value;
    var count = 0;
    var res = '', last = 0;
    for (var i = 0; i < search.matches.length; i++) {
      var m = search.matches[i];
      res += text.slice(last, m[0]) + applyReplacement(text.slice(m[0], m[1]));
      last = m[1];
      count++;
    }
    res += text.slice(last);
    setContent(res);
    refreshMatches(true);
    showMsg('ok', '✓ 已替换 ' + count + ' 处');
    setTimeout(clearMsg, 2500);
  }

  function openSearch(focusReplace) {
    search.open = true;
    el.searchbar.classList.add('show');
    var sel = el.editor.value.slice(el.editor.selectionStart, el.editor.selectionEnd);
    if (sel && sel.length <= 80 && sel.indexOf('\n') === -1 && !el.findInput.value) {
      el.findInput.value = sel;
    }
    search.find = el.findInput.value;
    refreshMatches(false);
    if (search.matches.length) scrollToPos(search.matches[0][0]);
    (focusReplace ? el.replaceInput : el.findInput).focus();
    (focusReplace ? el.replaceInput : el.findInput).select();
  }

  function closeSearch() {
    search.open = false;
    search.matches = [];
    search.cur = -1;
    el.searchbar.classList.remove('show');
    updateCountUI();
    renderMirror();
    el.editor.focus();
  }

  // ================= JSON 动作 =================
  function parseJSON(text) {
    try {
      return { ok: true, val: JSON.parse(text) };
    } catch (e) {
      var msg = (e && e.message) || String(e);
      var line = 0, col = 0, abs = -1;
      var m = String(msg).match(/position (\d+)/);
      if (m) {
        abs = parseInt(m[1], 10);
        var before = text.slice(0, abs);
        line = before.split('\n').length;
        col = abs - before.lastIndexOf('\n');
      } else if ((m = String(msg).match(/line (\d+) column (\d+)/))) {
        line = parseInt(m[1], 10);
        col = parseInt(m[2], 10);
        var idx = 0, li = 1;
        while (li < line && idx !== -1) { idx = text.indexOf('\n', idx) + 1; li++; }
        abs = (idx > 0 ? idx : 0) + col - 1;
      } else if ((m = String(msg).match(/\.\.\.([\s\S]*?)"\s*is not valid JSON$/))) {
        // 新版 V8：...源码片段(可含引号/换行)" is not valid JSON
        var snippet = m[1];
        var at = text.lastIndexOf(snippet);
        if (at !== -1) {
          abs = at + snippet.length;
          var before2 = text.slice(0, abs);
          line = before2.split('\n').length;
          col = abs - before2.lastIndexOf('\n');
        }
      }
      return { ok: false, msg: msg, line: line, col: col, abs: abs };
    }
  }

  function jsonErrorHtml(r) {
    var html = '✕ JSON 解析失败：' + esc(r.msg);
    if (r.line) html += '（约第 ' + r.line + ' 行第 ' + r.col + ' 列）';
    if (r.abs >= 0) html += ' <button class="link-btn" data-goto="' + r.abs + '">📍 定位</button>';
    return html;
  }

  function bindMsgGoto() {
    var btn = el.msgbar.querySelector('[data-goto]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var pos = parseInt(this.getAttribute('data-goto'), 10);
      el.editor.focus();
      el.editor.setSelectionRange(pos, pos + 1);
      scrollToPos(pos);
    });
  }

  function jsonAction(kind) {
    var text = el.editor.value;
    if (kind !== 'validate' && !text.trim()) { showMsg('err', '内容为空'); return; }
    var r = parseJSON(text);
    if (!r.ok) {
      showMsg('err', jsonErrorHtml(r));
      bindMsgGoto();
      return;
    }
    if (kind === 'validate') {
      var kindName = Array.isArray(r.val) ? '数组（' + r.val.length + ' 项）'
        : (r.val && typeof r.val === 'object') ? '对象（' + Object.keys(r.val).length + ' 个键）' : typeof r.val;
      showMsg('ok', '✓ JSON 有效，顶层类型：' + kindName);
      setTimeout(clearMsg, 2500);
      return;
    }
    setContent(kind === 'minify' ? JSON.stringify(r.val) : JSON.stringify(r.val, null, 2));
    showMsg('ok', kind === 'minify' ? '✓ 已压缩为单行' : '✓ 已格式化（缩进 2 空格）');
    setTimeout(clearMsg, 2000);
  }

  // ================= 标签页模型 =================
  function curTab() { return ED.tabs[ED.activeTab]; }

  function mkTab(opts) {
    tabSeq++;
    var mode = opts.mode || 'md';
    return {
      id: tabSeq,
      name: opts.name || ('未命名-' + tabSeq + (mode === 'json' ? '.json' : '.md')),
      mode: mode,
      view: opts.view || (mode === 'json' ? 'edit' : 'split'),
      content: opts.content || '',
      saved: opts.content || '',
      dirty: false,
      handle: opts.handle || null,
      _d: false // 上次渲染时的脏标记
    };
  }

  function renderTabs() {
    var html = ED.tabs.map(function (t, i) {
      var tip = t.name + (t.handle ? '（已关联本地文件，Ctrl+S 直接写回）' : '');
      return '<div class="tab' + (i === ED.activeTab ? ' on' : '') + '" data-i="' + i + '" title="' + esc(tip) + '">' +
        '<span class="t-ico">' + (t.mode === 'json' ? '🧾' : '📝') + '</span>' +
        '<span class="t-name">' + esc(t.name) + '</span>' +
        (t.dirty ? '<span class="t-dirty" title="未保存">●</span>' : '') +
        '<span class="t-close" title="关闭标签页">✕</span>' +
        '</div>';
    }).join('');
    el.tabbar.innerHTML = html + '<div class="tab tab-new" title="新建标签页">＋</div>';
  }

  function syncFromTab(t) {
    ED.mode = t.mode;
    ED.view = t.view;
    applyMode();
  }

  function switchTab(i) {
    if (i < 0 || i >= ED.tabs.length || i === ED.activeTab) return;
    var t0 = curTab();
    if (t0) t0.content = el.editor.value;
    ED.activeTab = i;
    var t = curTab();
    el.editor.value = t.content || '';
    closeSearch();
    clearMsg();
    syncFromTab(t);
    renderTabs();
    onContentChanged();
    el.editor.focus();
    saveSoon();
  }

  function newTab(mode, content, name, handle) {
    var t = mkTab({ mode: mode, content: content, name: name, handle: handle });
    var t0 = curTab();
    if (t0) t0.content = el.editor.value;
    t.saved = content || '';
    ED.tabs.push(t);
    ED.activeTab = ED.tabs.length - 1;
    el.editor.value = t.content || '';
    clearMsg();
    syncFromTab(t);
    renderTabs();
    onContentChanged();
    el.editor.focus();
    saveSoon();
    return t;
  }

  function closeTab(i) {
    var t = ED.tabs[i];
    if (!t) return;
    if (t.dirty && !window.confirm('「' + t.name + '」有未保存的修改，确定关闭？')) return;
    idb.del('h' + t.id);
    ED.tabs.splice(i, 1);
    if (!ED.tabs.length) {
      ED.tabs.push(mkTab({ mode: 'md', content: '' }));
      ED.activeTab = 0;
      el.editor.value = '';
    } else if (ED.activeTab >= ED.tabs.length) {
      ED.activeTab = ED.tabs.length - 1;
    } else if (ED.activeTab === i) {
      ED.activeTab = Math.min(i, ED.tabs.length - 1);
    } else if (ED.activeTab > i) {
      ED.activeTab--;
    }
    var t2 = curTab();
    el.editor.value = t2.content || '';
    clearMsg();
    syncFromTab(t2);
    renderTabs();
    onContentChanged();
    saveState();
    el.editor.focus();
  }

  // 双击标签名 → 行内重命名（扩展名联动模式）
  function startRename(span, t) {
    span.contentEditable = 'true';
    span.focus();
    try {
      var r = document.createRange();
      r.selectNodeContents(span);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (e) { }

    function commit() {
      span.contentEditable = 'false';
      var name = span.textContent.trim().replace(/[\\/:*?"<>|]/g, '_');
      if (name) t.name = name;
      if (/\.json$/i.test(name)) t.mode = 'json';
      else if (/\.(md|markdown|txt|mmd|mermaid)$/i.test(name)) t.mode = 'md';
      if (curTab() === t) syncFromTab(t);
      renderTabs();
      saveSoon();
    }
    span.addEventListener('blur', commit, { once: true });
    span.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
      if (e.key === 'Escape') { span.textContent = t.name; span.blur(); }
    });
  }

  // ================= 本地文件关联（File System Access） =================
  function hasFSA() {
    return typeof window.showOpenFilePicker === 'function' &&
      typeof window.showSaveFilePicker === 'function';
  }

  // 文件选择器不限制类型：任意文件均可打开，由 guessMode 自动识别
  // （保存时也不带 types，避免自定义文件名触发扩展名校验）

  function guessMode(name, content) {
    var ext = (String(name || '').match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
    if (ext === 'json' || ext === 'geojson' || ext === 'jsonl') return 'json';
    if (['md', 'markdown', 'mdown', 'mkd', 'txt', 'text', 'mmd', 'mermaid',
      'log', 'yml', 'yaml', 'csv', 'tsv', 'xml', 'html', 'htm', 'ini', 'conf'].indexOf(ext) !== -1) return 'md';
    // 无扩展名 / 未知扩展名：按内容嗅探
    var s = String(content || '').trim();
    if (!s) return 'md';
    if (s.charAt(0) === '{' || s.charAt(0) === '[') {
      try { JSON.parse(s); return 'json'; } catch (e) { /* 不是合法 JSON，继续判断 */ }
    }
    // Markdown 结构信号：标题 / 围栏 / 列表 / 引用 / 强调 / 链接 / 表格
    if (/^#{1,6}\s+\S|^\s{0,3}```|^\s{0,3}[-*+]\s+\S|^\s{0,3}\d+\.\s+\S|^>\s|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|(?:^\|.+\|\s*$)/m.test(s)) {
      return 'md';
    }
    return 'md';
  }

  function ensureWritePermission(handle) {
    return handle.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p === 'granted') return true;
      return handle.requestPermission({ mode: 'readwrite' }).then(function (p2) {
        return p2 === 'granted';
      });
    });
  }

  function writeToHandle(handle, text) {
    return handle.createWritable().then(function (w) {
      return w.write(new Blob([text], { type: 'text/plain' })).then(function () {
        return w.close();
      });
    });
  }

  function markSaved(t, note) {
    t.saved = t.content;
    t.dirty = false;
    renderTabs();
    showMsg('ok', note);
    setTimeout(clearMsg, 2200);
    saveState();
  }

  // 智能保存：已关联 → 写回文件；未关联且有 FSA → 选位置并关联；否则下载副本
  function saveTab() {
    var t = curTab();
    if (!t) return;
    t.content = el.editor.value;
    if (!t.content) { showMsg('err', '内容为空，无需保存'); return; }

    if (t.handle) {
      ensureWritePermission(t.handle).then(function (ok) {
        if (!ok) { showMsg('err', '没有该文件的写入权限，请重新「打开」一次'); return; }
        return writeToHandle(t.handle, t.content).then(function () {
          markSaved(t, '✓ 已保存到本地文件「' + esc(t.name) + '」');
        });
      }).catch(function (e) {
        showMsg('err', '保存失败：' + esc(e && e.message || String(e)));
      });
      return;
    }

    if (hasFSA()) {
      window.showSaveFilePicker({ suggestedName: t.name })
        .then(function (handle) {
          t.handle = handle;
          t.name = handle.name || t.name;
          idb.set('h' + t.id, handle);
          renderTabs();
          return writeToHandle(handle, t.content).then(function () {
            markSaved(t, '✓ 已保存并关联本地文件「' + esc(t.name) + '」');
          });
        })
        .catch(function (e) {
          if (e && e.name === 'AbortError') return; // 用户取消
          blobDownload(t);
        });
      return;
    }

    blobDownload(t);
  }

  function blobDownload(t) {
    var blob = new Blob([t.content], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.download = t.name || 'untitled.md';
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    t.saved = t.content;
    t.dirty = false;
    renderTabs();
    showMsg('ok', '✓ 已下载「' + esc(a.download) + '」（当前浏览器不支持文件关联）');
    setTimeout(clearMsg, 2600);
  }

  function openViaFSA() {
    window.showOpenFilePicker({ multiple: true })
      .then(function (handles) {
        var chain = Promise.resolve();
        var last = null;
        handles.forEach(function (h) {
          chain = chain.then(function () {
            return h.getFile().then(function (f) {
              return f.text().then(function (text) {
                last = newTab(guessMode(f.name, text), text, f.name, h);
              });
            });
          });
        });
        return chain;
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        showMsg('err', '打开失败：' + esc(e && e.message || String(e)));
      });
  }

  function openFiles() {
    if (hasFSA()) { openViaFSA(); return; }
    el.fileInput.click();
  }

  function handleDroppedItems(items) {
    var list = Array.prototype.slice.call(items || []);
    if (!list.length) return;
    var chain = Promise.resolve();
    list.forEach(function (item) {
      if (item.kind !== 'file') return;
      chain = chain.then(function () {
        // 图片：插入当前 Markdown（当前标签是 md 时），否则按文件打开
        var imgFile = item.getAsFile && item.getAsFile();
        if (imgFile && /^image\//.test(imgFile.type) && curTab() && curTab().mode === 'md') {
          insertImageFile(imgFile);
          return;
        }
        if (typeof item.getAsFileSystemHandle === 'function') {
          return item.getAsFileSystemHandle().then(function (h) {
            if (!h || h.kind !== 'file') return;
            return h.getFile().then(function (f) {
              if (/^image\//.test(f.type) && curTab() && curTab().mode === 'md') {
                insertImageFile(f);
                return;
              }
              return f.text().then(function (text) {
                newTab(guessMode(f.name, text), text, f.name, h);
              });
            });
          }).catch(function () { });
        }
        var f = item.getAsFile();
        if (f) {
          return f.text().then(function (text) {
            newTab(guessMode(f.name, text), text, f.name, null);
          });
        }
      });
    });
  }

  // ================= IndexedDB（文件句柄持久化） =================
  var idb = {
    _p: null,
    open: function () {
      if (this._p) return this._p;
      this._p = new Promise(function (resolve) {
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 2000);
        function finish(v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } }
        try {
          var req = indexedDB.open('wakfu-editor', 1);
          req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
          req.onsuccess = function () { finish(req.result); };
          req.onerror = function () { finish(null); };
          req.onblocked = function () { finish(null); };
        } catch (e) { finish(null); }
      });
      return this._p;
    },
    set: function (k, v) {
      return this.open().then(function (db) {
        if (!db) return;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv').put(v, k);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { resolve(); };
          } catch (e) { resolve(); }
        });
      });
    },
    get: function (k) {
      return this.open().then(function (db) {
        if (!db) return null;
        return new Promise(function (resolve) {
          try {
            var rq = db.transaction('kv', 'readonly').objectStore('kv').get(k);
            rq.onsuccess = function () { resolve(rq.result || null); };
            rq.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        });
      });
    },
    del: function (k) {
      return this.open().then(function (db) {
        if (!db) return;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv')['delete'](k);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { resolve(); };
          } catch (e) { resolve(); }
        });
      });
    }
  };

  // ================= 自动保存（v2：多标签） =================
  var K1 = 'wakfu:editor:v1';
  var K2 = 'wakfu:editor:v2';

  // 存储可用性一次性探测：file:// 或隐私拦截下静默降级，避免反复触发浏览器报错
  var storageOK = (function () {
    try {
      localStorage.setItem('__wakfu_probe', '1');
      localStorage.removeItem('__wakfu_probe');
      return true;
    } catch (e) { return false; }
  })();

  function saveState() {
    if (!storageOK) return;
    try {
      var t = curTab();
      if (t) t.content = el.editor.value;
      localStorage.setItem(K2, JSON.stringify({
        v: 2,
        active: ED.activeTab,
        tocOn: ED.tocOn,
        tabs: ED.tabs.map(function (x) {
          return { id: x.id, name: x.name, mode: x.mode, view: x.view, content: x.content, dirty: x.dirty };
        })
      }));
      el.stSave.textContent = '已自动保存 ' + nowTime();
    } catch (e) { }
  }
  var saveSoon = debounce(saveState, 700);

  function restoreTabs() {
    var data = null;
    if (!storageOK) data = null;
    else { try { data = JSON.parse(localStorage.getItem(K2) || 'null'); } catch (e) { } }
    if (data && data.v === 2 && Array.isArray(data.tabs) && data.tabs.length) {
      ED.tocOn = data.tocOn !== false;
      ED.tabs = data.tabs.map(function (t) {
        return {
          id: t.id || (++tabSeq),
          name: t.name || '未命名.md',
          mode: t.mode === 'json' ? 'json' : 'md',
          view: ['edit', 'split', 'preview'].indexOf(t.view) !== -1 ? t.view : 'split',
          content: t.content || '',
          saved: t.content || '',
          dirty: false,
          handle: null,
          _d: false
        };
      });
      ED.tabs.forEach(function (t) { if (t.id > tabSeq) tabSeq = t.id; });
      ED.activeTab = Math.min(Math.max(0, data.active | 0), ED.tabs.length - 1);
      // 恢复文件关联句柄（持久化在 IndexedDB 中，首次保存时重新请求权限）
      idb.open().then(function (db) {
        if (!db) return;
        ED.tabs.forEach(function (t) {
          idb.get('h' + t.id).then(function (h) {
            if (h && h.kind === 'file') { t.handle = h; renderTabs(); }
          });
        });
      });
      return;
    }
    // v1 迁移：单缓冲 → 标签
    var v1 = null;
    if (storageOK) { try { v1 = JSON.parse(localStorage.getItem(K1) || 'null'); } catch (e) { } }
    if (v1 && (v1.md || v1.json)) {
      ED.tabs = [];
      if (v1.md && v1.md.trim()) {
        var tm = mkTab({ mode: 'md', content: v1.md, name: '未命名.md' });
        ED.tabs.push(tm);
      }
      if (v1.json && v1.json.trim()) {
        var tj = mkTab({ mode: 'json', content: v1.json, name: 'config.json' });
        ED.tabs.push(tj);
      }
      if (ED.tabs.length) {
        ED.activeTab = v1.mode === 'json' && ED.tabs.length > 1 ? 1 : 0;
        return;
      }
    }
    ED.tabs = [mkTab({ mode: 'md', content: ED.samples.md, name: '示例.md' })];
    ED.activeTab = 0;
  }

  // ================= 文档大纲（TOC） =================
  var tocHeadings = []; // {level, text, line}
  var renderTocSoon = debounce(renderToc, 400);

  function parseHeadings(text) {
    var out = [];
    var lines = text.split('\n');
    var fence = false, m;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s{0,3}```/.test(line)) { fence = !fence; continue; }
      if (fence) continue;
      if ((m = line.match(/^ {0,3}(#{1,6})\s+(.*)$/))) {
        out.push({
          level: m[1].length,
          text: m[2].replace(/[`*~_]+/g, '').trim(),
          line: i
        });
      }
    }
    return out;
  }

  function renderToc() {
    if (!el.tocBody) return;
    var t = curTab();
    var show = ED.tocOn && t && t.mode === 'md';
    el.tocPanel.hidden = !show;
    if (el.btnToc) el.btnToc.classList.toggle('on', !!show);
    if (!show) { tocHeadings = []; return; }
    tocHeadings = parseHeadings(el.editor.value);
    if (!tocHeadings.length) {
      el.tocBody.innerHTML = '<div class="toc-empty">暂无标题<br>用 # 开始一行即可创建标题</div>';
      return;
    }
    el.tocBody.innerHTML = tocHeadings.map(function (h, i) {
      return '<button class="toc-item" data-i="' + i + '" style="padding-left:' + (10 + (h.level - 1) * 12) + 'px" title="' +
        esc(h.text) + '">' + esc(h.text || '(空标题)') + '</button>';
    }).join('');
  }

  function tocJump(idx) {
    var h = tocHeadings[idx];
    if (!h) return;
    var text = el.editor.value;
    var pos = 0;
    for (var i = 0; i < h.line; i++) pos = text.indexOf('\n', pos) + 1;
    if (ED.view !== 'preview') {
      el.editor.focus();
      el.editor.setSelectionRange(pos, pos);
      scrollToPos(pos);
    }
    // 预览区同步定位到对应标题
    var hd = el.preview.querySelector('#hd-' + idx);
    if (hd) el.preview.scrollTop = hd.offsetTop - 12;
    updateTocActive(idx);
  }

  function updateTocActive(forceIdx) {
    if (!tocHeadings.length || el.tocPanel.hidden) return;
    var idx = forceIdx;
    if (idx === undefined) {
      var firstLine = Math.round(el.editor.scrollTop / LINE_H) + 1;
      idx = -1;
      for (var i = 0; i < tocHeadings.length; i++) {
        if (tocHeadings[i].line + 1 <= firstLine + 2) idx = i;
        else break;
      }
      if (idx === -1) idx = 0;
    }
    var items = el.tocBody.children;
    for (var k = 0; k < items.length; k++) {
      items[k].classList.toggle('on', k === idx);
    }
    var cur = items[idx];
    if (cur) {
      var bodyRect = el.tocBody.getBoundingClientRect();
      var r = cur.getBoundingClientRect();
      if (r.top < bodyRect.top || r.bottom > bodyRect.bottom) {
        cur.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function setToc(on) {
    ED.tocOn = !!on;
    renderToc();
    updateTocActive(0);
    saveSoon();
  }

  // ================= 主题（亮 / 暗） =================
  var THEME_KEY = 'wakfu:editor:theme';

  function applyTheme(dark) {
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (el.btnTheme) el.btnTheme.textContent = dark ? '☀️' : '🌙';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#211e1a' : '#c75b39');
    if (typeof ED.setHljsTheme === 'function') ED.setHljsTheme(dark);
    if (typeof ED.applyMermaidTheme === 'function') ED.applyMermaidTheme(dark);
    renderPreviewSoon();
    if (storageOK) { try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) { } }
  }

  // ================= 图片插入（粘贴 / 拖拽） =================
  function insertAtCursor(text) {
    var ta = el.editor;
    var s = ta.selectionStart, e2 = ta.selectionEnd;
    replaceRange(s, e2, text);
    ta.setSelectionRange(s + text.length, s + text.length);
  }

  function insertImageFile(f) {
    var reader = new FileReader();
    reader.onload = function () {
      var d = new Date();
      var ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
      var name = '图片-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '.' + ext;
      insertAtCursor('![' + name + '](' + reader.result + ')');
      showMsg('ok', '✓ 已插入图片 ' + name + '（Base64 ' + fmtBytes(reader.result.length) + '，保存在文档内）');
      setTimeout(clearMsg, 2600);
    };
    reader.readAsDataURL(f);
  }

  // ================= 预览 / 状态刷新 =================
  var renderPreviewSoon = debounce(function () {
    if (ED.mode === 'md' && ED.view !== 'edit' && typeof ED.renderPreview === 'function') {
      ED.renderPreview();
    }
  }, 350);

  function onContentChanged() {
    var t = curTab();
    if (t) {
      t.content = el.editor.value;
      t.dirty = t.content !== t.saved;
      if (t.dirty !== t._d) { t._d = t.dirty; renderTabs(); }
    }
    renderGutter();
    renderMirror();
    updateStatus();
    if (search.open) refreshMatches(true);
    renderPreviewSoon();
    renderTocSoon();
    saveSoon();
  }

  var onInput = debounce(onContentChanged, 60);

  function onCaretMoved() {
    renderGutter();
    updateStatus();
  }

  // ================= 模式 / 视图 =================
  function setSegOn(seg, val, attr) {
    var btns = seg.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-' + attr) === val);
    }
  }

  function applyMode() {
    el.rail.setAttribute('data-mode', ED.mode);
    setSegOn(el.modeSeg, ED.mode, 'mode');
    if (ED.mode === 'json') {
      el.stage.className = 'stage view-edit';
    } else {
      applyView();
    }
  }

  function applyView() {
    el.stage.className = 'stage view-' + ED.view;
    setSegOn(el.viewSeg, ED.view, 'view');
    if (ED.view !== 'edit') renderPreviewSoon();
  }

  function switchMode(mode) {
    var t = curTab();
    if (!t || t.mode === mode) return;
    t.mode = mode;
    ED.mode = mode;
    if (mode === 'json') t.view = 'edit';
    else if (t.view === 'edit') t.view = 'split';
    ED.view = t.view;
    clearMsg();
    applyMode();
    renderTabs();
    onContentChanged();
    saveSoon();
  }

  function switchView(view) {
    var t = curTab();
    if (!t) return;
    t.view = view;
    ED.view = view;
    applyView();
    saveSoon();
  }

  // ================= 初始化 =================
  ED.init = function () {
    el.rail = $('#rail'); el.modeSeg = $('#modeSeg'); el.viewSeg = $('#viewSeg');
    el.editor = $('#editor'); el.hlPre = $('#hlPre'); el.hlCode = $('#hlCode');
    el.gutter = $('#gutter'); el.preview = $('#preview'); el.stage = $('#stage');
    el.tabbar = $('#tabbar'); el.dropOverlay = $('#dropOverlay');
    el.tocPanel = $('#tocPanel'); el.tocBody = $('#tocBody');
    el.btnToc = $('#btnToc'); el.btnTheme = $('#btnTheme'); el.btnExport = $('#btnExport');
    el.searchbar = $('#searchbar'); el.findInput = $('#findInput'); el.replaceInput = $('#replaceInput');
    el.matchCount = $('#matchCount'); el.togCase = $('#togCase'); el.togRegex = $('#togRegex');
    el.msgbar = $('#msgbar');
    el.stLn = $('#stLn'); el.stCol = $('#stCol'); el.stChars = $('#stChars');
    el.stBytes = $('#stBytes'); el.stLines = $('#stLines'); el.stSave = $('#stSave');
    el.fileInput = $('#fileInput');

    if (!hasFSA()) $('#btnDownload').style.display = 'none'; // 无 FSA 时「保存」即下载

    // —— 恢复 / 初始化标签 ——
    restoreTabs();
    var t = curTab();
    el.editor.value = t.content || '';
    syncFromTab(t);
    renderTabs();

    // —— 编辑器事件 ——
    el.editor.addEventListener('input', onInput);
    el.editor.addEventListener('scroll', syncScroll);
    ['keyup', 'click', 'select', 'focus'].forEach(function (ev) {
      el.editor.addEventListener(ev, onCaretMoved);
    });

    // —— 剪贴板粘贴图片 → Markdown 图片 ——
    el.editor.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image/') === 0) {
          e.preventDefault();
          var f = items[i].getAsFile();
          if (f) insertImageFile(f);
          return;
        }
      }
    });

    el.editor.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        var ta = this;
        var s = ta.selectionStart, epos = ta.selectionEnd;
        if (s !== epos && ta.value.slice(s, epos).indexOf('\n') !== -1) {
          var ls = ta.value.lastIndexOf('\n', s - 1) + 1;
          var seg = ta.value.slice(ls, epos).replace(/^/gm, '  ');
          replaceRange(ls, epos, seg);
          ta.setSelectionRange(ls, ls + seg.length);
        } else {
          replaceRange(s, epos, '  ');
        }
        onContentChanged();
      }
    });

    // —— 全局快捷键 ——
    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        openSearch(false);
      } else if (mod && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        openSearch(true);
      } else if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        saveTab();
      } else if (mod && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        openFiles();
      } else if (e.key === 'Escape' && search.open) {
        closeSearch();
      }
    });

    // —— 标签栏（事件委托） ——
    el.tabbar.addEventListener('click', function (e) {
      var closeBtn = e.target.closest ? e.target.closest('.t-close') : null;
      if (closeBtn) {
        var tabEl = closeBtn.closest('.tab');
        if (tabEl && tabEl.getAttribute('data-i') !== null) {
          closeTab(parseInt(tabEl.getAttribute('data-i'), 10));
        }
        return;
      }
      if (e.target.closest && e.target.closest('.tab-new')) {
        newTab('md', '');
        return;
      }
      var tabEl2 = e.target.closest ? e.target.closest('.tab') : null;
      if (tabEl2 && tabEl2.getAttribute('data-i') !== null) {
        switchTab(parseInt(tabEl2.getAttribute('data-i'), 10));
      }
    });
    el.tabbar.addEventListener('dblclick', function (e) {
      var nameEl = e.target.closest ? e.target.closest('.t-name') : null;
      if (!nameEl) return;
      var tabEl = nameEl.closest('.tab');
      var t = ED.tabs[parseInt(tabEl.getAttribute('data-i'), 10)];
      if (t) startRename(nameEl, t);
    });

    // —— 搜索栏 ——
    el.findInput.addEventListener('input', function () {
      search.find = this.value;
      refreshMatches(false);
      if (search.matches.length) scrollToPos(search.matches[0][0]);
    });
    el.findInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prevMatch() : nextMatch(); }
    });
    el.replaceInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
    });
    el.togCase.addEventListener('click', function () {
      search.caseSensitive = !search.caseSensitive;
      this.classList.toggle('on', search.caseSensitive);
      refreshMatches(false);
    });
    el.togRegex.addEventListener('click', function () {
      search.regex = !search.regex;
      this.classList.toggle('on', search.regex);
      refreshMatches(false);
    });
    $('#btnPrev').addEventListener('click', prevMatch);
    $('#btnNext').addEventListener('click', nextMatch);
    $('#btnReplace').addEventListener('click', replaceOne);
    $('#btnReplaceAll').addEventListener('click', replaceAllMatches);
    $('#btnCloseSearch').addEventListener('click', closeSearch);
    $('#btnSearch').addEventListener('click', function () { openSearch(false); });

    // —— 模式 / 视图 ——
    el.modeSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) switchMode(b.getAttribute('data-mode'));
    });
    el.viewSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) switchView(b.getAttribute('data-view'));
    });

    // —— JSON 动作 ——
    $('#btnFormat').addEventListener('click', function () { jsonAction('format'); });
    $('#btnMinify').addEventListener('click', function () { jsonAction('minify'); });
    $('#btnValidate').addEventListener('click', function () { jsonAction('validate'); });

    // —— 大纲 / 主题 / 导出 ——
    if (el.btnToc) el.btnToc.addEventListener('click', function () { setToc(!ED.tocOn); });
    var tocClose = $('#tocClose');
    if (tocClose) tocClose.addEventListener('click', function () { setToc(false); });
    if (el.tocBody) {
      el.tocBody.addEventListener('click', function (e) {
        var item = e.target.closest ? e.target.closest('.toc-item') : null;
        if (item) tocJump(parseInt(item.getAttribute('data-i'), 10));
      });
    }
    if (el.btnTheme) {
      el.btnTheme.addEventListener('click', function () {
        applyTheme(document.body.getAttribute('data-theme') !== 'dark');
      });
    }
    if (el.btnExport) {
      el.btnExport.addEventListener('click', function () {
        if (typeof ED.exportHtml === 'function') ED.exportHtml();
      });
    }
    var savedTheme = null;
    if (storageOK) { try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { } }
    applyTheme(savedTheme === 'dark');

    // —— 文件操作 ——
    $('#btnSample').addEventListener('click', function () {
      var t = curTab();
      t.content = el.editor.value = ED.samples[t.mode] || ED.samples.md;
      onContentChanged();
      el.editor.focus();
    });
    $('#btnOpen').addEventListener('click', openFiles);
    el.fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      var self = this;
      var chain = Promise.resolve();
      files.forEach(function (f) {
        chain = chain.then(function () {
          return f.text().then(function (text) {
            newTab(guessMode(f.name, text), text, f.name, null);
          });
        });
      });
      chain.then(function () { self.value = ''; });
    });
    $('#btnSave').addEventListener('click', saveTab);
    $('#btnDownload').addEventListener('click', function () {
      var t = curTab();
      if (t) { t.content = el.editor.value; blobDownload(t); }
    });
    $('#btnCopy').addEventListener('click', function () {
      var text = el.editor.value;
      if (!text) return;
      function done(ok) {
        showMsg(ok ? 'ok' : 'err', ok ? '✓ 已复制到剪贴板' : '复制失败');
        setTimeout(clearMsg, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { }
        document.body.removeChild(ta);
        done(ok);
      }
    });
    $('#btnClear').addEventListener('click', function () {
      el.editor.value = '';
      closeSearch();
      clearMsg();
      onContentChanged();
      el.editor.focus();
    });

    // —— 文件拖放 ——
    var dragDepth = 0;
    window.addEventListener('dragenter', function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
      e.preventDefault();
      dragDepth++;
      el.dropOverlay.classList.add('show');
    });
    window.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) {
        e.preventDefault();
      }
    });
    window.addEventListener('dragleave', function (e) {
      if (dragDepth > 0 && --dragDepth === 0) el.dropOverlay.classList.remove('show');
    });
    window.addEventListener('drop', function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
      e.preventDefault();
      dragDepth = 0;
      el.dropOverlay.classList.remove('show');
      handleDroppedItems(e.dataTransfer.items);
    });

    onContentChanged();
    renderToc();
    syncScroll();
  };
})();
