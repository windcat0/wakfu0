// ============================================================
//  editor-md.js — Markdown 预览渲染 + Mermaid / highlight.js 集成
//  - Markdown → HTML：标题/列表(嵌套/任务)/表格/引用/代码块/链接图片
//  - ```mermaid 代码块 → 懒加载 mermaid@11（ESM，双 CDN 回退），
//    渲染结果按代码内容缓存，实时预览不重复渲染
//  - 其他代码块 → highlight.js（CDN，失败降级纯文本并提示）
// ============================================================
(function () {
  'use strict';
  var ED = window.ED;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ================= highlight.js 懒加载 =================
  var HLJS_JS = [
    'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/highlight.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js'
  ];
  var HLJS_CSS_LIGHT = 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css';
  var HLJS_CSS_DARK = 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css';
  var hljsPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('script load failed')); };
      document.head.appendChild(s);
    });
  }

  function appendCss(href, id, disabled) {
    if (document.getElementById(id)) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.id = id;
    l.disabled = !!disabled;
    document.head.appendChild(l);
  }

  function currentThemeDark() {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  function ensureHljs() {
    if (window.hljs) return Promise.resolve(window.hljs);
    if (hljsPromise) return hljsPromise;
    hljsPromise = loadScript(HLJS_JS[0])
      .catch(function () { return loadScript(HLJS_JS[1]); })
      .then(function () {
        if (!window.hljs) throw new Error('hljs missing');
        var dark = currentThemeDark();
        appendCss(HLJS_CSS_LIGHT, 'hljs-css-light', dark);
        appendCss(HLJS_CSS_DARK, 'hljs-css-dark', !dark);
        return window.hljs;
      })
      .catch(function () {
        hljsPromise = null;
        if (ED.showMsg) {
          ED.showMsg('err', '⚠ 代码高亮库加载失败（需联网访问 CDN），代码块将以纯文本显示');
          setTimeout(function () { ED.clearMsg(); }, 4000);
        }
        throw new Error('highlight.js 加载失败');
      });
    return hljsPromise;
  }

  // 亮 / 暗主题切换时同步高亮配色
  ED.setHljsTheme = function (dark) {
    var a = document.getElementById('hljs-css-light');
    var b = document.getElementById('hljs-css-dark');
    if (a) a.disabled = !!dark;
    if (b) b.disabled = !dark;
  };

  function codeBlockHtml(lang, code) {
    if (window.hljs) {
      try {
        var res;
        if (lang && hljs.getLanguage(lang)) {
          res = hljs.highlight(code, { language: lang, ignoreIllegals: true });
        } else {
          res = hljs.highlightAuto(code);
        }
        return '<pre><code class="hljs language-' + esc(lang || res.language || 'plaintext') + '">' +
          res.value + '</code></pre>';
      } catch (e) { /* 降级纯文本 */ }
    } else {
      ensureHljs().then(reRenderSoon).catch(function () { });
    }
    return '<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + esc(code) + '</code></pre>';
  }

  // ================= mermaid 懒加载（支持主题切换） =================
  var MERMAID_ESM = [
    'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs',
    'https://unpkg.com/mermaid@11/dist/mermaid.esm.min.mjs'
  ];
  var mermaidPromise = null;
  var mermaidMod = null;
  var mermaidDark = false;

  function mermaidInit(mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidDark ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: "'Inter', system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      themeVariables: {
        primaryColor: mermaidDark ? '#3a2f27' : '#f0e3d8',
        primaryBorderColor: '#c75b39',
        primaryTextColor: mermaidDark ? '#e8e2d6' : '#2d2a24',
        lineColor: mermaidDark ? '#e08a63' : '#a8482a',
        fontSize: '14px'
      }
    });
  }

  function ensureMermaid() {
    if (mermaidPromise) return mermaidPromise;
    mermaidPromise = (async function () {
      var lastErr = null;
      for (var i = 0; i < MERMAID_ESM.length; i++) {
        try {
          var mod = await import(MERMAID_ESM[i]);
          var mermaid = mod.default;
          mermaidMod = mermaid;
          mermaidInit(mermaid);
          return mermaid;
        } catch (e) { lastErr = e; }
      }
      throw new Error('Mermaid 库加载失败（需要联网访问 CDN）');
    })();
    return mermaidPromise;
  }

  // 主题切换：重新初始化 mermaid 并清缓存重渲染
  ED.applyMermaidTheme = function (dark) {
    mermaidDark = !!dark;
    mmdCache.clear();
    if (mermaidMod) mermaidInit(mermaidMod);
    if (ED.mode === 'md' && ED.view !== 'edit') reRenderSoon();
  };

  // 渲染结果缓存：代码内容 → {svg} 或 {err}
  var mmdCache = new Map();
  var mmdSeq = 0;

  // 图表出错时的轻提示：顶部短暂浮出，节流避免边打字边刷屏
  var lastErrToast = 0;
  function notifyMermaidError(msg) {
    var now = Date.now();
    if (now - lastErrToast < 3000) return;
    lastErrToast = now;
    if (ED.showMsg) {
      ED.showMsg('err', '⚠ Mermaid 图表语法有误：' + esc(String(msg).split('\n')[0].slice(0, 100)));
      clearTimeout(notifyMermaidError._t);
      notifyMermaidError._t = setTimeout(function () { ED.clearMsg(); }, 3200);
    }
  }

  function applyMermaid(holder, cached) {
    if (!holder || !holder.isConnected) return;
    if (cached.svg) {
      holder.innerHTML = cached.svg;
    } else {
      // 预览区只留一行低调占位（悬停可看完整错误），详细内容走短暂浮出的提示
      holder.innerHTML = '<span class="mermaid-fail" title="' +
        esc(String(cached.err).slice(0, 500)) + '">⚠ 图表语法有误，悬停查看详情</span>';
      notifyMermaidError(cached.err);
    }
  }

  function processMermaidBlocks(blocks, previewEl) {
    if (!blocks || !blocks.length) return;
    ensureMermaid().then(function (mermaid) {
      var chain = Promise.resolve();
      blocks.forEach(function (b) {
        chain = chain.then(function () {
          var holder = previewEl.querySelector('[data-mmd="' + b.id + '"]');
          if (!holder) return;
          var cached = mmdCache.get(b.code);
          if (cached) { applyMermaid(holder, cached); return; }
          return mermaid.render('ed-mmd-' + (++mmdSeq), b.code).then(function (r) {
            mmdCache.set(b.code, { svg: r.svg });
            applyMermaid(holder, { svg: r.svg });
          }).catch(function (e) {
            var msg = (e && e.message) || String(e);
            mmdCache.set(b.code, { err: msg });
            applyMermaid(holder, { err: msg });
          });
        });
      });
    }).catch(function (e) {
      var hint = (e && e.message) || String(e);
      blocks.forEach(function (b) {
        var holder = previewEl.querySelector('[data-mmd="' + b.id + '"]');
        if (holder) {
          holder.innerHTML = '<span class="mermaid-err" title="' + esc(hint.slice(0, 500)) +
            '">⚠ Mermaid 库加载失败（需联网），悬停查看详情</span>';
        }
      });
      notifyMermaidError('Mermaid 库加载失败（需联网访问 CDN）');
    });
  }

  // ================= KaTeX 数学公式 =================
  var KATEX_JS = [
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    'https://unpkg.com/katex@0.16.11/dist/katex.min.js'
  ];
  var KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  var katexPromise = null;

  function ensureKatex() {
    if (window.katex) return Promise.resolve(window.katex);
    if (katexPromise) return katexPromise;
    katexPromise = loadScript(KATEX_JS[0])
      .catch(function () { return loadScript(KATEX_JS[1]); })
      .then(function () {
        if (!window.katex) throw new Error('katex missing');
        appendCss(KATEX_CSS, 'katex-css', false);
        return window.katex;
      })
      .catch(function () {
        katexPromise = null;
        if (ED.showMsg) {
          ED.showMsg('err', '⚠ 数学公式库加载失败（需联网访问 CDN），公式将以原文显示');
          setTimeout(function () { ED.clearMsg(); }, 4000);
        }
        throw new Error('KaTeX 加载失败');
      });
    return katexPromise;
  }

  var MATH_RE = /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  var MATH_DETECT = /\$\$|\$[^\s$]|\\\(|\\\[/;

  // ================= Markdown → HTML =================
  function safeUrl(u) {
    return /^(https?:|mailto:|#|\/|\.{0,2}\/)/i.test(u) ? esc(u) : '#';
  }

  function mdInline(s) {
    var stash = [];
    // 1) 保护行内代码（内容需转义）
    s = s.replace(/`[^`\n]+`/g, function (m) {
      stash.push('<code>' + esc(m.slice(1, -1)) + '</code>');
      return '\x00' + (stash.length - 1) + '\x00';
    });
    // 2) 数学公式（KaTeX 就绪后渲染，否则保留原文并触发加载）
    if (MATH_DETECT.test(s)) {
      if (window.katex) {
        s = s.replace(MATH_RE, function (all, d1, i1, d2, d3) {
          var tex = d1 || i1 || d2 || d3;
          var display = d1 !== undefined || d3 !== undefined;
          try {
            stash.push(window.katex.renderToString(tex, { displayMode: display, throwOnError: false }));
          } catch (e) {
            stash.push(esc(all));
          }
          return '\x00' + (stash.length - 1) + '\x00';
        });
      } else {
        ensureKatex().then(reRenderSoon).catch(function () { });
      }
    }
    // 3) 转义 + 常规行内规则
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, u) {
      return '<img src="' + safeUrl(u) + '" alt="' + alt + '">';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      return '<a href="' + safeUrl(u) + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // 4) 还原代码 / 公式占位
    s = s.replace(/\x00(\d+)\x00/g, function (_, i) { return stash[+i]; });
    return s;
  }

  function renderMarkdown(src, nested) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [], listStack = [];
    var mermaidBlocks = [];
    var mmdId = 0;
    var hdIdx = 0; // 顶层标题锚点序号（与 TOC 面板对应）

    function flushPara() {
      if (para.length) {
        out.push('<p>' + para.map(mdInline).join('<br>') + '</p>');
        para = [];
      }
    }
    function closeLists(toDepth) {
      while (listStack.length > toDepth) out.push('</' + listStack.pop() + '>');
    }
    function splitRow(row) {
      row = row.trim().replace(/^\|/, '').replace(/\|$/, '');
      return row.split('|').map(function (x) { return x.trim(); });
    }
    function listItemHtml(text) {
      var tm = text.match(/^\[( |x|X)\]\s+(.*)$/);
      if (tm) {
        return '<li style="list-style:none;"><input type="checkbox" disabled' +
          (tm[1].toLowerCase() === 'x' ? ' checked' : '') + '> ' + mdInline(tm[2]) + '</li>';
      }
      return '<li>' + mdInline(text) + '</li>';
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // 围栏代码块 / mermaid
      if (/^ {0,3}```/.test(line)) {
        flushPara(); closeLists(0);
        var lang = line.slice(3).trim().toLowerCase();
        var buf = [];
        i++;
        while (i < lines.length && !/^ {0,3}```/.test(lines[i])) { buf.push(lines[i]); i++; }
        var code = buf.join('\n');
        if (lang === 'mermaid' || lang === 'mmd') {
          mmdId++;
          var id = 'mmd-' + mmdId + '-' + (mmdSeq + 1);
          mermaidBlocks.push({ id: id, code: code });
          out.push('<div class="mermaid-box" data-mmd="' + id + '">' +
            '<div class="mermaid-loading">⏳ Mermaid 图表渲染中…</div></div>');
        } else {
          out.push(codeBlockHtml(lang, code));
        }
        continue;
      }

      var h = line.match(/^ {0,3}(#{1,6})\s+(.*)$/);
      if (h) {
        flushPara(); closeLists(0);
        var n = h[1].length;
        out.push('<h' + n + (nested ? '' : ' id="hd-' + (hdIdx++) + '"') + '>' + mdInline(h[2]) + '</h' + n + '>');
        continue;
      }

      if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushPara(); closeLists(0);
        out.push('<hr>');
        continue;
      }

      if (/^ {0,3}>/.test(line)) {
        flushPara(); closeLists(0);
        var quote = [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
          quote.push(lines[i].replace(/^ {0,3}>\s?/, ''));
          i++;
        }
        i--;
        out.push('<blockquote>' + renderMarkdown(quote.join('\n'), true).html + '</blockquote>');
        continue;
      }

      if (line.indexOf('|') !== -1 && i + 1 < lines.length &&
        /^[\s|:-]+$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1) {
        flushPara(); closeLists(0);
        var headCells = splitRow(line);
        i += 2;
        var bodyRows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim() !== '') {
          bodyRows.push(splitRow(lines[i]));
          i++;
        }
        i--;
        var table = '<table><thead><tr>' +
          headCells.map(function (c) { return '<th>' + mdInline(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>';
        bodyRows.forEach(function (r) {
          table += '<tr>' + r.map(function (c) { return '<td>' + mdInline(c) + '</td>'; }).join('') + '</tr>';
        });
        out.push(table + '</tbody></table>');
        continue;
      }

      var li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushPara();
        var indent = li[1].replace(/\t/g, '  ').length;
        var depth = Math.min(3, Math.floor(indent / 2));
        var tag = /\d/.test(li[2]) ? 'ol' : 'ul';
        while (listStack.length > depth + 1 ||
          (listStack.length === depth + 1 && listStack[depth] !== tag)) {
          out.push('</' + listStack.pop() + '>');
        }
        while (listStack.length < depth + 1) {
          listStack.push(tag);
          out.push('<' + tag + '>');
        }
        out.push(listItemHtml(li[3]));
        continue;
      }

      if (line.trim() === '') { flushPara(); closeLists(0); continue; }
      para.push(line);
    }
    flushPara();
    closeLists(0);

    return { html: out.join('\n'), mermaid: mermaidBlocks };
  }

  // ================= 预览入口 =================
  function reRenderSoon() {
    clearTimeout(reRenderSoon._t);
    reRenderSoon._t = setTimeout(function () {
      if (ED.mode === 'md' && ED.view !== 'edit') ED.renderPreview();
    }, 120);
  }

  ED.renderPreview = function () {
    var previewEl = document.getElementById('preview');
    if (!previewEl) return;
    var r = renderMarkdown(document.getElementById('editor').value);
    previewEl.innerHTML = r.html;
    processMermaidBlocks(r.mermaid, previewEl);
  };
  ED._t.renderMarkdown = renderMarkdown;
  ED._t.mmdCacheSize = function () { return mmdCache.size; };

  // ================= 导出独立 HTML =================
  function collectPvCss() {
    var out = [];
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if (sheet.href) continue; // 只取页面内联样式（跨域规则不可读）
        var rules = sheet.cssRules || [];
        for (var j = 0; j < rules.length; j++) {
          var r = rules[j];
          var sel = r.selectorText || '';
          if (sel.indexOf('.pv') !== -1 || sel.indexOf('.mermaid') !== -1) {
            out.push(r.cssText);
          }
        }
      }
    } catch (e) { }
    return out.join('\n');
  }

  function fetchText(url) {
    return fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
  }

  function waitMermaidDone(pv, timeoutMs) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        if (!pv.querySelector('.mermaid-loading') || Date.now() - t0 > timeoutMs) return resolve();
        setTimeout(poll, 150);
      })();
    });
  }

  ED.exportHtml = function () {
    var pv = document.getElementById('preview');
    if (!pv) return;
    if (ED.showMsg) ED.showMsg('ok', '⏳ 正在生成独立 HTML（含公式 / 图表 / 高亮样式）…');
    // 确保预览为最新内容（编辑模式也会渲染，预览区隐藏但 DOM 可用）
    ED.renderPreview();
    waitMermaidDone(pv, 6000).then(function () {
      var dark = document.body.getAttribute('data-theme') === 'dark';
      var tab = ED.tabs[ED.activeTab] || {};
      var tabName = tab.name || 'document.md';
      var bodyHtml = pv.innerHTML;
      var title = '导出文档';
      var mt = bodyHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      if (mt) {
        var tmp = document.createElement('div');
        tmp.innerHTML = mt[1];
        var txt = tmp.textContent.trim();
        if (txt) title = txt;
      } else if (tabName) {
        title = tabName;
      }
      var hljsUrl = dark ? HLJS_CSS_DARK : HLJS_CSS_LIGHT;
      return Promise.all([fetchText(hljsUrl), fetchText(KATEX_CSS)]).then(function (css) {
        var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
          '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
          '<title>' + esc(title) + '</title>\n<style>\n' +
          'body{margin:0;padding:28px 18px;background:' + (dark ? '#211e1a' : '#faf8f4') + ';color:' + (dark ? '#e8e2d6' : '#2d2a24') + ';font-family:\'Inter\',system-ui,-apple-system,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;}\n' +
          'body>.pv{max-width:860px;margin:0 auto;border:none;box-shadow:none;border-radius:0;padding:0;background:transparent;overflow:visible;}\n' +
          collectPvCss() + '\n' + css[0] + '\n' + css[1] + '\n</style>\n</head>\n<body>\n' +
          '<div class="pv">' + bodyHtml + '</div>\n</body>\n</html>';
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var a = document.createElement('a');
        a.download = tabName.replace(/\.[^.]+$/, '') + '.html';
        a.href = URL.createObjectURL(blob);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        if (ED.showMsg) {
          ED.showMsg('ok', '✓ 已导出 ' + a.download + '（独立 HTML，可直接双击打开）');
          setTimeout(ED.clearMsg, 3000);
        }
      });
    }).catch(function (e) {
      if (ED.showMsg) {
        ED.showMsg('err', '导出失败：' + esc(e && e.message || String(e)));
        setTimeout(ED.clearMsg, 3000);
      }
    });
  };

  // ================= 示例内容 =================
  ED.samples = {};

  ED.samples.md = [
    '# Markdown 在线编辑器',
    '',
    '支持 **加粗**、*斜体*、~~删除线~~、`行内代码`、[链接](https://example.com) 与任务列表。',
    '左侧编辑、右侧实时预览，也可切换为纯编辑或纯预览模式。',
    '',
    '## 代码语法高亮',
    '',
    '```js',
    '// JavaScript',
    'const greet = (name) => `你好, ${name}!`;',
    'console.log(greet("沃土"));',
    '```',
    '',
    '```python',
    '# Python',
    'def fib(n):',
    '    a, b = 0, 1',
    '    while a < n:',
    '        yield a',
    '        a, b = b, a + b',
    '```',
    '',
    '```json',
    '{ "site": "wakfu", "tools": 34, "online": true }',
    '```',
    '',
    '## Mermaid 图表',
    '',
    '```mermaid',
    'flowchart LR',
    '    A[开始] --> B{条件判断}',
    '    B -- 是 --> C[执行任务]',
    '    B -- 否 --> D[跳过]',
    '    C --> E[结束]',
    '    D --> E',
    '```',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    participant U as 用户',
    '    participant E as 编辑器',
    '    U->>E: 输入 Markdown',
    '    E->>E: 实时渲染',
    '    E-->>U: 显示预览',
    '```',
    '',
    '## 数学公式（KaTeX）',
    '',
    '行内公式 $E = mc^2$ 与 $a^2 + b^2 = c^2$。',
    '',
    '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$',
    '',
    '## 表格与任务',
    '',
    '| 功能 | 类型 | 状态 |',
    '| --- | --- | :--: |',
    '| JSON 格式化 | 编辑 | ✅ |',
    '| 搜索替换 | 编辑 | ✅ |',
    '| Mermaid 图表 | 预览 | ✅ |',
    '',
    '- [x] 支持 JSON 格式化 / 压缩 / 校验',
    '- [x] 支持正则搜索与批量替换',
    '- [ ] 待办：导出 HTML',
    '',
    '> 💡 快捷键：Ctrl+F 查找 · Ctrl+H 替换 · Tab 缩进 · Ctrl+S 下载 · 内容自动保存到本地'
  ].join('\n');

  ED.samples.json = JSON.stringify({
    site: 'wakfu 攻略站',
    features: ['数学可视化', '开发者工具集', '在线编辑器'],
    editor: {
      modes: ['json', 'markdown'],
      search: { regex: true, caseSensitive: false },
      preview: { mermaid: true, highlight: true },
      autosave: true
    },
    stats: { tools: 34, version: 1.2, stars: null }
  }, null, 2);

  // ================= 启动 =================
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { ED.init(); });
    } else {
      ED.init();
    }
  }
})();
