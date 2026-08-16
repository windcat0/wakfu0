// ============================================================
//  devtools-qr.js — 纯 JS 二维码(QR Code)编码器（Model 2, 字节模式）
//  支持版本 1-10、纠错级别 L/M/Q/H、Reed-Solomon 纠错、8 种掩码评估。
//  用法：window.QR(text, 'M') → { size, m }  m 为 size×size 的
//        Uint8Array（行主序），1 = 黑色模块，0 = 白色模块。
// ============================================================
(function () {
  'use strict';

  // ---------- GF(256) 运算（本原多项式 0x11d，生成元 2） ----------
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function initGF() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  // 生成 ecLen 个纠错码字的生成多项式 ∏(x - α^i)，最高次在前
  function rsGenPoly(ecLen) {
    var poly = [1];
    for (var i = 0; i < ecLen; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var k = 0; k < poly.length; k++) {
        next[k] ^= poly[k];                    // x · poly[k]
        next[k + 1] ^= gmul(poly[k], EXP[i]);  // α^i · poly[k]
      }
      poly = next;
    }
    return poly;
  }

  // 对 data 计算 RS 纠错码字
  function rsEncode(data, ecLen) {
    var gen = rsGenPoly(ecLen);
    var rem = data.concat(new Array(ecLen).fill(0));
    for (var i = 0; i < data.length; i++) {
      var factor = rem[i];
      if (factor !== 0) {
        for (var j = 0; j < gen.length; j++) {
          rem[i + j] ^= gmul(gen[j], factor);
        }
      }
    }
    return rem.slice(data.length);
  }

  // ---------- 版本 1-10 的 RS 块表 ----------
  // 每项格式：[块数, 总码字, 数据码字, (块数, 总码字, 数据码字)…]
  // 索引：(version-1)*4 + [L=0, M=1, Q=2, H=3]
  var RS_BLOCKS = [
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],            // v1
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],            // v2
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],            // v3
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],            // v4
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12], // v5
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],            // v6
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],   // v7
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15], // v8
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13], // v9
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]  // v10
  ];

  // 校验位置图坐标（版本 2-10；版本 1 无）
  var ALIGN = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function rsBlocksOf(version, ecIdx) {
    var spec = RS_BLOCKS[(version - 1) * 4 + ecIdx];
    var blocks = [];
    for (var i = 0; i < spec.length; i += 3) {
      for (var b = 0; b < spec[i]; b++) {
        blocks.push({ total: spec[i + 1], data: spec[i + 2] });
      }
    }
    return blocks;
  }

  // 字节模式容量：总数据码字数
  function dataCodewordsOf(version, ecIdx) {
    var bs = rsBlocksOf(version, ecIdx);
    return bs.reduce(function (s, b) { return s + b.data; }, 0);
  }

  function byteCapacity(version, ecIdx) {
    var dataCW = dataCodewordsOf(version, ecIdx);
    var countBits = version <= 9 ? 8 : 16; // 字节模式字符计数位
    return Math.floor((dataCW * 8 - 4 - countBits) / 8);
  }

  // ---------- BCH 格式信息 / 版本信息 ----------
  function makeFormatBits(ecBits, mask) {
    var data = (ecBits << 3) | mask; // 5 bit
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function makeVersionBits(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    return (version << 12) | rem; // 18 bit
  }

  // ---------- 矩阵构建 ----------
  function buildMatrix(version) {
    var size = 17 + 4 * version;
    var m = new Uint8Array(size * size);      // 模块颜色
    var fn = new Uint8Array(size * size);     // 是否功能区（不参与掩码）
    var set = function (r, c, v) { m[r * size + c] = v ? 1 : 0; };
    var mark = function (r, c, v) { m[r * size + c] = v ? 1 : 0; fn[r * size + c] = 1; };

    // 探测图形（7×7）+ 分隔符（1 圈浅色）
    function probe(row, col) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = row + r, cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var dark = (r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)));
          mark(rr, cc, dark);
        }
      }
    }
    probe(0, 0);
    probe(0, size - 7);
    probe(size - 7, 0);

    // 校正图形（5×5）
    var alignPos = ALIGN[version] || [];
    for (var ai = 0; ai < alignPos.length; ai++) {
      for (var aj = 0; aj < alignPos.length; aj++) {
        var ar = alignPos[ai], ac = alignPos[aj];
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === size - 7) || (ar === size - 7 && ac === 6)) continue;
        for (var r2 = -2; r2 <= 2; r2++) {
          for (var c2 = -2; c2 <= 2; c2++) {
            var dark2 = (Math.abs(r2) === 2 || Math.abs(c2) === 2 || (r2 === 0 && c2 === 0)) ? 1 : 0;
            mark(ar + r2, ac + c2, dark2);
          }
        }
      }
    }

    // 时序图形（跳过已被校正图形占据的单元格）
    for (var i = 8; i < size - 8; i++) {
      if (!fn[6 * size + i]) mark(6, i, i % 2 === 0 ? 1 : 0);
      if (!fn[i * size + 6]) mark(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // 固定暗模块
    mark(size - 8, 8, 1);

    // 预留格式信息区（先置 0，稍后写入）
    for (var f = 0; f <= 8; f++) {
      if (f !== 6) { fn[8 * size + f] = 1; fn[f * size + 8] = 1; }
    }
    for (var f2 = 0; f2 < 8; f2++) {
      fn[8 * size + (size - 1 - f2)] = 1;
      fn[(size - 1 - f2) * size + 8] = 1;
    }

    // 版本信息（v ≥ 7）
    if (version >= 7) {
      var vbits = makeVersionBits(version);
      for (var b = 0; b < 18; b++) {
        var bit = (vbits >>> b) & 1;
        mark(Math.floor(b / 3), size - 11 + (b % 3), bit);          // 右上
        mark(size - 11 + (b % 3), Math.floor(b / 3), bit);          // 左下
      }
    }

    return { size: size, m: m, fn: fn, set: set };
  }

  // ---------- 数据码字流 ----------
  function buildCodewords(bytes, version, ecIdx) {
    var blocks = rsBlocksOf(version, ecIdx);
    var totalData = dataCodewordsOf(version, ecIdx);
    var countBits = version <= 9 ? 8 : 16;

    // 位流：模式 0100 + 计数 + 数据 + 终止符 + 填充
    var bits = [];
    function pushBits(val, n) {
      for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    }
    pushBits(4, 4);
    pushBits(bytes.length, countBits);
    for (var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    var capacityBits = totalData * 8;
    var term = Math.min(4, capacityBits - bits.length);
    pushBits(0, term);
    while (bits.length % 8 !== 0) bits.push(0);
    var codewords = [];
    for (var w = 0; w < bits.length; w += 8) {
      var b = 0;
      for (var k = 0; k < 8; k++) b = (b << 1) | bits[w + k];
      codewords.push(b);
    }
    var pads = [0xEC, 0x11], pi = 0;
    while (codewords.length < totalData) codewords.push(pads[pi++ % 2]);

    // 分块计算纠错并交织
    var dataBlocks = [], ecBlocks = [];
    var off = 0;
    for (var bi = 0; bi < blocks.length; bi++) {
      var d = codewords.slice(off, off + blocks[bi].data);
      off += blocks[bi].data;
      dataBlocks.push(d);
      ecBlocks.push(rsEncode(d, blocks[bi].total - blocks[bi].data));
    }
    var out = [];
    var maxData = Math.max.apply(null, dataBlocks.map(function (b) { return b.length; }));
    var maxEc = Math.max.apply(null, ecBlocks.map(function (b) { return b.length; }));
    for (var d2 = 0; d2 < maxData; d2++) {
      for (var bl = 0; bl < dataBlocks.length; bl++) if (d2 < dataBlocks[bl].length) out.push(dataBlocks[bl][d2]);
    }
    for (var e = 0; e < maxEc; e++) {
      for (var bl2 = 0; bl2 < ecBlocks.length; bl2++) {
        if (e < ecBlocks[bl2].length) out.push(ecBlocks[bl2][e]);
      }
    }
    return out;
  }

  // ---------- 掩码公式 ----------
  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r, c) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
    function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
  ];

  // ---------- 惩罚评分（挑最优掩码） ----------
  function penalty(m, size) {
    var p = 0, r, c;
    // 规则1：行/列连续同色 ≥5
    for (r = 0; r < size; r++) {
      var run = 1;
      for (c = 1; c < size; c++) {
        if (m[r * size + c] === m[r * size + c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
        else run = 1;
      }
    }
    for (c = 0; c < size; c++) {
      var run2 = 1;
      for (r = 1; r < size; r++) {
        if (m[r * size + c] === m[(r - 1) * size + c]) { run2++; if (run2 === 5) p += 3; else if (run2 > 5) p += 1; }
        else run2 = 1;
      }
    }
    // 规则2：2×2 同色块
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r * size + c];
        if (v === m[r * size + c + 1] && v === m[(r + 1) * size + c] && v === m[(r + 1) * size + c + 1]) p += 3;
      }
    }
    // 规则3：类探测图形 1011101 + 4 个浅色
    var pat = [1, 0, 1, 1, 1, 0, 1];
    function scanLine(get, len) {
      for (var i = 0; i <= len - 7; i++) {
        var hit = true;
        for (var k = 0; k < 7; k++) if (get(i + k) !== pat[k]) { hit = false; break; }
        if (!hit) continue;
        var before = true, after = true;
        for (var q = 1; q <= 4; q++) {
          if (i - q >= 0 && get(i - q) === 1) before = false;
          if (i + 6 + q < len && get(i + 6 + q) === 1) after = false;
        }
        if (before || after) p += 40;
      }
    }
    for (r = 0; r < size; r++) scanLine(function (c) { return m[r * size + c]; }, size);
    for (c = 0; c < size; c++) scanLine(function (rr) { return m[rr * size + c]; }, size);
    // 规则4：暗模块占比偏离 50%
    var dark = 0;
    for (var t = 0; t < m.length; t++) dark += m[t];
    p += 10 * Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5);
    return p;
  }

  // ---------- 主入口 ----------
  function QRencode(text, ecLevel) {
    var EC = { L: 0, M: 1, Q: 2, H: 3 };
    var ecIdx = EC[(ecLevel || 'M').toUpperCase()];
    if (ecIdx === undefined) throw new Error('无效的纠错级别：' + ecLevel + '（可选 L/M/Q/H）');
    var bytes = new TextEncoder().encode(text);
    if (bytes.length === 0) throw new Error('请输入内容');

    var version = -1;
    for (var v = 1; v <= 10; v++) {
      if (byteCapacity(v, ecIdx) >= bytes.length) { version = v; break; }
    }
    if (version < 0) {
      throw new Error('内容过长：最多 ' + byteCapacity(10, ecIdx) + ' 字节（当前 ' + bytes.length +
        ' 字节，纠错级别 ' + 'LMQH'[ecIdx] + '）。请缩短内容或降低纠错级别');
    }

    var codewords = buildCodewords(bytes, version, ecIdx);
    var built = buildMatrix(version);
    var size = built.size, m = built.m, fn = built.fn;

    // 数据位放置（右起双列蛇形，跳过时序列）
    var bitIdx = 0;
    var totalBits = codewords.length * 8;
    function bitAt(i) {
      if (i >= totalBits) return 0; // 剩余位固定为 0（浅色）
      return (codewords[i >>> 3] >>> (7 - (i & 7))) & 1;
    }
    var upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var i = 0; i < size; i++) {
        var r = upward ? size - 1 - i : i;
        for (var co = 0; co < 2; co++) {
          var c = col - co;
          if (fn[r * size + c]) continue;
          m[r * size + c] = bitAt(bitIdx++);
        }
      }
      upward = !upward;
    }

    // 尝试 8 种掩码，取惩罚最低者
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mk = 0; mk < 8; mk++) {
      var trial = m.slice();
      for (var rr = 0; rr < size; rr++) {
        for (var cc = 0; cc < size; cc++) {
          if (!fn[rr * size + cc] && MASKS[mk](rr, cc)) trial[rr * size + cc] ^= 1;
        }
      }
      writeFormat(trial, size, ecIdx, mk);
      var score = penalty(trial, size);
      if (score < bestScore) { bestScore = score; best = trial; bestMask = mk; }
    }

    return { size: size, m: best, version: version, mask: bestMask };
  }

  // 写入两份格式信息
  function writeFormat(m, size, ecIdx, mask) {
    var bits = makeFormatBits([1, 0, 3, 2][ecIdx], mask); // L=01 M=00 Q=11 H=10
    for (var i = 0; i < 15; i++) {
      var bit = (bits >>> i) & 1; // i=0 为最低位
      // 竖排（左上 + 左下）
      if (i < 6) m[i * size + 8] = bit;
      else if (i < 8) m[(i + 1) * size + 8] = bit;
      else m[(size - 15 + i) * size + 8] = bit;
      // 横排（左上 + 右上）
      if (i < 8) m[8 * size + (size - 1 - i)] = bit;
      else if (i === 8) m[8 * size + 7] = bit;
      else m[8 * size + (14 - i)] = bit;
    }
  }

  // 供单元自测
  window.QR = QRencode;
  window.QR_makeFormatBits = makeFormatBits;
})();
