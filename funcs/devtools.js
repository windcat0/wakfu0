// ============================================================
//  devtools.js — 开发者工具集核心框架
//  提供：工具注册表、分类导航渲染、hash 路由、搜索、
//  通用 ioTool（输入 → 动作按钮 → 输出）构造器、字节/文本工具函数。
//  各工具模块（devtools-enc / -data / -gen.js）通过 DT.register 注册，
//  最后由 devtools-gen.js 末尾调用 DT.boot() 启动。
// ============================================================
(function () {
  'use strict';

  var DT = window.DT = {
    cats: [
      { id: 'encode', name: '编码 / 解码', icon: '🔤' },
      { id: 'crypto', name: '哈希 / 加密', icon: '🔐' },
      { id: 'data', name: 'JSON / 数据格式', icon: '🧾' },
      { id: 'text', name: '文本处理', icon: '✏️' },
      { id: 'convert', name: '转换 / 计算', icon: '🔄' },
      { id: 'gen', name: '生成器', icon: '🎲' },
      { id: 'web', name: 'Web 调试', icon: '🌐' },
      { id: 'misc', name: '其他工具', icon: '🧰' }
    ],
    tools: [],
    active: '',
    _t: {} // 纯函数出口（供单元自测）
  };

  DT.register = function (t) {
    DT.tools.push(t);
  };

  // ---------- DOM ----------
  DT.$ = function (sel, root) { return (root || document).querySelector(sel); };
  DT.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  DT.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ---------- 字节 / 文本 ----------
  DT.str2u8 = function (s) { return new TextEncoder().encode(s); };
  DT.u82str = function (u8) { return new TextDecoder().decode(u8); };

  DT.u82hex = function (u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16);
    return s;
  };

  DT.hex2u8 = function (hex) {
    var s = String(hex).replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
    if (s.length === 0) return new Uint8Array(0);
    if (s.length % 2 !== 0) throw new Error('十六进制长度必须为偶数（当前 ' + s.length + ' 位）');
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  };

  DT.u82b64 = function (u8) {
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return btoa(s);
  };

  DT.b642u8 = function (b64) {
    var s = String(b64).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    var body = s.replace(/=+$/, '');
    if (!/^[A-Za-z0-9+/]*$/.test(body)) throw new Error('无效的 Base64 字符（允许 A-Z a-z 0-9 + / - _ 和 =）');
    var bin;
    try { bin = atob(s); } catch (e) { throw new Error('无效的 Base64 数据'); }
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  DT.hasSubtle = function () {
    return typeof crypto !== 'undefined' && !!(crypto.subtle && crypto.subtle.digest);
  };

  DT.subtleFail = function () {
    return new Error('当前环境不支持 Web Crypto API（需要 HTTPS 或本地 file:// 页面），无法使用该功能');
  };

  // ---------- 其它实用 ----------
  DT.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  DT.fmtBytes = function (n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  };

  DT.randInt = function (n) { // [0, n) 均匀随机（拒绝采样）
    if (n <= 1) return 0;
    var limit = Math.floor(4294967296 / n) * n;
    var buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  };

  DT.pick = function (arr) { return arr[DT.randInt(arr.length)]; };

  DT.copy = function (text, btn) {
    if (text === '' || text == null) return;
    function flash(ok) {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = ok ? '已复制 ✓' : '复制失败';
      btn.disabled = true;
      setTimeout(function () { btn.textContent = old; btn.disabled = false; }, 1200);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { }
      document.body.removeChild(ta);
      flash(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(true); }, fallback);
    } else fallback();
  };

  DT.bindCopy = function (btn, getText) {
    btn.addEventListener('click', function () { DT.copy(getText(), btn); });
  };

  // ---------- 控件构造（返回取值函数） ----------
  function wrapCtl(row, labelText, input) {
    var label = document.createElement('label');
    label.className = 'ctl';
    var sp = document.createElement('span');
    sp.textContent = labelText;
    label.appendChild(sp);
    label.appendChild(input);
    row.appendChild(label);
    return input;
  }

  // options: [{v, t}] 或 [[v, t], ...] 或 ['a','b']（v=t）
  DT.ctrlSelect = function (row, labelText, options, def) {
    var sel = document.createElement('select');
    options.forEach(function (o) {
      var v = Array.isArray(o) ? o[0] : o.v;
      var t = Array.isArray(o) ? o[1] : o.t;
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = t;
      if (String(v) === String(def)) opt.selected = true;
      sel.appendChild(opt);
    });
    wrapCtl(row, labelText, sel);
    return function () { return sel.value; };
  };

  DT.ctrlCheck = function (row, labelText, def) {
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!def;
    wrapCtl(row, labelText, input);
    return function () { return input.checked; };
  };

  DT.ctrlText = function (row, labelText, def, placeholder) {
    var input = document.createElement('input');
    input.type = 'text';
    input.value = def || '';
    if (placeholder) input.placeholder = placeholder;
    input.style.width = '130px';
    wrapCtl(row, labelText, input);
    return function () { return input.value; };
  };

  DT.ctrlNumber = function (row, labelText, def, min, max) {
    var input = document.createElement('input');
    input.type = 'number';
    input.value = def;
    if (min != null) input.min = min;
    if (max != null) input.max = max;
    input.style.width = '86px';
    wrapCtl(row, labelText, input);
    return function () { return parseInt(input.value, 10); };
  };

  DT.card = function (root, title) {
    var c = document.createElement('div');
    c.className = 'card';
    if (title) {
      var h = document.createElement('h3');
      h.textContent = title;
      c.appendChild(h);
    }
    root.appendChild(c);
    return c;
  };

  DT.button = function (label, cls, onClick) {
    var b = document.createElement('button');
    b.className = 'btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  DT.statusBox = function (root) {
    var div = document.createElement('div');
    div.hidden = true;
    root.appendChild(div);
    return {
      err: function (msg) {
        div.className = 'io-err';
        div.textContent = '✕ ' + msg;
        div.hidden = false;
      },
      ok: function (msg) {
        div.className = 'io-ok';
        div.textContent = msg;
        div.hidden = false;
      },
      clear: function () { div.hidden = true; }
    };
  };

  // ---------- 通用「输入 → 动作 → 输出」工具 ----------
  // cfg: { id, cat, icon, name, short, desc, kw, ph, rows, orows, swap,
  //        controls(row) → {name: getter},
  //        actions: [{label, cls, fn(text, ctrls) → string|Promise}] }
  DT.ioTool = function (cfg) {
    DT.register({
      id: cfg.id, cat: cfg.cat, icon: cfg.icon, name: cfg.name,
      short: cfg.short || cfg.name, desc: cfg.desc, kw: cfg.kw || '',
      render: function (root) {
        root.innerHTML =
          '<div class="card">' +
          '<textarea class="io-input" rows="' + (cfg.rows || 6) + '" spellcheck="false" placeholder="' + DT.esc(cfg.ph || '输入文本…') + '"></textarea>' +
          '<div class="ctrl-row"></div>' +
          '<div class="btn-row" data-abtns></div>' +
          '<div class="io-err" hidden></div>' +
          '<textarea class="io-output" rows="' + (cfg.orows || 6) + '" readonly spellcheck="false" placeholder="输出结果…"></textarea>' +
          '<div class="btn-row" data-obtns>' +
          '<button class="btn sm" data-a="copy">复制结果</button>' +
          (cfg.swap ? '<button class="btn sm ghost" data-a="swap">⇅ 输出转输入</button>' : '') +
          '<button class="btn sm ghost" data-a="clear">清空</button>' +
          '</div>' +
          '</div>';

        var input = DT.$('.io-input', root);
        var output = DT.$('.io-output', root);
        var errBox = DT.$('.io-err', root);

        var ctrls = cfg.controls ? cfg.controls(DT.$('.ctrl-row', root)) : {};

        function run(fn) {
          errBox.hidden = true;
          Promise.resolve().then(function () { return fn(input.value, ctrls); })
            .then(function (out) {
              output.value = (out && typeof out === 'object' && 'text' in out) ? out.text : String(out);
            })
            .catch(function (e) {
              output.value = '';
              errBox.textContent = '✕ ' + (e && e.message ? e.message : String(e));
              errBox.hidden = false;
            });
        }

        cfg.actions.forEach(function (a) {
          DT.$('[data-abtns]', root).appendChild(DT.button(a.label, a.cls || '', function () { run(a.fn); }));
        });

        DT.$('[data-obtns] [data-a="copy"]', root).addEventListener('click', function () {
          DT.copy(output.value, this);
        });
        if (cfg.swap) {
          DT.$('[data-obtns] [data-a="swap"]', root).addEventListener('click', function () {
            input.value = output.value;
            errBox.hidden = true;
          });
        }
        DT.$('[data-obtns] [data-a="clear"]', root).addEventListener('click', function () {
          input.value = '';
          output.value = '';
          errBox.hidden = true;
        });
      }
    });
  };

  // ---------- 启动 ----------
  DT.boot = function () {
    var sidebar = document.getElementById('sidebar');
    var main = document.getElementById('main');
    var search = document.getElementById('toolSearch');
    if (!sidebar || !main) return;

    // 侧边导航
    var html = '<div class="side-count">共 <strong>' + DT.tools.length + '</strong> 个工具</div>';
    DT.cats.forEach(function (cat) {
      var items = DT.tools.filter(function (t) { return t.cat === cat.id; });
      if (!items.length) return;
      html += '<div class="nav-group-label"><span>' + cat.icon + '</span>' + DT.esc(cat.name) + '</div>';
      items.forEach(function (t) {
        var kw = (t.name + ' ' + (t.short || '') + ' ' + (t.kw || '')).toLowerCase();
        html += '<a class="nav-item" href="#' + t.id + '" data-id="' + t.id + '" data-kw="' + DT.esc(kw) + '">' +
          '<span class="ni-icon">' + t.icon + '</span><span>' + DT.esc(t.short || t.name) + '</span></a>';
      });
    });
    sidebar.innerHTML = html;

    // 工具面板
    DT.tools.forEach(function (t) {
      var sec = document.createElement('section');
      sec.className = 'tool-panel';
      sec.id = 'tp-' + t.id;
      sec.innerHTML = '<div class="panel-head"><div class="p-icon">' + t.icon + '</div><div>' +
        '<h2>' + DT.esc(t.name) + '</h2><div class="p-desc">' + DT.esc(t.desc) + '</div></div></div>' +
        '<div class="t-body"></div>';
      main.appendChild(sec);
      try { t.render(sec.querySelector('.t-body')); }
      catch (e) { sec.querySelector('.t-body').innerHTML = '<div class="card"><div class="io-err">工具初始化失败：' + DT.esc(e.message) + '</div></div>'; }
    });

    // 路由
    function show(id) {
      if (!DT.tools.some(function (t) { return t.id === id; })) id = DT.tools[0].id;
      DT.tools.forEach(function (t) {
        var el = document.getElementById('tp-' + t.id);
        if (el) el.classList.toggle('active', t.id === id);
      });
      DT.$$('.nav-item', sidebar).forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-id') === id);
      });
      DT.active = id;
    }

    sidebar.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('.nav-item') : null;
      if (!a) return;
      e.preventDefault();
      var id = a.getAttribute('data-id');
      if (location.hash !== '#' + id) location.hash = id;
      else show(id);
    });

    window.addEventListener('hashchange', function () {
      var id = decodeURIComponent(location.hash.slice(1));
      if (id !== DT.active) show(id);
    });

    if (search) {
      search.addEventListener('input', DT.debounce(function () {
        var q = search.value.trim().toLowerCase();
        DT.$$('.nav-item', sidebar).forEach(function (a) {
          var hit = !q || (a.getAttribute('data-kw') || '').indexOf(q) !== -1;
          a.style.display = hit ? '' : 'none';
        });
        DT.$$('.nav-group-label', sidebar).forEach(function (g) { g.style.display = q ? 'none' : ''; });
        DT.$('.side-count', sidebar).style.display = q ? 'none' : '';
      }, 120));
    }

    show(location.hash ? decodeURIComponent(location.hash.slice(1)) : '');
  };
})();
