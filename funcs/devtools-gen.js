// ============================================================
//  devtools-gen.js — 生成器 + Web 调试 + 其他工具
//  UUID、密码生成、短 ID、二维码、正则测试、URL 解析、UA 解析、
//  HTTP 状态码、图片转 Base64、Cron 解析、Markdown 预览；文件末尾启动 DT.boot()
// ============================================================
(function () {
  'use strict';
  var DT = window.DT;

  // ================= UUID =================
  DT.ioTool({
    id: 'uuid', cat: 'gen', icon: '🆔', name: 'UUID v4 批量生成', short: 'UUID 生成',
    desc: '基于 crypto.getRandomValues 的随机 UUID（RFC 4122 版本 4），可批量生成、大写、去连字符。',
    kw: 'uuid guid 唯一 id random',
    ph: '无需输入，点击下方按钮生成…',
    orows: 8,
    controls: function (row) {
      return {
        n: DT.ctrlNumber(row, '数量', 5, 1, 100),
        upper: DT.ctrlCheck(row, '大写', false),
        noDash: DT.ctrlCheck(row, '去掉连字符', false)
      };
    },
    actions: [
      {
        label: '生成 →', fn: function (t, ctrls) {
          var out = [];
          for (var k = 0; k < (ctrls.n() || 5); k++) {
            var u = crypto.getRandomValues(new Uint8Array(16));
            u[6] = (u[6] & 0x0f) | 0x40;
            u[8] = (u[8] & 0x3f) | 0x80;
            var hex = [];
            for (var i = 0; i < 16; i++) hex.push((u[i] < 16 ? '0' : '') + u[i].toString(16));
            var s = hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' + hex.slice(6, 8).join('') +
              '-' + hex.slice(8, 10).join('') + '-' + hex.slice(10, 16).join('');
            if (ctrls.noDash()) s = s.replace(/-/g, '');
            if (ctrls.upper()) s = s.toUpperCase();
            out.push(s);
          }
          return out.join('\n');
        }
      }
    ]
  });

  // ================= 密码生成 =================
  DT.register({
    id: 'password', cat: 'gen', icon: '🔑', name: '密码生成器', short: '密码生成',
    desc: '可配置长度与字符集的随机密码，保证每类字符至少出现一次，附熵值强度评估。',
    kw: 'password 密码 随机 random 强度',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="range-row"><span class="ctl"><span>长度</span></span>' +
        '<input type="range" min="4" max="64" value="16" class="p-len"><span class="range-val" data-lenv>16</span></div>' +
        '<div class="ctrl-row">' +
        '<label class="ctl"><input type="checkbox" class="p-lower" checked> 小写 a-z</label>' +
        '<label class="ctl"><input type="checkbox" class="p-upper" checked> 大写 A-Z</label>' +
        '<label class="ctl"><input type="checkbox" class="p-digit" checked> 数字 0-9</label>' +
        '<label class="ctl"><input type="checkbox" class="p-symbol" checked> 符号 !@#$%^&*</label>' +
        '<label class="ctl"><input type="checkbox" class="p-noamb"> 排除易混淆 (I l 1 O 0 o)</label>' +
        '</div>' +
        '<div class="ctrl-row">' +
        '<label class="ctl"><span>附加字符</span><input type="text" class="p-extra" placeholder="追加自定义字符" style="width:140px"></label>' +
        '<label class="ctl"><span>生成数量</span><input type="number" class="p-n" value="1" min="1" max="10" style="width:70px"></label>' +
        '<button class="btn p-gen">生成 →</button>' +
        '</div>' +
        '<div class="strength-bar"><div data-bar></div></div>' +
        '<div class="strength-label" data-strength>长度 16 · 字符池 62 · 熵约 95 bit</div>' +
        '<textarea class="p-out" rows="4" readonly spellcheck="false" placeholder="生成的密码…"></textarea>' +
        '<div class="btn-row"><button class="btn sm p-copy">复制</button></div>' +
        '</div>';

      var lenR = DT.$('.p-len', root), lenV = DT.$('[data-lenv]', root);
      var bar = DT.$('[data-bar]', root), strength = DT.$('[data-strength]', root);
      var out = DT.$('.p-out', root);

      function sets() {
        var lower = 'abcdefghijklmnopqrstuvwxyz', upper = lower.toUpperCase();
        var digit = '0123456789', symbol = '!@#$%^&*()-_=+[]{};:,.<>?/~';
        var noamb = DT.$('.p-noamb', root).checked;
        function strip(s) {
          return noamb ? s.split('').filter(function (c) { return 'Il1O0o'.indexOf(c) === -1; }).join('') : s;
        }
        var list = [];
        if (DT.$('.p-lower', root).checked) list.push(strip(lower));
        if (DT.$('.p-upper', root).checked) list.push(strip(upper));
        if (DT.$('.p-digit', root).checked) list.push(strip(digit));
        if (DT.$('.p-symbol', root).checked) list.push(symbol);
        var extra = DT.$('.p-extra', root).value;
        if (extra) list.push(extra);
        return list;
      }

      function updateStrength() {
        var list = sets();
        var pool = list.join('').length;
        var len = parseInt(lenR.value, 10);
        var bits = pool > 0 ? Math.round(len * Math.log(pool) / Math.LN2) : 0;
        var label, color, pct;
        if (bits < 28) { label = '很弱'; color = 'var(--red)'; pct = 20; }
        else if (bits < 36) { label = '弱'; color = 'var(--red)'; pct = 40; }
        else if (bits < 60) { label = '一般'; color = 'var(--gold)'; pct = 60; }
        else if (bits < 128) { label = '强'; color = 'var(--green)'; pct = 82; }
        else { label = '很强'; color = 'var(--green)'; pct = 100; }
        bar.style.width = pct + '%';
        bar.style.background = color;
        strength.textContent = '长度 ' + len + ' · 字符池 ' + pool + ' · 熵约 ' + bits + ' bit · ' + label;
        strength.style.color = color;
      }

      lenR.addEventListener('input', function () {
        lenV.textContent = lenR.value;
        updateStrength();
      });
      DT.$$('.ctl input[type="checkbox"], .p-extra', root).forEach(function (el) {
        el.addEventListener('change', updateStrength);
      });

      DT.$('.p-gen', root).addEventListener('click', function () {
        var list = sets();
        if (!list.length) { out.value = ''; strength.textContent = '请至少选择一种字符集'; return; }
        var len = parseInt(lenR.value, 10);
        var n = Math.min(10, Math.max(1, parseInt(DT.$('.p-n', root).value, 10) || 1));
        var results = [];
        for (var k = 0; k < n; k++) {
          var chars = [];
          list.forEach(function (set) { chars.push(set[DT.randInt(set.length)]); });
          var all = list.join('');
          while (chars.length < len) chars.push(all[DT.randInt(all.length)]);
          for (var i = chars.length - 1; i > 0; i--) {
            var j = DT.randInt(i + 1);
            var tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
          }
          results.push(chars.slice(0, len).join(''));
        }
        out.value = results.join('\n');
        updateStrength();
      });

      DT.$('.p-copy', root).addEventListener('click', function () { DT.copy(out.value, this); });
      updateStrength();
    }
  });

  // ================= 短 ID =================
  DT.ioTool({
    id: 'shortid', cat: 'gen', icon: '🎫', name: '短 ID 生成（nanoid 风格）', short: '短 ID',
    desc: '使用自定义字母表生成随机短 ID（默认 nanoid 64 字符集），密码学安全随机、分布均匀。',
    kw: 'nanoid shortid 短 id 随机',
    ph: '无需输入，点击下方按钮生成…',
    orows: 6,
    controls: function (row) {
      return {
        alphabet: DT.ctrlText(row, '字母表', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-', ''),
        len: DT.ctrlNumber(row, '长度', 21, 4, 64),
        n: DT.ctrlNumber(row, '数量', 5, 1, 100)
      };
    },
    actions: [
      {
        label: '生成 →', fn: function (t, ctrls) {
          var ab = ctrls.alphabet();
          if (ab.length < 2) throw new Error('字母表至少需要 2 个不同字符');
          if (new Set(ab).size !== ab.length) throw new Error('字母表包含重复字符');
          var len = ctrls.len() || 21;
          var out = [];
          for (var k = 0; k < (ctrls.n() || 5); k++) {
            var s = '';
            for (var i = 0; i < len; i++) s += ab[DT.randInt(ab.length)];
            out.push(s);
          }
          return out.join('\n');
        }
      }
    ]
  });

  // ================= 二维码 =================
  DT.register({
    id: 'qrcode', cat: 'gen', icon: '▦', name: '二维码生成', short: '二维码',
    desc: '输入文本或链接生成二维码（支持版本 1-10、L/M/Q/H 纠错），可下载 PNG。',
    kw: 'qrcode 二维码 qr 生成 png',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<textarea class="q-in" rows="3" spellcheck="false" placeholder="输入文本或 URL，如 https://example.com">https://example.com</textarea>' +
        '<div class="ctrl-row">' +
        '<label class="ctl"><span>纠错级别</span><select class="q-ec">' +
        '<option value="L">L（7%，可存更多）</option><option value="M" selected>M（15%，推荐）</option>' +
        '<option value="Q">Q（25%）</option><option value="H">H（30%，可贴logo）</option></select></label>' +
        '<label class="ctl"><span>模块大小</span><select class="q-px">' +
        '<option value="2">2px</option><option value="3">3px</option><option value="4" selected>4px</option>' +
        '<option value="6">6px</option><option value="8">8px</option></select></label>' +
        '<label class="ctl"><span>边距</span><select class="q-mg">' +
        '<option value="2">2</option><option value="3">3</option><option value="4" selected>4（标准）</option><option value="6">6</option></select></label>' +
        '</div>' +
        '<div class="io-err" data-err hidden></div>' +
        '<div style="text-align:center;margin-top:14px"><canvas class="q-canvas" style="max-width:100%"></canvas></div>' +
        '<div class="hint" data-info></div>' +
        '<div class="btn-row"><button class="btn sm q-dl" disabled>下载 PNG</button></div>' +
        '</div>';

      var input = DT.$('.q-in', root), err = DT.$('[data-err]', root);
      var canvas = DT.$('.q-canvas', root), info = DT.$('[data-info]', root);
      var dl = DT.$('.q-dl', root);

      function render() {
        err.hidden = true;
        dl.disabled = true;
        info.textContent = '';
        try {
          var qr = window.QR(input.value, DT.$('.q-ec', root).value);
          var px = parseInt(DT.$('.q-px', root).value, 10);
          var mg = parseInt(DT.$('.q-mg', root).value, 10);
          var size = (qr.size + mg * 2) * px;
          canvas.width = size;
          canvas.height = size;
          canvas.style.width = Math.min(size, 420) + 'px';
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          ctx.fillStyle = '#2d2a24';
          for (var r = 0; r < qr.size; r++) {
            for (var c = 0; c < qr.size; c++) {
              if (qr.m[r * qr.size + c]) {
                ctx.fillRect((c + mg) * px, (r + mg) * px, px, px);
              }
            }
          }
          info.textContent = '版本 ' + qr.version + ' · ' + qr.size + '×' + qr.size + ' 模块 · 掩码 ' + qr.mask;
          dl.disabled = false;
        } catch (e) {
          canvas.width = 10; canvas.height = 10;
          err.textContent = '✕ ' + e.message;
          err.hidden = false;
        }
      }

      input.addEventListener('input', DT.debounce(render, 300));
      DT.$$('.q-ec, .q-px, .q-mg', root).forEach(function (el) { el.addEventListener('change', render); });
      dl.addEventListener('click', function () {
        var a = document.createElement('a');
        a.download = 'qrcode.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
      });
      render();
    }
  });

  // ================= 正则测试 =================
  DT.register({
    id: 'regex-test', cat: 'web', icon: '🔍', name: '正则表达式测试', short: '正则测试',
    desc: '实时测试正则：匹配高亮、索引与捕获组展示；支持 g i m s u y 标志。',
    kw: 'regex regexp 正则 匹配 match capture',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<label class="ctl"><span>表达式</span><input type="text" class="re-pat" placeholder="如 (\\d{4})-(\\d{2})" style="width:240px"></label>' +
        '<span class="ctl">标志：</span>' +
        ['g', 'i', 'm', 's', 'u', 'y'].map(function (f) {
          return '<label class="ctl"><input type="checkbox" class="re-f" value="' + f + '"' + (f === 'g' ? ' checked' : '') + '> ' + f + '</label>';
        }).join('') +
        '</div>' +
        '<textarea class="re-txt" rows="6" spellcheck="false" placeholder="输入测试文本…"></textarea>' +
        '<div class="io-err" data-err hidden></div>' +
        '<div class="mark-box" data-hl style="margin-top:12px">匹配结果将高亮显示在这里</div>' +
        '<div class="match-list" data-list></div>' +
        '</div>';

      var pat = DT.$('.re-pat', root), txt = DT.$('.re-txt', root);
      var err = DT.$('[data-err]', root), hl = DT.$('[data-hl]', root), list = DT.$('[data-list]', root);

      function update() {
        err.hidden = true;
        hl.innerHTML = '匹配结果将高亮显示在这里';
        list.innerHTML = '';
        if (!pat.value || !txt.value) return;
        var flags = DT.$$('.re-f', root).filter(function (c) { return c.checked; }).map(function (c) { return c.value; }).join('');
        var re;
        try { re = new RegExp(pat.value, flags); }
        catch (e) { err.textContent = '✕ 正则表达式无效：' + e.message; err.hidden = false; return; }

        var ranges = [], matches = [];
        if (flags.indexOf('g') !== -1 || flags.indexOf('y') !== -1) {
          var mm, guard = 0;
          while ((mm = re.exec(txt.value)) !== null && guard++ < 5000) {
            matches.push(mm);
            ranges.push([mm.index, mm.index + mm[0].length]);
            if (mm[0] === '') { re.lastIndex++; if (re.lastIndex > txt.value.length) break; }
          }
        } else {
          var m1 = re.exec(txt.value);
          if (m1) { matches.push(m1); ranges.push([m1.index, m1.index + m1[0].length]); }
        }

        // 高亮渲染
        var s = txt.value, html = '', pos = 0;
        ranges.forEach(function (rg) {
          html += DT.esc(s.slice(pos, rg[0]));
          html += '<mark>' + DT.esc(s.slice(rg[0], rg[1])) + '</mark>';
          pos = rg[1];
        });
        html += DT.esc(s.slice(pos));
        hl.innerHTML = html || '<span style="color:var(--text-light)">（空）</span>';

        if (!matches.length) {
          list.innerHTML = '<p class="hint">未找到匹配（' + matches.length + ' 处）</p>';
          return;
        }
        list.innerHTML = '<p class="hint">共 ' + matches.length + ' 处匹配：</p>' + matches.slice(0, 200).map(function (m, i) {
          var groups = '';
          if (m.length > 1) {
            for (var g = 1; g < m.length; g++) {
              groups += '<div>捕获组 ' + g + '：' + (m[g] === undefined ? '<i style="color:var(--text-light)">未匹配</i>' : DT.esc(m[g])) + '</div>';
            }
          }
          if (m.groups) {
            Object.keys(m.groups).forEach(function (name) {
              groups += '<div>命名组 ' + DT.esc(name) + '：' + (m.groups[name] === undefined ? '<i>未匹配</i>' : DT.esc(m.groups[name])) + '</div>';
            });
          }
          return '<div class="match-item"><strong>#' + (i + 1) + '</strong> @' + m.index + '：<span class="mono">' +
            (m[0] === '' ? '<i>（空匹配）</i>' : DT.esc(m[0])) + '</span>' + groups + '</div>';
        }).join('') + (matches.length > 200 ? '<p class="hint">仅展示前 200 个匹配…</p>' : '');
      }

      var d = DT.debounce(update, 250);
      pat.addEventListener('input', d);
      txt.addEventListener('input', d);
      DT.$$('.re-f', root).forEach(function (c) { c.addEventListener('change', d); });
    }
  });

  // ================= URL 解析 =================
  DT.register({
    id: 'url-parse', cat: 'web', icon: '🧭', name: 'URL 解析', short: 'URL 解析',
    desc: '拆解 URL 各组成部分，表格化展示查询参数（自动解码），可复制为 JSON。',
    kw: 'url 解析 query 参数 parse',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<label class="ctl"><span>URL</span><input type="text" class="u-in" placeholder="https://example.com:8443/path/to?x=1&y=%E4%B8%AD#hash" style="flex:1;min-width:240px"></label>' +
        '</div>' +
        '<div class="io-err" data-err hidden></div>' +
        '<div data-parts></div>' +
        '<div data-params></div>' +
        '<div class="btn-row"><button class="btn sm u-copy">复制 JSON</button></div>' +
        '</div>';

      var input = DT.$('.u-in', root), err = DT.$('[data-err]', root);
      var parts = DT.$('[data-parts]', root), params = DT.$('[data-params]', root);
      var lastObj = null;

      function update() {
        err.hidden = true;
        parts.innerHTML = '';
        params.innerHTML = '';
        lastObj = null;
        var v = input.value.trim();
        if (!v) return;
        var u;
        try { u = new URL(v); }
        catch (e) {
          err.textContent = '✕ 无法解析：需要完整 URL（含协议，如 https://）';
          err.hidden = false;
          return;
        }
        var rows = [
          ['协议 protocol', u.protocol], ['主机 hostname', u.hostname], ['端口 port', u.port || '(默认)'],
          ['路径 pathname', u.pathname], ['查询 search', u.search || '(无)'],
          ['哈希 hash', u.hash || '(无)'], ['来源 origin', u.origin]
        ];
        parts.innerHTML = '<table class="tb"><tbody>' +
          rows.map(function (r) { return '<tr><th style="width:110px">' + r[0] + '</th><td class="mono">' + DT.esc(r[1]) + '</td></tr>'; }).join('') +
          '</tbody></table>';

        var sp = u.searchParams;
        var keys = [];
        sp.forEach(function (_, k) { if (keys.indexOf(k) === -1) keys.push(k); });
        if (!keys.length) {
          params.innerHTML = '<p class="hint">无查询参数</p>';
          lastObj = { protocol: u.protocol, hostname: u.hostname, port: u.port, pathname: u.pathname, hash: u.hash, params: {} };
          return;
        }
        var html = '<h3 style="margin:16px 0 8px">查询参数（已解码）</h3><table class="tb"><thead><tr><th>键</th><th>值</th><th>出现次数</th></tr></thead><tbody>';
        var obj = {};
        keys.forEach(function (k) {
          var vals = sp.getAll(k);
          obj[k] = vals.length === 1 ? vals[0] : vals;
          html += '<tr><td class="mono">' + DT.esc(k) + '</td><td class="mono">' +
            vals.map(function (x) { return DT.esc(x === '' ? '<空>' : x); }).join(' ・ ') +
            '</td><td>' + vals.length + '</td></tr>';
        });
        html += '</tbody></table>';
        params.innerHTML = html;
        lastObj = { protocol: u.protocol, hostname: u.hostname, port: u.port, pathname: u.pathname, hash: u.hash, params: obj };
      }

      input.addEventListener('input', DT.debounce(update, 200));
      DT.$('.u-copy', root).addEventListener('click', function () {
        if (lastObj) DT.copy(JSON.stringify(lastObj, null, 2), this);
      });
    }
  });

  // ================= User-Agent 解析 =================
  function uaParse(ua) {
    var browser = { name: '未知', version: '' };
    [
      ['Microsoft Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
      ['Opera', /(?:OPR|Opera)[ /]([\d.]+)/],
      ['三星浏览器', /SamsungBrowser\/([\d.]+)/],
      ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
      ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
      ['Safari', /Version\/([\d.]+)[\s\S]*Safari/],
      ['IE', /(?:MSIE ([\d.]+))|(?:Trident\/[\d.]+.*?rv:([\d.]+))/]
    ].some(function (t) {
      var m = ua.match(t[1]);
      if (m) { browser = { name: t[0], version: (m[1] || m[2] || '').split('.').slice(0, 3).join('.') }; return true; }
      return false;
    });

    var engine = '未知';
    if (/Trident\//.test(ua)) engine = 'Trident';
    else if (/Gecko\/|Firefox\//.test(ua) && !/like Gecko/.test(ua)) engine = 'Gecko';
    else if (/Edg|Chrome|OPR|SamsungBrowser/.test(ua)) engine = 'Blink';
    else if (/WebKit|Safari/.test(ua)) engine = 'WebKit';

    var os = '未知';
    var mOS;
    if ((mOS = ua.match(/Windows NT ([\d.]+)/))) {
      var map = { '10.0': 'Windows 10 / 11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' };
      os = map[mOS[1]] || 'Windows (NT ' + mOS[1] + ')';
    } else if (/Android ([\d.]+)/.test(ua) && (mOS = ua.match(/Android ([\d.]+)/))) os = 'Android ' + mOS[1];
    else if ((mOS = ua.match(/(?:iPhone OS|CPU OS) ([\d_]+)/))) os = 'iOS ' + mOS[1].replace(/_/g, '.');
    else if (/iPad/.test(ua)) os = 'iPadOS';
    else if ((mOS = ua.match(/Mac OS X ([\d_.]+)/))) os = 'macOS ' + mOS[1].replace(/_/g, '.');
    else if (/Macintosh/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    var device = '桌面设备';
    if (/Mobi|iPhone|iPod/.test(ua) || /Android.+Mobile/.test(ua)) device = '手机';
    else if (/iPad|Tablet|Nexus 7|Nexus 10/.test(ua)) device = '平板';

    var bot = /bot|crawl|spider|slurp|bingpreview|lighthouse|headless/i.test(ua);
    return { browser: browser, engine: engine, os: os, device: device, bot: bot };
  }

  DT.register({
    id: 'ua-parser', cat: 'web', icon: '💻', name: 'User-Agent 解析', short: 'UA 解析',
    desc: '解析 UA 字符串中的浏览器 / 内核 / 操作系统 / 设备类型，并展示当前浏览器环境信息。',
    kw: 'user agent ua 浏览器 browser navigator',
    render: function (root) {
      root.innerHTML = '<div class="card"><h3>UA 字符串</h3>' +
        '<textarea class="ua-in" rows="3" spellcheck="false"></textarea>' +
        '<div class="btn-row"><button class="btn ua-go">解析 →</button></div>' +
        '<div data-res style="margin-top:14px"></div></div>' +
        '<div class="card"><h3>当前浏览器环境</h3><div class="stat-grid" data-env></div></div>';

      var input = DT.$('.ua-in', root), res = DT.$('[data-res]', root);
      input.value = navigator.userAgent;

      function go() {
        var r = uaParse(input.value);
        function kv(k, v) { return '<div class="kv-row"><span class="k">' + k + '</span><span class="v">' + DT.esc(v) + '</span></div>'; }
        res.innerHTML =
          kv('浏览器', r.browser.name + (r.browser.version ? ' ' + r.browser.version : '')) +
          kv('内核', r.engine) +
          kv('操作系统', r.os) +
          kv('设备类型', r.device) +
          (r.bot ? kv('爬虫标识', '检测到 bot / 自动化特征') : '');
      }
      DT.$('.ua-go', root).addEventListener('click', go);
      go();

      var env = [
        [navigator.language || '-', '语言'],
        [(navigator.languages || []).slice(0, 3).join(', ') || '-', '语言列表'],
        [navigator.platform || '-', '平台'],
        [screen.width + ' × ' + screen.height, '屏幕分辨率'],
        [window.innerWidth + ' × ' + window.innerHeight, '可视区域'],
        [(window.devicePixelRatio || 1) + 'x', '设备像素比'],
        [(navigator.hardwareConcurrency || '-') + ' 核', 'CPU 逻辑核心'],
        [Intl.DateTimeFormat().resolvedOptions().timeZone || '-', '时区'],
        [navigator.maxTouchPoints > 0 ? navigator.maxTouchPoints + ' 点' : '无', '触控'],
        [(navigator.cookieEnabled ? '是' : '否'), 'Cookie'],
        [(navigator.onLine ? '在线' : '离线'), '网络状态']
      ];
      DT.$('[data-env]', root).innerHTML = env.map(function (x) {
        return '<div class="stat-card"><div class="s-val" style="font-size:0.98rem">' + DT.esc(x[0]) + '</div><div class="s-label">' + x[1] + '</div></div>';
      }).join('');
    }
  });

  // ================= HTTP 状态码 =================
  var HTTP_CODES = [
    [100, 'Continue', '客户端应继续发送请求体'],
    [101, 'Switching Protocols', '服务器同意切换协议（如升级 WebSocket）'],
    [102, 'Processing', '服务器已收到请求，仍在处理'],
    [103, 'Early Hints', '预提示，允许在最终响应前返回部分头'],
    [200, 'OK', '请求成功'],
    [201, 'Created', '请求成功并创建了新资源'],
    [202, 'Accepted', '已接受请求，但尚未处理完成'],
    [203, 'Non-Authoritative Information', '非权威信息，来自本地或第三方副本'],
    [204, 'No Content', '成功但无返回内容'],
    [205, 'Reset Content', '成功，要求客户端重置视图'],
    [206, 'Partial Content', '部分内容（Range 请求成功）'],
    [207, 'Multi-Status', '多状态（WebDAV）'],
    [226, 'IM Used', '实例操作已被应用（Delta 编码）'],
    [300, 'Multiple Choices', '多个可选资源'],
    [301, 'Moved Permanently', '永久重定向'],
    [302, 'Found', '临时重定向'],
    [303, 'See Other', '以 GET 访问另一个地址'],
    [304, 'Not Modified', '资源未修改（缓存有效）'],
    [307, 'Temporary Redirect', '临时重定向，保持原方法'],
    [308, 'Permanent Redirect', '永久重定向，保持原方法'],
    [400, 'Bad Request', '请求语法错误'],
    [401, 'Unauthorized', '未认证（需要登录）'],
    [402, 'Payment Required', '要求付费（保留）'],
    [403, 'Forbidden', '服务器拒绝执行'],
    [404, 'Not Found', '资源不存在'],
    [405, 'Method Not Allowed', '请求方法不被允许'],
    [406, 'Not Acceptable', '无法满足 Accept 要求'],
    [407, 'Proxy Authentication Required', '需要代理认证'],
    [408, 'Request Timeout', '请求超时'],
    [409, 'Conflict', '请求冲突'],
    [410, 'Gone', '资源已永久消失'],
    [411, 'Length Required', '缺少 Content-Length'],
    [412, 'Precondition Failed', '前置条件失败'],
    [413, 'Payload Too Large', '请求体过大'],
    [414, 'URI Too Long', 'URI 过长'],
    [415, 'Unsupported Media Type', '不支持的媒体类型'],
    [416, 'Range Not Satisfiable', 'Range 无法满足'],
    [417, 'Expectation Failed', 'Expect 头失败'],
    [418, "I'm a teapot", '我是茶壶（愚人节彩蛋）'],
    [421, 'Misdirected Request', '请求发错服务器'],
    [422, 'Unprocessable Entity', '语义错误（常用于表单校验）'],
    [423, 'Locked', '资源被锁定（WebDAV）'],
    [425, 'Too Early', '过早（重放保护）'],
    [426, 'Upgrade Required', '需要升级协议'],
    [428, 'Precondition Required', '要求前置条件（If-Match）'],
    [429, 'Too Many Requests', '请求过于频繁（限流）'],
    [431, 'Request Header Fields Too Large', '请求头过大'],
    [451, 'Unavailable For Legal Reasons', '因法律原因不可用'],
    [500, 'Internal Server Error', '服务器内部错误'],
    [501, 'Not Implemented', '服务器不支持该功能'],
    [502, 'Bad Gateway', '网关错误（上游无效响应）'],
    [503, 'Service Unavailable', '服务不可用（过载 / 维护）'],
    [504, 'Gateway Timeout', '网关超时'],
    [505, 'HTTP Version Not Supported', 'HTTP 版本不支持'],
    [506, 'Variant Also Negotiates', '变体协商错误'],
    [507, 'Insufficient Storage', '存储不足（WebDAV）'],
    [508, 'Loop Detected', '检测到循环（WebDAV）'],
    [511, 'Network Authentication Required', '需要网络认证（如公共 WiFi）']
  ];

  DT.register({
    id: 'http-status', cat: 'web', icon: '📶', name: 'HTTP 状态码速查', short: '状态码速查',
    desc: '常用 HTTP 状态码中文速查表，支持按类别筛选与关键字搜索。',
    kw: 'http status code 状态码 404 500',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<input type="text" class="h-search" placeholder="搜索状态码或描述…" style="width:220px">' +
        '<div class="chip-row" style="margin:0">' +
        '<span class="chip on" data-c="*">全部</span><span class="chip" data-c="1">1xx</span>' +
        '<span class="chip" data-c="2">2xx</span><span class="chip" data-c="3">3xx</span>' +
        '<span class="chip" data-c="4">4xx</span><span class="chip" data-c="5">5xx</span>' +
        '</div></div>' +
        '<div data-list></div></div>';

      var search = DT.$('.h-search', root), list = DT.$('[data-list]', root);
      var cat = '*';

      function update() {
        var q = search.value.trim().toLowerCase();
        var items = HTTP_CODES.filter(function (c) {
          if (cat !== '*' && String(c[0]).charAt(0) !== cat) return false;
          if (!q) return true;
          return String(c[0]).indexOf(q) !== -1 || c[1].toLowerCase().indexOf(q) !== -1 || c[2].indexOf(q) !== -1;
        });
        list.innerHTML = items.length ? items.map(function (c) {
          var cls = 's' + String(c[0]).charAt(0);
          return '<div class="code-item ' + cls + '"><span class="c-num">' + c[0] + '</span>' +
            '<span class="c-name">' + c[1] + '</span><span class="c-desc">' + c[2] + '</span></div>';
        }).join('') : '<p class="hint">没有匹配的状态码</p>';
      }
      search.addEventListener('input', update);
      DT.$$('.chip', root).forEach(function (chip) {
        chip.addEventListener('click', function () {
          DT.$$('.chip', root).forEach(function (c) { c.classList.remove('on'); });
          chip.classList.add('on');
          cat = chip.getAttribute('data-c');
          update();
        });
      });
      update();
    }
  });

  // ================= 图片转 Base64 =================
  DT.register({
    id: 'img-base64', cat: 'misc', icon: '🖼️', name: '图片转 Base64', short: '图片转 Base64',
    desc: '把本地图片转为 dataURL / 纯 Base64 / CSS / HTML / Markdown 片段，全部在本地完成。',
    kw: 'image base64 dataurl 图片 内联',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="dropzone" data-dz><span class="dz-icon">🖼️</span>点击选择图片，或拖拽到此处<br><span style="font-size:0.78rem">建议小于 5 MB</span></div>' +
        '<input type="file" accept="image/*" hidden data-file>' +
        '<div data-meta style="margin-top:12px"></div>' +
        '<div style="text-align:center;margin:12px 0" data-prev></div>' +
        '<textarea class="i-out" rows="6" readonly spellcheck="false" placeholder="转换结果…"></textarea>' +
        '<div class="ctrl-row">' +
        '<label class="ctl"><span>输出格式</span><select class="i-fmt">' +
        '<option value="dataurl" selected>dataURL（完整）</option><option value="b64">纯 Base64</option>' +
        '<option value="css">CSS background</option><option value="html">HTML img 标签</option>' +
        '<option value="md">Markdown</option></select></label>' +
        '<button class="btn sm i-copy">复制</button>' +
        '</div></div>';

      var dz = DT.$('[data-dz]', root), fileInput = DT.$('[data-file]', root);
      var meta = DT.$('[data-meta]', root), prev = DT.$('[data-prev]', root);
      var out = DT.$('.i-out', root), fmt = DT.$('.i-fmt', root);
      var last = null;

      function handleFile(f) {
        if (!f) return;
        if (!/^image\//.test(f.type)) { meta.innerHTML = '<div class="io-err">不是图片文件：' + DT.esc(f.name) + '</div>'; return; }
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result;
          last = { name: f.name, type: f.type, raw: f.size, dataUrl: dataUrl, b64: dataUrl.split(',')[1] || '' };
          render();
        };
        reader.onerror = function () { meta.innerHTML = '<div class="io-err">读取文件失败</div>'; };
        reader.readAsDataURL(f);
      }

      function render() {
        if (!last) return;
        var b64Len = DT.str2u8(last.b64).length;
        meta.innerHTML =
          '<div class="kv-row"><span class="k">文件</span><span class="v">' + DT.esc(last.name) + '（' + DT.esc(last.type || '未知类型') + '）</span></div>' +
          '<div class="kv-row"><span class="k">原始大小</span><span class="v">' + DT.fmtBytes(last.raw) + '</span></div>' +
          '<div class="kv-row"><span class="k">Base64 大小</span><span class="v">' + DT.fmtBytes(b64Len) +
          '（膨胀 ' + Math.round((b64Len / Math.max(1, last.raw) - 1) * 100) + '%）</span></div>';
        prev.innerHTML = '<img class="img-preview" src="' + last.dataUrl + '" alt="预览">';
        var v = fmt.value;
        if (v === 'dataurl') out.value = last.dataUrl;
        else if (v === 'b64') out.value = last.b64;
        else if (v === 'css') out.value = 'background-image: url("' + last.dataUrl + '");';
        else if (v === 'html') out.value = '<img src="' + last.dataUrl + '" alt="' + DT.esc(last.name) + '">';
        else out.value = '![' + DT.esc(last.name) + '](' + last.dataUrl + ')';
      }

      dz.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () { handleFile(this.files[0]); });
      dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', function () { dz.classList.remove('drag'); });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.classList.remove('drag');
        handleFile(e.dataTransfer.files[0]);
      });
      fmt.addEventListener('change', render);
      DT.$('.i-copy', root).addEventListener('click', function () { DT.copy(out.value, this); });
    }
  });

  // ================= Cron 解析 =================
  var CRON_META = [
    { name: '分钟', min: 0, max: 59, unit: '分钟', every: '分钟' },
    { name: '小时', min: 0, max: 23, unit: '小时', every: '小时' },
    { name: '日', min: 1, max: 31, unit: '日', every: '天' },
    { name: '月', min: 1, max: 12, unit: '月', every: '个月', names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 } },
    { name: '星期', min: 0, max: 7, unit: '星期', every: '周', names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } }
  ];
  var DOW_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var MON_NAMES = ['', '1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'];

  function cronField(f, meta) {
    f = String(f || '').trim().replace(/\?/g, '*');
    if (!f) throw new Error(meta.name + ' 字段为空');
    if (/[LW#]/.test(f)) throw new Error('暂不支持高级语法 L / W / #' + '（字段：' + meta.name + '）');
    var set = {};
    f.split(',').forEach(function (part) {
      part = part.trim();
      if (!part) throw new Error(meta.name + ' 字段包含空片段');
      var step = 1, body = part;
      var slash = part.split('/');
      if (slash.length === 2) {
        body = slash[0];
        step = parseInt(slash[1], 10);
        if (!(step >= 1)) throw new Error(meta.name + ' 字段步长必须 ≥ 1');
      } else if (slash.length > 2) throw new Error(meta.name + ' 字段格式错误：' + part);
      function val(tk) {
        if (tk === '' || tk === '*') return null;
        if (meta.names && meta.names[tk.toLowerCase()] !== undefined) return meta.names[tk.toLowerCase()];
        if (/^\d+$/.test(tk)) return parseInt(tk, 10);
        throw new Error(meta.name + ' 字段中的无效值：' + tk);
      }
      var lo, hi;
      if (body === '*') { lo = meta.min; hi = meta.max; }
      else if (body.indexOf('-') !== -1) {
        var seg = body.split('-');
        lo = val(seg[0]); hi = val(seg[1]);
      } else {
        var v = val(body);
        lo = hi = v;
        if (slash.length === 2) hi = meta.max; // 单值/步长：5/15 → 从 5 开始
      }
      if (lo === null || hi === null) throw new Error(meta.name + ' 字段范围不完整');
      if (lo < meta.min || hi > meta.max || lo > hi) {
        throw new Error(meta.name + ' 取值应在 ' + meta.min + '-' + meta.max + ' 之间');
      }
      for (var x = lo; x <= hi; x += step) {
        var y = x;
        if (meta.max === 7 && y === 7) y = 0; // 周日可写 0 或 7，归一为 0
        set[y] = true;
      }
    });
    return set;
  }

  function cronDesc(fields) {
    // 逐字段生成人类可读描述
    function fmtNums(set, idx) {
      var vals = Object.keys(set).map(Number).filter(function (v) { return set[v]; }).sort(function (a, b) { return a - b; });
      if (idx === 4) return vals.map(function (v) { return DOW_NAMES[v]; }).join('、');
      if (idx === 3) return vals.map(function (v) { return MON_NAMES[v]; }).join('、');
      return vals.join('、');
    }
    var parts = [];
    var allStar = fields.every(function (f) { return /^\s*[\*?]\s*$/.test(f); });
    if (allStar) return '每分钟执行一次';
    fields.forEach(function (f, idx) {
      var meta = CRON_META[idx];
      var t = f.trim();
      var d, m2;
      if (/^[\*?]$/.test(t)) d = '每' + meta.unit;
      else if ((m2 = t.match(/^\*\/(\d+)$/))) d = '每 ' + m2[1] + ' ' + (idx === 0 ? '分钟' : meta.unit);
      else if (/^\d+$/.test(t)) d = (idx === 4 ? DOW_NAMES[+t % 7] : idx === 3 ? MON_NAMES[+t] : '第 ' + t + ' ' + meta.unit);
      else d = fmtNums(cronField(f, meta), idx);
      parts.push('<b>' + meta.name + '</b>：' + d);
    });
    return parts.join('；');
  }

  DT.register({
    id: 'cron', cat: 'misc', icon: '⏰', name: 'Cron 表达式解析', short: 'Cron 解析',
    desc: '解析 5 段式 Cron 表达式（分 时 日 月 周），给出中文描述、字段展开与未来 5 次运行时间。',
    kw: 'cron crontab 定时 任务 计划',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<label class="ctl"><span>表达式</span><input type="text" class="c-in" value="*/15 9-18 * * 1-5" style="width:240px"></label>' +
        '<button class="btn c-go">解析 →</button>' +
        '<span class="hint" style="margin:0">支持 * , - / ? 与英文月 / 周名</span>' +
        '</div>' +
        '<div class="io-err" data-err hidden></div>' +
        '<div data-desc></div><div data-next></div></div>';

      var input = DT.$('.c-in', root), err = DT.$('[data-err]', root);
      var desc = DT.$('[data-desc]', root), next = DT.$('[data-next]', root);

      function go() {
        err.hidden = true; desc.innerHTML = ''; next.innerHTML = '';
        var fields = input.value.trim().split(/\s+/);
        if (fields.length !== 5) {
          err.textContent = '✕ 需要 5 个字段：分 时 日 月 周（当前 ' + fields.length + ' 个）';
          err.hidden = false; return;
        }
        var sets;
        try {
          sets = fields.map(function (f, i) { return cronField(f, CRON_META[i]); });
        } catch (e) {
          err.textContent = '✕ ' + e.message;
          err.hidden = false; return;
        }

        // 未来 5 次运行
        var isFull = fields.map(function (f) { return /^\s*[\*?]\s*$/.test(f); });
        var results = [];
        var d = new Date(Math.ceil((Date.now() + 1) / 60000) * 60000);
        var guard = 0;
        while (results.length < 5 && guard++ < 527040) {
          var ok = sets[0][d.getMinutes()] && sets[1][d.getHours()];
          var domOK = sets[2][d.getDate()], monOK = sets[3][d.getMonth() + 1];
          var dow = d.getDay();
          var dowOK = sets[4][dow];
          if (!isFull[2] && !isFull[4]) {
            ok = ok && monOK && (domOK || dowOK); // 日与周均受限时按 OR
          } else {
            ok = ok && monOK && domOK && dowOK;
          }
          if (ok) results.push(DT.fmtLocal(d) + '（星期' + '日一二三四五六'[d.getDay()] + '）');
          d = new Date(d.getTime() + 60000);
        }

        desc.innerHTML = '<div class="io-ok" style="margin:0 0 12px">' + cronDesc(fields) + '</div>' +
          '<table class="tb"><thead><tr><th>字段</th><th>允许范围</th><th>展开</th></tr></thead><tbody>' +
          fields.map(function (f, i) {
            var meta = CRON_META[i];
            var vals = Object.keys(sets[i]).filter(function (k) { return sets[i][k]; }).map(Number).sort(function (a, b) { return a - b; });
            return '<tr><td>' + meta.name + '（' + DT.esc(f) + '）</td><td>' + meta.min + '-' + meta.max + '</td><td class="mono">' +
              vals.join(', ') + '</td></tr>';
          }).join('') +
          '</tbody></table>';
        next.innerHTML = results.length
          ? '<h3 style="margin:16px 0 8px">未来 5 次运行</h3>' + results.map(function (s) {
            return '<div class="kv-row"><span class="k">下次</span><span class="v">' + s + '</span></div>';
          }).join('')
          : '<p class="hint">一年内未找到运行时间，请检查表达式</p>';
      }

      DT.$('.c-go', root).addEventListener('click', go);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      go();
    }
  });

  // ================= Markdown 预览 =================
  function mdRender(src) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [];
    var listStack = [];

    function esc(s) { return DT.esc(s); }
    function safeUrl(u) {
      return /^(https?:|mailto:|#|\/|\.{0,2}\/)/i.test(u) ? esc(u) : '#';
    }
    function inline(s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, u) { return '<img src="' + safeUrl(u) + '" alt="' + alt + '">'; });
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t2, u) { return '<a href="' + safeUrl(u) + '" target="_blank" rel="noopener">' + t2 + '</a>'; });
      s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
      s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      return s;
    }
    function flushPara() {
      if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
    }
    function closeLists(toDepth) {
      while (listStack.length > toDepth) out.push('</' + listStack.pop() + '>');
    }
    function splitRow(row) {
      row = row.trim().replace(/^\|/, '').replace(/\|$/, '');
      return row.split('|').map(function (s2) { return s2.trim(); });
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^```/.test(line)) {
        flushPara(); closeLists(0);
        var lang = line.slice(3).trim();
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        out.push('<pre><code' + (lang ? ' class="lang-' + esc(lang) + '"' : '') + '>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); closeLists(0); var n = h[1].length; out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); continue; }
      if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flushPara(); closeLists(0); out.push('<hr>'); continue; }
      if (/^ {0,3}>/.test(line)) {
        flushPara(); closeLists(0);
        var quote = [];
        while (i < lines.length && /^ {0,3}>/.test(lines[i])) { quote.push(lines[i].replace(/^ {0,3}>\s?/, '')); i++; }
        i--;
        out.push('<blockquote>' + mdRender(quote.join('\n')) + '</blockquote>');
        continue;
      }
      if (line.indexOf('|') !== -1 && i + 1 < lines.length &&
        /^[\s|:-]+$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1) {
        flushPara(); closeLists(0);
        var headCells = splitRow(line);
        i += 2;
        var bodyRows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim() !== '') {
          bodyRows.push(splitRow(lines[i])); i++;
        }
        i--;
        var table = '<table><thead><tr>' + headCells.map(function (c2) { return '<th>' + inline(c2) + '</th>'; }).join('') + '</tr></thead><tbody>';
        bodyRows.forEach(function (r) {
          table += '<tr>' + r.map(function (c2) { return '<td>' + inline(c2) + '</td>'; }).join('') + '</tr>';
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
        while (listStack.length > depth + 1 || (listStack.length === depth + 1 && listStack[depth] !== tag)) {
          out.push('</' + listStack.pop() + '>');
        }
        while (listStack.length < depth + 1) { listStack.push(tag); out.push('<' + tag + '>'); }
        out.push('<li>' + inline(li[3]) + '</li>');
        continue;
      }
      if (line.trim() === '') { flushPara(); closeLists(0); continue; }
      para.push(line);
    }
    flushPara();
    closeLists(0);
    return out.join('\n');
  }
  DT._t.mdRender = mdRender;

  DT.register({
    id: 'markdown', cat: 'misc', icon: '📝', name: 'Markdown 预览', short: 'Markdown 预览',
    desc: '实时预览常用 Markdown 子集：标题、列表、表格、代码块、引用、链接图片、粗斜体删除线。',
    kw: 'markdown md 预览 render',
    render: function (root) {
      var SAMPLE = '# Markdown 示例\n\n支持 **粗体**、*斜体*、~~删除线~~、`行内代码` 和 [链接](https://example.com)。\n\n## 列表\n\n- 无序列表项一\n- 无序列表项二\n  - 嵌套项\n\n1. 有序列表\n2. 第二项\n\n## 表格\n\n| 工具 | 分类 | 说明 |\n| --- | --- | --- |\n| Base64 | 编码 | 互转 |\n| MD5 | 哈希 | 摘要 |\n\n> 引用：数据全部本地处理\n\n```js\n// 代码块\nconsole.log("hello");\n```\n\n---\n\n以上均可实时编辑左侧内容查看效果。';
      root.innerHTML = '<div class="card">' +
        '<div class="btn-row" style="margin:0 0 10px"><button class="btn sm m-demo">载入示例</button></div>' +
        '<div class="grid2">' +
        '<textarea class="m-in" rows="16" spellcheck="false" placeholder="输入 Markdown…"></textarea>' +
        '<div class="md-preview" data-prev></div>' +
        '</div></div>';

      var input = DT.$('.m-in', root), prev = DT.$('[data-prev]', root);
      function update() { prev.innerHTML = mdRender(input.value); }
      input.addEventListener('input', DT.debounce(update, 200));
      DT.$('.m-demo', root).addEventListener('click', function () {
        input.value = SAMPLE;
        update();
      });
      input.value = SAMPLE;
      update();
    }
  });

  // ---------- 启动（仅浏览器环境） ----------
  if (typeof document !== 'undefined' && typeof DT.boot === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { DT.boot(); });
    } else {
      DT.boot();
    }
  }
})();
