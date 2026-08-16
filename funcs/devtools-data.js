// ============================================================
//  devtools-data.js — JSON / 数据格式 + 文本处理 + 转换计算 工具
//  JSON 格式化、JSON 转义、JSON↔CSV、YAML、大小写转换、文本清洗、
//  字数统计、假文生成、文本 Diff、进制转换、时间戳、颜色转换
// ============================================================
(function () {
  'use strict';
  var DT = window.DT;

  // ================= JSON 格式化 =================
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) { o[k] = sortKeys(v[k]); });
      return o;
    }
    return v;
  }

  function jsonParseErr(t) {
    try {
      return { ok: true, val: JSON.parse(t) };
    } catch (e) {
      var msg = (e && e.message) || String(e);
      var lineCol = '';
      var m = String(msg).match(/position (\d+)/);
      if (m) {
        var pos = parseInt(m[1], 10);
        var before = t.slice(0, pos);
        var line = before.split('\n').length;
        var col = pos - before.lastIndexOf('\n');
        lineCol = '（约在第 ' + line + ' 行第 ' + col + ' 列）';
      } else {
        var m2 = String(msg).match(/line (\d+) column (\d+)/);
        if (m2) lineCol = '（第 ' + m2[1] + ' 行第 ' + m2[2] + ' 列）';
      }
      return { ok: false, err: 'JSON 解析失败：' + msg + lineCol };
    }
  }

  DT.ioTool({
    id: 'json-format', cat: 'data', icon: '🧾', name: 'JSON 格式化 / 压缩 / 校验', short: 'JSON 格式化',
    desc: '格式化（缩进可选）、压缩为单行、校验有效性并定位错误行列；可按 key 递归排序。',
    kw: 'json format beautify minify pretty 校验 格式化 压缩',
    ph: '粘贴 JSON…',
    rows: 6, orows: 8,
    controls: function (row) {
      return {
        indent: DT.ctrlSelect(row, '缩进', [
          { v: '2', t: '2 空格' }, { v: '4', t: '4 空格' }, { v: 'tab', t: 'Tab' }
        ], '2'),
        sort: DT.ctrlCheck(row, '按 key 排序', false)
      };
    },
    actions: [
      {
        label: '格式化', fn: function (t, ctrls) {
          var r = jsonParseErr(t);
          if (!r.ok) throw new Error(r.err);
          var v = ctrls.sort() ? sortKeys(r.val) : r.val;
          var ind = ctrls.indent() === 'tab' ? '\t' : parseInt(ctrls.indent(), 10);
          return JSON.stringify(v, null, ind);
        }
      },
      {
        label: '压缩', cls: 'ghost', fn: function (t) {
          var r = jsonParseErr(t);
          if (!r.ok) throw new Error(r.err);
          return JSON.stringify(r.val);
        }
      },
      {
        label: '校验', cls: 'ghost', fn: function (t) {
          var r = jsonParseErr(t);
          if (!r.ok) throw new Error(r.err);
          var v = r.val;
          var kind = Array.isArray(v) ? '数组（' + v.length + ' 项）' :
            (v && typeof v === 'object') ? '对象（' + Object.keys(v).length + ' 个键）' : typeof v;
          return '✓ JSON 有效，顶层类型：' + kind;
        }
      }
    ]
  });

  // ================= JSON 转义 =================
  DT.ioTool({
    id: 'json-escape', cat: 'data', icon: '↩️', name: 'JSON 转义 / 反转义', short: 'JSON 转义',
    desc: '把多行文本转为 JSON 字符串字面量（处理 \\n、引号等），或把 JSON 字符串内容还原为普通文本。',
    kw: 'json escape unescape 转义 字符串',
    ph: '转义：输入普通文本；反转义：输入 "a\\nb" 或 a\\nb…',
    swap: true,
    controls: function (row) {
      return { noquote: DT.ctrlCheck(row, '转义结果去掉首尾引号', true) };
    },
    actions: [
      {
        label: '转义 →', fn: function (t, ctrls) {
          var s = JSON.stringify(t);
          return ctrls.noquote() ? s.slice(1, -1) : s;
        }
      },
      {
        label: '← 反转义', cls: 'ghost', fn: function (t) {
          var s = t.trim();
          if (!s) return '';
          if (s.charAt(0) === '"') {
            try { return JSON.parse(s); } catch (e) { throw new Error('不是合法的 JSON 字符串：' + e.message); }
          }
          var inner = s.replace(/\r\n|\r|\n/g, '\\n').replace(/\t/g, '\\t');
          try { return JSON.parse('"' + inner + '"'); } catch (e) { throw new Error('反转义失败：' + e.message); }
        }
      }
    ]
  });

  // ================= JSON ↔ CSV =================
  function csvParse(text, d) {
    var rows = [], row = [], cur = '', q = false, i, c;
    text = text.replace(/\r\n?/g, '\n');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += c;
      } else if (c === '"') {
        q = true;
      } else if (c === d) {
        row.push(cur); cur = '';
      } else if (c === '\n') {
        row.push(cur); cur = '';
        rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    while (rows.length && rows[rows.length - 1].every(function (x) { return x === ''; })) rows.pop();
    return rows;
  }

  function csvStringify(rows, d) {
    function cell(x) {
      var s = (x === null || x === undefined) ? '' :
        (typeof x === 'object' ? JSON.stringify(x) : String(x));
      if (new RegExp('["\\n\\r' + (d === '\t' ? '\\t' : d) + ']').test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }
    return rows.map(function (r) { return r.map(cell).join(d); }).join('\n');
  }

  DT._t.csvParse = csvParse; DT._t.csvStringify = csvStringify;

  DT.ioTool({
    id: 'json-csv', cat: 'data', icon: '📊', name: 'JSON ↔ CSV 互转', short: 'JSON ↔ CSV',
    desc: '对象数组转为带表头的 CSV（自动合并所有键），或 CSV 转为 JSON 数组；支持逗号 / 制表符 / 分号分隔，正确处理引号转义。',
    kw: 'csv excel 表格 转换 tsv',
    ph: 'JSON→CSV：粘贴 JSON 数组；CSV→JSON：粘贴 CSV 文本…',
    swap: true, rows: 6, orows: 8,
    controls: function (row) {
      return {
        d: DT.ctrlSelect(row, '分隔符', [
          { v: ',', t: '逗号 ,' }, { v: '\t', t: '制表符 Tab' }, { v: ';', t: '分号 ;' }
        ], ','),
        header: DT.ctrlCheck(row, 'CSV→JSON 首行为表头', true)
      };
    },
    actions: [
      {
        label: 'JSON → CSV', fn: function (t, ctrls) {
          var d = ctrls.d();
          var r = jsonParseErr(t);
          if (!r.ok) throw new Error(r.err);
          var v = r.val;
          if (!Array.isArray(v)) throw new Error('JSON 顶层必须是数组（对象数组或二维数组）');
          if (!v.length) return '';
          var rows;
          if (v.every(function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); })) {
            var keys = [];
            v.forEach(function (o) {
              Object.keys(o).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
            });
            rows = [keys].concat(v.map(function (o) {
              return keys.map(function (k) { return o.hasOwnProperty(k) ? o[k] : ''; });
            }));
          } else if (v.every(function (x) { return Array.isArray(x); })) {
            rows = v;
          } else {
            rows = v.map(function (x) { return [x]; });
          }
          return csvStringify(rows, d);
        }
      },
      {
        label: '← CSV 转 JSON', cls: 'ghost', fn: function (t, ctrls) {
          if (!t.trim()) throw new Error('请输入 CSV 文本');
          var rows = csvParse(t, ctrls.d());
          if (!rows.length) return '[]';
          var out;
          if (ctrls.header()) {
            var head = rows[0];
            out = rows.slice(1).map(function (r) {
              var o = {};
              head.forEach(function (k, i) { o[k] = r[i] !== undefined ? r[i] : ''; });
              return o;
            });
          } else {
            out = rows;
          }
          return JSON.stringify(out, null, 2);
        }
      }
    ]
  });

  // ================= YAML（常用子集） =================
  function yamlStripComment(s) {
    var q = null;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
    }
    return s;
  }

  function yamlScalar(s) {
    if (s === '' || s === '~') return null;
    if (/^(null|Null|NULL)$/.test(s)) return null;
    if (/^(true|True|TRUE)$/.test(s)) return true;
    if (/^(false|False|FALSE)$/.test(s)) return false;
    if (/^".*"$/.test(s)) {
      try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); }
    }
    if (/^'.*'$/.test(s)) return s.slice(1, -1).replace(/''/g, "'");
    if (/^[-+]?\d+$/.test(s)) return parseInt(s, 10);
    if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(s) && /[.eE]/.test(s)) return parseFloat(s);
    if (s.charAt(0) === '[' || s.charAt(0) === '{') {
      try { return JSON.parse(s.replace(/'/g, '"')); } catch (e) { /* 按字符串处理 */ }
    }
    return s;
  }

  function yamlKey(s) {
    s = s.trim();
    if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return yamlScalar(s);
    return s;
  }

  function yamlIsKV(s) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false; // URL
    return /^[^:\s"'][^:]*:(\s|$)/.test(s) || /^"[^"]*":\s/.test(s) || /^'[^']*':\s/.test(s);
  }

  function yamlParse(text) {
    var raw = String(text).replace(/\r\n?/g, '\n').split('\n');
    var lines = [];
    raw.forEach(function (ln) {
      var ind = (ln.match(/^ */) || [''])[0].length;
      var s = ln.trim();
      if (!s || s.charAt(0) === '#') return;
      s = yamlStripComment(s).trim();
      if (!s) return;
      lines.push({ ind: ind, s: s });
    });
    var res = parseBlock(0, 0);
    if (res[1] < lines.length) {
      throw new Error('无法解析行：「' + lines[res[1]].s + '」（缩进或语法不符合支持的 YAML 子集）');
    }
    return res[0];

    function parseBlock(i, ind) {
      if (i >= lines.length || lines[i].ind < ind) return [null, i];
      if (/^-( |$)/.test(lines[i].s)) return parseSeq(i, ind);
      return parseMap(i, ind);
    }

    function parseSeq(i, ind) {
      var arr = [];
      while (i < lines.length && lines[i].ind === ind && /^-( |$)/.test(lines[i].s)) {
        var rest = lines[i].s.replace(/^-\s*/, '');
        if (rest === '') {
          i++;
          if (i < lines.length && lines[i].ind > ind) {
            var child = parseBlock(i, lines[i].ind);
            arr.push(child[0]); i = child[1];
          } else arr.push(null);
        } else if (yamlIsKV(rest)) {
          // '- key: value' 形式的映射项：重写为缩进 +2 后按映射解析
          lines[i] = { ind: ind + 2, s: rest };
          var m = parseBlock(i, ind + 2);
          arr.push(m[0]); i = m[1];
        } else {
          arr.push(yamlScalar(rest));
          i++;
        }
      }
      return [arr, i];
    }

    function parseMap(i, ind) {
      var obj = {};
      while (i < lines.length && lines[i].ind === ind) {
        if (/^-( |$)/.test(lines[i].s)) break;
        var mm = lines[i].s.match(/^("[^"]*"|'[^']*'|[^:]+):(?:\s+(.*))?$/);
        if (!mm) throw new Error('无法解析行：「' + lines[i].s + '」（缺少 key: 结构）');
        var key = yamlKey(mm[1]);
        var valS = (mm[2] || '').trim();
        if (valS === '') {
          var ni = i + 1;
          if (ni < lines.length && lines[ni].ind > ind) {
            var child = parseBlock(ni, lines[ni].ind);
            obj[key] = child[0]; i = child[1];
          } else if (ni < lines.length && lines[ni].ind === ind && /^-( |$)/.test(lines[ni].s)) {
            var seq = parseSeq(ni, ind);
            obj[key] = seq[0]; i = seq[1];
          } else {
            obj[key] = null; i++;
          }
        } else {
          obj[key] = yamlScalar(valS);
          i++;
        }
      }
      return [obj, i];
    }
  }

  function yamlStr(v) {
    function scalarOut(x) {
      if (x === null || x === undefined) return 'null';
      if (typeof x === 'number' || typeof x === 'boolean') return String(x);
      return quote(String(x));
    }
    function quote(s) {
      if (s === '') return '""';
      if (/[:#{}\[\],&*?|>%@`"'!\n]|\s$|^\s/.test(s) ||
        /^(null|true|false|~|-?\d+(\.\d+)?([eE][-+]?\d+)?)$/i.test(s) ||
        /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
        return JSON.stringify(s);
      }
      return s;
    }
    function emitMap(o, ind) {
      return Object.keys(o).map(function (k) {
        var val = o[k];
        var pad = new Array(ind + 1).join('  ');
        if (val && typeof val === 'object' &&
          ((Array.isArray(val) && val.length) || (!Array.isArray(val) && Object.keys(val).length))) {
          return pad + quote(k) + ':' + emitBlock(val, ind);
        }
        return pad + quote(k) + ': ' + (val && typeof val === 'object' ? (Array.isArray(val) ? '[]' : '{}') : scalarOut(val));
      }).join('\n');
    }
    function firstLineAfterDash(block, ind) {
      var pad = new Array(ind + 1).join('  ');
      var ls = block.split('\n');
      ls[0] = pad + '- ' + ls[0].slice(2);
      return ls.join('\n');
    }
    function emitSeq(a, ind) {
      return a.map(function (item) {
        var pad = new Array(ind + 1).join('  ');
        if (item && typeof item === 'object') {
          if (Array.isArray(item)) {
            if (!item.length) return pad + '- []';
            return firstLineAfterDash(emitSeq(item, ind + 1), ind);
          }
          if (!Object.keys(item).length) return pad + '- {}';
          return firstLineAfterDash(emitMap(item, ind + 1), ind);
        }
        return pad + '- ' + scalarOut(item);
      }).join('\n');
    }
    function emitBlock(val, ind) {
      if (Array.isArray(val)) return '\n' + emitSeq(val, ind);        // 序列与键同缩进
      return '\n' + emitMap(val, ind + 1);                             // 映射缩进 +1 级
    }
    if (v === null || typeof v !== 'object') return scalarOut(v);
    if (Array.isArray(v)) return v.length ? emitSeq(v, 0) : '[]';
    return Object.keys(v).length ? emitMap(v, 0) : '{}';
  }

  DT._t.yamlParse = yamlParse; DT._t.yamlStr = yamlStr;

  DT.ioTool({
    id: 'yaml', cat: 'data', icon: '📄', name: 'YAML ↔ JSON 转换', short: 'YAML 转换',
    desc: '常用 YAML 子集与 JSON 互转：支持嵌套映射 / 列表 / 引号字符串 / 注释 / 数字布尔空值。不支持锚点、多行文本块等高级语法。',
    kw: 'yaml 配置 config 转换',
    ph: 'YAML→JSON：粘贴 YAML；JSON→YAML：粘贴 JSON…',
    swap: true, rows: 6, orows: 8,
    actions: [
      {
        label: 'YAML → JSON', fn: function (t) {
          if (!t.trim()) throw new Error('请输入内容');
          return JSON.stringify(yamlParse(t), null, 2);
        }
      },
      {
        label: '← JSON 转 YAML', cls: 'ghost', fn: function (t) {
          var r = jsonParseErr(t);
          if (!r.ok) throw new Error(r.err);
          return yamlStr(r.val);
        }
      }
    ]
  });

  // ================= 大小写转换 =================
  DT.ioTool({
    id: 'case', cat: 'text', icon: '🔠', name: '命名风格 / 大小写转换', short: '大小写转换',
    desc: '识别驼峰、下划线、连字符等边界，转换为 camelCase / snake_case / CONSTANT_CASE / kebab-case 等风格；逐行处理。',
    kw: 'case camel snake kebab pascal 大小写 命名',
    ph: '输入要转换的文本（逐行处理）…',
    controls: function (row) {
      return {
        style: DT.ctrlSelect(row, '目标风格', [
          { v: 'camel', t: 'camelCase 小驼峰' },
          { v: 'pascal', t: 'PascalCase 大驼峰' },
          { v: 'snake', t: 'snake_case 下划线' },
          { v: 'constant', t: 'CONSTANT_CASE 常量' },
          { v: 'kebab', t: 'kebab-case 连字符' },
          { v: 'title', t: 'Title Case 标题' },
          { v: 'sentence', t: 'Sentence case 句子' },
          { v: 'lower', t: 'lowercase 全小写' },
          { v: 'upper', t: 'UPPERCASE 全大写' }
        ], 'camel')
      };
    },
    actions: [
      {
        label: '转换 →', fn: function (t, ctrls) {
          var style = ctrls.style();
          function words(s) {
            return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
              .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
              .split(/[\s_\-.]+/).filter(Boolean);
          }
          function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
          return t.split('\n').map(function (line) {
            var ws = words(line);
            if (!ws.length) return '';
            switch (style) {
              case 'camel': return ws.map(function (w, i) { return i ? cap(w) : w.toLowerCase(); }).join('');
              case 'pascal': return ws.map(cap).join('');
              case 'snake': return ws.map(function (w) { return w.toLowerCase(); }).join('_');
              case 'constant': return ws.map(function (w) { return w.toUpperCase(); }).join('_');
              case 'kebab': return ws.map(function (w) { return w.toLowerCase(); }).join('-');
              case 'title': return ws.map(cap).join(' ');
              case 'sentence': {
                var s = line.toLowerCase();
                return s.charAt(0).toUpperCase() + s.slice(1);
              }
              case 'lower': return line.toLowerCase();
              case 'upper': return line.toUpperCase();
            }
            return line;
          }).join('\n');
        }
      }
    ]
  });

  // ================= 文本清洗 =================
  DT.ioTool({
    id: 'text-clean', cat: 'text', icon: '🧽', name: '文本清洗', short: '文本清洗',
    desc: '按行清洗文本：去首尾空格、删空行、去重、排序、反转、统一换行；按顺序依次应用。',
    kw: 'clean 去重 排序 trim 空行 dedupe',
    ph: '粘贴要清洗的文本…',
    rows: 6, orows: 6,
    controls: function (row) {
      return {
        unify: DT.ctrlCheck(row, '统一换行符为 \\n', true),
        trim: DT.ctrlCheck(row, '行首尾去空格', true),
        empty: DT.ctrlCheck(row, '删除空行', true),
        dedupe: DT.ctrlCheck(row, '删除重复行（保留首次）', false),
        sort: DT.ctrlSelect(row, '排序', [
          { v: '', t: '不排序' }, { v: 'asc', t: '升序（自然）' },
          { v: 'desc', t: '降序（自然）' }, { v: 'len', t: '按长度' }
        ], ''),
        rev: DT.ctrlCheck(row, '反转行序', false)
      };
    },
    actions: [
      {
        label: '清洗 →', fn: function (t, ctrls) {
          var s = t;
          if (ctrls.unify()) s = s.replace(/\r\n?/g, '\n');
          var lines = s.split('\n');
          if (ctrls.trim()) lines = lines.map(function (l) { return l.trim(); });
          if (ctrls.empty()) lines = lines.filter(function (l) { return l !== ''; });
          if (ctrls.dedupe()) {
            var seen = {};
            lines = lines.filter(function (l) {
              if (seen[l]) return false;
              seen[l] = 1; return true;
            });
          }
          var sort = ctrls.sort();
          if (sort === 'asc') lines.sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN', { numeric: true }); });
          if (sort === 'desc') lines.sort(function (a, b) { return b.localeCompare(a, 'zh-Hans-CN', { numeric: true }); });
          if (sort === 'len') lines.sort(function (a, b) { return a.length - b.length || a.localeCompare(b); });
          if (ctrls.rev()) lines.reverse();
          return lines.join('\n');
        }
      }
    ]
  });

  // ================= 字数统计 =================
  DT.register({
    id: 'text-count', cat: 'text', icon: '🔢', name: '字数统计', short: '字数统计',
    desc: '实时统计字符、字节、行数、单词（英文按词、中文按字）、句子等信息。',
    kw: 'count 字数 统计 words characters',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<textarea class="cnt-input" rows="7" spellcheck="false" placeholder="输入或粘贴文本，实时统计…"></textarea>' +
        '<div class="stat-grid" style="margin-top:14px"></div>' +
        '<p class="hint">说明：UTF-8 字节数即网络传输大小；单词数 = 英文单词数 + 中文字符数；空文本也计入统计。</p>' +
        '</div>';
      var input = DT.$('.cnt-input', root);
      var grid = DT.$('.stat-grid', root);

      function update() {
        var s = input.value;
        var cjk = (s.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
        var latinWords = (s.match(/[A-Za-z0-9''\-]+/g) || []).length;
        var noWs = s.replace(/\s/g, '');
        var lines = s === '' ? 0 : s.split('\n').length;
        var nonEmpty = s.split('\n').filter(function (l) { return l.trim() !== ''; }).length;
        var sentences = (s.match(/[.!?\u3002\uff01\uff01?]+/g) || []).length;
        var longest = s.split('\n').reduce(function (m, l) { return Math.max(m, l.length); }, 0);
        var stats = [
          [s.length, '字符数（含空白）'],
          [noWs.length, '字符数（不含空白）'],
          [DT.str2u8(s).length, '字节（UTF-8）'],
          [lines, '总行数'],
          [nonEmpty, '非空行'],
          [latinWords + cjk, '单词 / 字数'],
          [cjk, '中文字符'],
          [(s.match(/[A-Za-z]/g) || []).length, '英文字母'],
          [(s.match(/\d/g) || []).length, '数字'],
          [sentences, '句子（。！？.!?）'],
          [longest, '最长行字符数']
        ];
        grid.innerHTML = stats.map(function (x) {
          return '<div class="stat-card"><div class="s-val">' + x[0] + '</div><div class="s-label">' + x[1] + '</div></div>';
        }).join('');
      }
      input.addEventListener('input', update);
      update();
    }
  });

  // ================= 假文生成 =================
  var LOREM = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
    'enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit ' +
    'voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt ' +
    'mollit anim id est laborum').split(' ');
  var ZHWORDS = ('我们 一起 走过 那些 年轻 的 日子 时间 如 白驹 过隙 忽然 而是 一场 大雨 淋湿 整个 夏天 记忆 里 灯火 通明 街道 上 人们 匆匆 脚步 声 回荡 在 深夜 巷口 猫 坐在 屋顶 看 月亮 星星 洒落 银色 光辉 世界 安静 仿佛 听见 风声 树叶 沙沙 作响 远处 传来 熟悉 歌声 让人 想起 从前 故事 结尾 总是 美好 温暖 阳光 透过 窗户 照进 房间 咖啡 香气 弥漫 空气 书页 翻动 声音 时光 缓缓 流淌').split(' ');

  DT.ioTool({
    id: 'lorem', cat: 'text', icon: '🖋️', name: '假文生成（Lorem / 中文）', short: '假文生成',
    desc: '生成占位假文：拉丁 Lorem Ipsum 或中文假文，按段落 / 句子 / 单词输出，用于排版填充。',
    kw: 'lorem ipsum 假文 占位 placeholder',
    ph: '无需输入，点击下方按钮生成…',
    orows: 8,
    controls: function (row) {
      return {
        type: DT.ctrlSelect(row, '类型', [
          { v: 'para', t: '段落' }, { v: 'sent', t: '句子' }, { v: 'word', t: '单词' }
        ], 'para'),
        n: DT.ctrlNumber(row, '数量', 3, 1, 100),
        zh: DT.ctrlCheck(row, '中文假文', false),
        loremStart: DT.ctrlCheck(row, '以 Lorem ipsum 开头', true)
      };
    },
    actions: [
      {
        label: '生成 →', fn: function (t, ctrls) {
          var n = ctrls.n() || 3;
          var zh = ctrls.zh();
          var bank = zh ? ZHWORDS : LOREM;
          function word() { return bank[Math.floor(Math.random() * bank.length)]; }
          function sentence() {
            var len = 8 + Math.floor(Math.random() * 7);
            var ws = [];
            for (var i = 0; i < len; i++) ws.push(word());
            if (zh) return ws.join('') + '。';
            var s = ws.join(' ');
            return s.charAt(0).toUpperCase() + s.slice(1) + '.';
          }
          function para() {
            var sc = 3 + Math.floor(Math.random() * 3);
            var parts = [];
            for (var i = 0; i < sc; i++) parts.push(sentence());
            return parts.join(zh ? '' : ' ');
          }
          var type = ctrls.type();
          if (type === 'word') {
            var ws = [];
            for (var i = 0; i < n; i++) ws.push(word());
            if (!zh && ctrls.loremStart() && n >= 2) { ws[0] = 'lorem'; ws[1] = 'ipsum'; }
            return ws.join(' ');
          }
          if (type === 'sent') {
            var ss = [];
            for (var j = 0; j < n; j++) ss.push(sentence());
            return ss.join(zh ? '' : ' ');
          }
          var ps = [];
          for (var k = 0; k < n; k++) ps.push(para());
          return ps.join('\n\n');
        }
      }
    ]
  });

  // ================= 文本 Diff =================
  function diffLines(aText, bText) {
    var A = aText.split('\n'), B = bText.split('\n');
    var truncated = false;
    var CAP = 1500;
    if (A.length > CAP || B.length > CAP) {
      A = A.slice(0, CAP); B = B.slice(0, CAP); truncated = true;
    }
    var n = A.length, m = B.length;
    var dp = new Uint32Array((n + 1) * (m + 1));
    for (var i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i * (m + 1) + j] = A[i] === B[j]
          ? dp[(i + 1) * (m + 1) + j + 1] + 1
          : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
      }
    }
    var ops = [];
    var x = 0, y = 0;
    while (x < n && y < m) {
      if (A[x] === B[y]) { ops.push(['=', A[x]]); x++; y++; }
      else if (dp[(x + 1) * (m + 1) + y] >= dp[x * (m + 1) + y + 1]) { ops.push(['-', A[x]]); x++; }
      else { ops.push(['+', B[y]]); y++; }
    }
    while (x < n) { ops.push(['-', A[x]]); x++; }
    while (y < m) { ops.push(['+', B[y]]); y++; }
    return { ops: ops, truncated: truncated };
  }
  DT._t.diffLines = diffLines;

  DT.register({
    id: 'diff', cat: 'text', icon: '🔀', name: '文本 Diff 对比', short: '文本 Diff',
    desc: '逐行对比两段文本（LCS 算法），新增绿色、删除红色，长文本自动折叠相同行。',
    kw: 'diff compare 对比 比较 lcs',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="grid2">' +
        '<textarea class="d-a" rows="8" spellcheck="false" placeholder="原始文本 A…"></textarea>' +
        '<textarea class="d-b" rows="8" spellcheck="false" placeholder="修改后文本 B…"></textarea>' +
        '</div>' +
        '<div class="btn-row"><button class="btn">对比 →</button><span class="d-sum hint" style="margin:0"></span></div>' +
        '</div>' +
        '<div class="card"><h3>差异结果</h3><div class="diff-box" data-out><div class="diff-line ctx" style="padding:10px 12px">点击「对比」查看结果</div></div></div>';
      var ta = DT.$('.d-a', root), tb = DT.$('.d-b', root);
      var btn = DT.$('.btn', root);
      var out = DT.$('[data-out]', root);
      var sum = DT.$('.d-sum', root);
      btn.addEventListener('click', function () {
        var r = diffLines(ta.value, tb.value);
        var add = 0, del = 0;
        r.ops.forEach(function (o) { if (o[0] === '+') add++; else if (o[0] === '-') del++; });
        sum.textContent = '共 ' + add + ' 行新增、' + del + ' 行删除' +
          (r.truncated ? '（文本过长，仅对比前 1500 行）' : '');
        // 折叠：超过 400 个操作时仅保留变更行 ±3 行上下文
        var keep = r.ops.map(function () { return false; });
        var collapse = r.ops.length > 400;
        if (collapse) {
          r.ops.forEach(function (o, i) {
            if (o[0] !== '=') {
              for (var k = Math.max(0, i - 3); k <= Math.min(r.ops.length - 1, i + 3); k++) keep[k] = true;
            }
          });
        }
        var html = '', skipping = false, skipCount = 0;
        function flushSkip() {
          if (skipping) {
            html += '<div class="diff-line skip">…… ' + skipCount + ' 行相同 ……</div>';
            skipping = false; skipCount = 0;
          }
        }
        r.ops.forEach(function (o, i) {
          if (collapse && !keep[i]) { skipping = true; skipCount++; return; }
          flushSkip();
          var cls = o[0] === '+' ? 'add' : o[0] === '-' ? 'del' : 'ctx';
          var sign = o[0] === '=' ? '  ' : o[0] === '+' ? '+ ' : '- ';
          html += '<div class="diff-line ' + cls + '">' + sign + DT.esc(o[1]) + '</div>';
        });
        flushSkip();
        out.innerHTML = html || '<div class="diff-line ctx">（无内容）</div>';
      });
    }
  });

  // ================= 进制转换 =================
  function parseRadix(s, base) {
    s = String(s).trim().replace(/[\s_]/g, '');
    var neg = false;
    if (/^[+-]/.test(s)) { neg = s[0] === '-'; s = s.slice(1); }
    if (/^0[xX]/.test(s) && base === 16) s = s.slice(2);
    if (/^0[bB]/.test(s) && base === 2) s = s.slice(2);
    if (/^0[oO]/.test(s) && base === 8) s = s.slice(2);
    if (!s) throw new Error('请输入数字');
    var n = 0n;
    for (var i = 0; i < s.length; i++) {
      var d = parseInt(s[i], 36);
      if (isNaN(d) || d >= base) throw new Error('字符「' + s[i] + '」不是合法的基 ' + base + ' 数字');
      n = n * BigInt(base) + BigInt(d);
    }
    return neg ? -n : n;
  }
  DT._t.parseRadix = parseRadix;

  function groupStr(s, n, sep) {
    return s.replace(new RegExp('\\B(?=(.{' + n + '})+$)', 'g'), sep);
  }

  DT.register({
    id: 'radix', cat: 'convert', icon: '🔁', name: '进制转换', short: '进制转换',
    desc: '输入任意进制数字（2-36），同时显示二进制 / 八进制 / 十进制 / 十六进制，支持大数（BigInt）。',
    kw: '进制 二进制 八进制 十六进制 binary hex radix 转换',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<label class="ctl"><span>输入进制</span><select class="r-base">' +
        '<option value="2">2（二进制）</option><option value="8">8（八进制）</option>' +
        '<option value="10" selected>10（十进制）</option><option value="16">16（十六进制）</option>' +
        '<option value="32">32</option><option value="36">36</option></select></label>' +
        '<label class="ctl"><span>输入值</span><input type="text" class="r-in" placeholder="如 255 或 0xFF" style="flex:1;min-width:200px"></label>' +
        '</div>' +
        '<div class="io-err" data-err hidden></div>' +
        '<div data-rows></div>' +
        '</div>';
      var baseSel = DT.$('.r-base', root), input = DT.$('.r-in', root);
      var err = DT.$('[data-err]', root), rows = DT.$('[data-rows]', root);
      function update() {
        err.hidden = true;
        if (!input.value.trim()) { rows.innerHTML = ''; return; }
        var v;
        try { v = parseRadix(input.value, parseInt(baseSel.value, 10)); }
        catch (e) { rows.innerHTML = ''; err.textContent = '✕ ' + e.message; err.hidden = false; return; }
        var neg = v < 0n;
        var a = neg ? -v : v;
        var sign = neg ? '-' : '';
        var bitLen = a === 0n ? 1 : a.toString(2).length + (neg ? 1 : 0);
        var data = [
          ['二进制 BIN', sign + a.toString(2), groupStr(a.toString(2), 4, ' ')],
          ['八进制 OCT', sign + a.toString(8), groupStr(a.toString(8), 3, ' ')],
          ['十进制 DEC', sign + a.toString(10), groupStr(a.toString(10), 3, ',')],
          ['十六进制 HEX', sign + a.toString(16).toUpperCase(), groupStr(a.toString(16).toUpperCase(), 2, ' ')]
        ];
        rows.innerHTML = data.map(function (d) {
          return '<div class="kv-row"><span class="k">' + d[0] + '</span><span class="v" style="display:block">' +
            d[1] + (d[2] !== d[1] ? '\n（分组：' + d[2] + '）' : '') + '</span></div>';
        }).join('') +
          '<div class="kv-row"><span class="k">位长</span><span class="v" style="display:block">' + bitLen + ' bit（' +
          Math.ceil(a.toString(2).length / 8) + ' 字节）</span></div>';
      }
      input.addEventListener('input', update);
      baseSel.addEventListener('change', update);
    }
  });

  // ================= 时间戳 =================
  DT.register({
    id: 'timestamp', cat: 'convert', icon: '⏱️', name: '时间戳转换', short: '时间戳',
    desc: '时间戳与日期互转：自动识别秒 / 毫秒，显示本地 / UTC / ISO / 相对时间；支持反向（日期 → 时间戳）。',
    kw: 'timestamp unix 时间戳 日期 date epoch',
    render: function (root) {
      root.innerHTML =
        '<div class="card"><h3>⏰ 当前时间（每秒刷新）</h3><div data-now></div></div>' +
        '<div class="card"><h3>时间戳 / 日期字符串 → 详细信息</h3>' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<label class="ctl"><span>输入</span><input type="text" class="ts-in" placeholder="如 1755302400、1755302400000、2026-08-16 12:00:00" style="width:320px;max-width:100%"></label>' +
        '</div><div class="io-err" data-err hidden></div><div data-out></div></div>' +
        '<div class="card"><h3>日期 → 时间戳</h3>' +
        '<div class="ctrl-row" style="margin:0 0 10px">' +
        '<label class="ctl"><span>选择时间（本地时区）</span><input type="datetime-local" class="d-in" step="1"></label>' +
        '<button class="btn sm d-now">填入当前</button>' +
        '</div><div data-dout></div></div>';

      var nowBox = DT.$('[data-now]', root);
      var tsIn = DT.$('.ts-in', root), err = DT.$('[data-err]', root), out = DT.$('[data-out]', root);
      var dIn = DT.$('.d-in', root), dOut = DT.$('[data-dout]', root);

      function nowUpdate() {
        var d = new Date();
        nowBox.innerHTML =
          '<div class="kv-row"><span class="k">本地</span><span class="v">' + DT.fmtLocal(d) + '</span></div>' +
          '<div class="kv-row"><span class="k">UTC</span><span class="v">' + d.toUTCString() + '</span></div>' +
          '<div class="kv-row"><span class="k">ISO 8601</span><span class="v">' + d.toISOString() + '</span></div>' +
          '<div class="kv-row"><span class="k">Unix 秒</span><span class="v">' + Math.floor(d.getTime() / 1000) + '</span></div>' +
          '<div class="kv-row"><span class="k">Unix 毫秒</span><span class="v">' + d.getTime() + '</span></div>';
      }
      nowUpdate();
      setInterval(nowUpdate, 1000);

      function dayOfYear(d) {
        var start = new Date(d.getFullYear(), 0, 0);
        return Math.floor((d - start) / 86400000);
      }

      function tsUpdate() {
        err.hidden = true;
        out.innerHTML = '';
        var t = tsIn.value.trim();
        if (!t) return;
        var d;
        if (/^-?\d+(\.\d+)?$/.test(t)) {
          var num = parseFloat(t);
          var isMs = Math.abs(num) >= 1e11;
          d = new Date(isMs ? num : num * 1000);
        } else {
          var norm = t.replace(' ', 'T');
          var ms = Date.parse(norm);
          if (isNaN(ms)) { err.textContent = '✕ 无法识别的时间格式（支持时间戳、ISO、YYYY-MM-DD HH:mm:ss）'; err.hidden = false; return; }
          d = new Date(ms);
        }
        if (isNaN(d.getTime())) { err.textContent = '✕ 时间数值超出范围'; err.hidden = false; return; }
        out.innerHTML =
          '<div class="kv-row"><span class="k">本地时间</span><span class="v">' + DT.fmtLocal(d) + '（星期' + '日一二三四五六'[d.getDay()] + '，年内第 ' + dayOfYear(d) + ' 天）</span></div>' +
          '<div class="kv-row"><span class="k">UTC</span><span class="v">' + d.toUTCString() + '</span></div>' +
          '<div class="kv-row"><span class="k">ISO 8601</span><span class="v">' + d.toISOString() + '</span></div>' +
          '<div class="kv-row"><span class="k">Unix 秒</span><span class="v">' + Math.floor(d.getTime() / 1000) + '</span></div>' +
          '<div class="kv-row"><span class="k">Unix 毫秒</span><span class="v">' + d.getTime() + '</span></div>' +
          '<div class="kv-row"><span class="k">相对</span><span class="v">' + DT.relTime(d) + '</span></div>';
      }
      tsIn.addEventListener('input', tsUpdate);

      DT.$('.d-now', root).addEventListener('click', function () {
        var d = new Date();
        function p(x) { return (x < 10 ? '0' : '') + x; }
        dIn.value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
          'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
        dUpdate();
      });

      function dUpdate() {
        dOut.innerHTML = '';
        if (!dIn.value) return;
        var d = new Date(dIn.value);
        if (isNaN(d.getTime())) {
          dOut.innerHTML = '<div class="io-err" style="margin:0">日期无效</div>';
          return;
        }
        dOut.innerHTML =
          '<div class="kv-row"><span class="k">Unix 秒</span><span class="v">' + Math.floor(d.getTime() / 1000) + '</span></div>' +
          '<div class="kv-row"><span class="k">Unix 毫秒</span><span class="v">' + d.getTime() + '</span></div>' +
          '<div class="kv-row"><span class="k">ISO 8601</span><span class="v">' + d.toISOString() + '</span></div>';
      }
      dIn.addEventListener('input', dUpdate);
    }
  });

  // ================= 颜色转换 =================
  function hex2rgb(h) {
    h = h.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('无效的 HEX 颜色（如 #c75b39）');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map(function (v) { return Math.round((v + m) * 255); });
  }

  DT.register({
    id: 'color', cat: 'convert', icon: '🎨', name: '颜色转换', short: '颜色转换',
    desc: 'HEX / RGB / HSL / CMYK 互转，附明暗梯度与文字配色建议。',
    kw: 'color 颜色 hex rgb hsl cmyk',
    render: function (root) {
      root.innerHTML = '<div class="card">' +
        '<div class="ctrl-row" style="margin:0 0 12px">' +
        '<input type="color" class="c-pick" value="#c75b39" style="width:52px;height:36px;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer">' +
        '<label class="ctl"><span>HEX / rgb()</span><input type="text" class="c-in" value="#c75b39" style="width:150px"></label>' +
        '</div>' +
        '<div class="color-stage">' +
        '<div class="color-swatch" data-swatch></div>' +
        '<div style="flex:1;min-width:240px" data-rows></div>' +
        '</div>' +
        '<div class="color-shades" data-shades></div>' +
        '<p class="hint">上方梯度为同一色相不同亮度（0% - 100%），可用于生成 hover / 禁用等状态色。</p>' +
        '</div>';
      var pick = DT.$('.c-pick', root), input = DT.$('.c-in', root);
      var swatch = DT.$('[data-swatch]', root), rows = DT.$('[data-rows]', root), shades = DT.$('[data-shades]', root);

      function render(rgb) {
        var r = rgb[0], g = rgb[1], b = rgb[2];
        var hex = rgb2hex(r, g, b);
        var hsl = rgb2hsl(r, g, b);
        var k = 1 - Math.max(r, g, b) / 255;
        var c = k === 1 ? 0 : (1 - r / 255 - k) / (1 - k);
        var m = k === 1 ? 0 : (1 - g / 255 - k) / (1 - k);
        var y = k === 1 ? 0 : (1 - b / 255 - k) / (1 - k);
        var lum = Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) / 2.55);
        var textCol = lum > 55 ? '#2d2a24' : '#ffffff';
        swatch.style.background = hex;
        swatch.style.color = textCol;
        swatch.textContent = lum > 55 ? '建议深色文字' : '建议浅色文字';
        rows.innerHTML =
          '<div class="kv-row"><span class="k">HEX</span><span class="v">' + hex + '</span></div>' +
          '<div class="kv-row"><span class="k">RGB</span><span class="v">rgb(' + r + ', ' + g + ', ' + b + ')（' +
          Math.round(r / 2.55) + '%, ' + Math.round(g / 2.55) + '%, ' + Math.round(b / 2.55) + '%）</span></div>' +
          '<div class="kv-row"><span class="k">HSL</span><span class="v">hsl(' + hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%)</span></div>' +
          '<div class="kv-row"><span class="k">CMYK</span><span class="v">' + Math.round(c * 100) + '%, ' + Math.round(m * 100) + '%, ' + Math.round(y * 100) + '%, ' + Math.round(k * 100) + '%</span></div>' +
          '<div class="kv-row"><span class="k">亮度</span><span class="v">' + lum + '%（' + (lum > 55 ? '偏亮' : '偏暗') + '）</span></div>';
        var html = '';
        for (var l = 0; l <= 100; l += 10) {
          var rr = hsl2rgb(hsl[0], hsl[1], l);
          html += '<div style="background:' + rgb2hex(rr[0], rr[1], rr[2]) + '" title="亮度 ' + l + '%"></div>';
        }
        shades.innerHTML = html;
      }

      function fromInput() {
        var v = input.value.trim();
        try {
          if (/^#/i.test(v) || /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)) {
            var rgb = hex2rgb(v);
            pick.value = rgb2hex(rgb[0], rgb[1], rgb[2]);
            render(rgb);
          } else {
            var m = v.match(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i);
            if (!m) throw new Error('x');
            render([Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])]);
          }
        } catch (e) {
          rows.innerHTML = '<div class="hint" style="color:var(--red)">无法解析颜色，支持 #RGB、#RRGGBB、rgb(r,g,b)</div>';
          swatch.style.background = 'var(--border)';
          swatch.textContent = '?';
        }
      }
      pick.addEventListener('input', function () { input.value = pick.value; fromInput(); });
      input.addEventListener('input', fromInput);
      fromInput();
    }
  });
})();
