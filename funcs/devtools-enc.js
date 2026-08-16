// ============================================================
//  devtools-enc.js — 编码 / 解码 + 哈希 / 加密 工具
//  Base64、URL、HTML 实体、Unicode、Hex、Base32/Base58、
//  SHA 系列、MD5、HMAC、AES-GCM、JWT 解码
// ============================================================
(function () {
  'use strict';
  var DT = window.DT;

  // ================= Base64 =================
  DT.ioTool({
    id: 'base64', cat: 'encode', icon: '🔐', name: 'Base64 编码 / 解码', short: 'Base64',
    desc: 'UTF-8 安全的 Base64 编码与解码，解码时自动兼容 URL-safe（- _）与换行符。',
    kw: 'base64 b64 encode decode 编码 解码',
    ph: '输入要编码的文本，或粘贴要解码的 Base64…',
    swap: true, rows: 5, orows: 5,
    controls: function (row) {
      return {
        urlsafe: DT.ctrlCheck(row, '输出使用 URL-safe（- _ 替代 + /）', false)
      };
    },
    actions: [
      {
        label: '编码 →', fn: function (text, ctrls) {
          var b64 = DT.u82b64(DT.str2u8(text));
          return ctrls.urlsafe() ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
        }
      },
      {
        label: '← 解码', cls: 'ghost', fn: function (text) {
          if (!text.trim()) throw new Error('请输入要解码的内容');
          return DT.u82str(DT.b642u8(text));
        }
      }
    ]
  });

  // ================= URL 编码 =================
  DT.ioTool({
    id: 'url-encode', cat: 'encode', icon: '🔗', name: 'URL 编码 / 解码', short: 'URL 编码',
    desc: 'encodeURIComponent（编码参数，最常用）与 encodeURI（编码整条 URL，保留 ://?&=）两种模式。',
    kw: 'url encode decode uri encodeURIComponent 编码 解码 转义',
    ph: '输入文本或 URL…',
    swap: true,
    actions: [
      { label: '编码（参数级）', fn: function (t) { return encodeURIComponent(t); } },
      { label: '← 解码', cls: 'ghost', fn: function (t) { try { return decodeURIComponent(t); } catch (e) { throw new Error('解码失败：存在非法的 % 转义序列'); } } },
      { label: '编码（整条 URL）', cls: 'ghost', fn: function (t) { return encodeURI(t); } },
      { label: '← 解码（整条）', cls: 'ghost', fn: function (t) { try { return decodeURI(t); } catch (e) { throw new Error('解码失败：存在非法的 % 转义序列'); } } }
    ]
  });

  // ================= HTML 实体 =================
  DT.ioTool({
    id: 'html-entity', cat: 'encode', icon: '🏷️', name: 'HTML 实体编码 / 解码', short: 'HTML 实体',
    desc: '在 HTML 中安全显示特殊字符：& < > " \' 会被转义为实体；可选将非 ASCII 字符转为数字实体。',
    kw: 'html entity 实体 转义 escape unescape xss',
    ph: '输入文本…',
    swap: true,
    controls: function (row) {
      return { nonascii: DT.ctrlCheck(row, '非 ASCII（中文等）也转数字实体', false) };
    },
    actions: [
      {
        label: '编码 →', fn: function (t, ctrls) {
          var s = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          if (ctrls.nonascii()) {
            s = s.replace(/[\u0080-\uffff]/g, function (c) { return '&#' + c.codePointAt(0) + ';'; });
          }
          return s;
        }
      },
      {
        label: '← 解码', cls: 'ghost', fn: function (t) {
          var ta = document.createElement('textarea');
          ta.innerHTML = t;
          return ta.value;
        }
      }
    ]
  });

  // ================= Unicode =================
  DT.ioTool({
    id: 'unicode', cat: 'encode', icon: '🌐', name: 'Unicode 转换', short: 'Unicode',
    desc: '文本与 Unicode 表示法互转：\\uXXXX（JS 转义）、U+XXXX（码点）、HTML 数字实体、十进制码点；解码时自动识别各种写法。',
    kw: 'unicode 码点 codepoint \\u 转义 中文',
    ph: '输入文本（如：你好 🌍），或粘贴 \\u4f60\\u597d 之类内容…',
    swap: true,
    controls: function (row) {
      return {
        mode: DT.ctrlSelect(row, '输出格式', [
          { v: 'u', t: '\\uXXXX（JS 转义）' },
          { v: 'up', t: 'U+XXXX（码点，空格分隔）' },
          { v: 'entity', t: 'HTML 数字实体' },
          { v: 'dec', t: '十进制码点（空格分隔）' }
        ], 'u')
      };
    },
    actions: [
      {
        label: '转换 →', fn: function (t, ctrls) {
          var mode = ctrls.mode();
          if (mode === 'u') {
            return t.split('').map(function (c) {
              var h = c.charCodeAt(0).toString(16);
              while (h.length < 4) h = '0' + h;
              return '\\u' + h;
            }).join('');
          }
          var cps = Array.from(t);
          if (mode === 'up') {
            return cps.map(function (c) {
              var h = c.codePointAt(0).toString(16).toUpperCase();
              while (h.length < 4) h = '0' + h;
              return 'U+' + h;
            }).join(' ');
          }
          if (mode === 'entity') {
            return cps.map(function (c) { return '&#x' + c.codePointAt(0).toString(16) + ';'; }).join('');
          }
          return cps.map(function (c) { return String(c.codePointAt(0)); }).join(' ');
        }
      },
      {
        label: '← 反解析', cls: 'ghost', fn: function (t) {
          var re = /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|U\+([0-9a-fA-F]{1,6})|&#x([0-9a-fA-F]+);|&#(\d+);/g;
          var found = false;
          var out = t.replace(re, function (all, b1, b2, b3, b4, b5) {
            found = true;
            var cp = b5 != null ? parseInt(b5, 10) : parseInt(b1 || b2 || b3 || b4, 16);
            try {
              return String.fromCodePoint(cp);
            } catch (e) {
              throw new Error('码点超出有效范围：' + cp);
            }
          });
          if (!found) throw new Error('未找到可解析的 Unicode 序列（支持 \\uXXXX、U+XXXX、&#xHH;、&#DD;）');
          return out;
        }
      }
    ]
  });

  // ================= Hex =================
  DT.ioTool({
    id: 'hex', cat: 'encode', icon: '0️⃣', name: 'Hex 十六进制转换', short: 'Hex',
    desc: '文本与十六进制字节串互转（UTF-8），可选拼写分隔符与大小写。解码时自动忽略空白与 0x 前缀。',
    kw: 'hex 十六进制 bytes 字节',
    ph: '输入文本，或粘贴十六进制串（如 ef bf bd 或 0x48656c6c6f）…',
    swap: true,
    controls: function (row) {
      return {
        sep: DT.ctrlSelect(row, '分隔符', [{ v: '', t: '无' }, { v: ' ', t: '空格' }], ''),
        upper: DT.ctrlCheck(row, '大写输出', false)
      };
    },
    actions: [
      {
        label: '文本 → Hex', fn: function (t, ctrls) {
          var h = DT.u82hex(DT.str2u8(t));
          if (ctrls.upper()) h = h.toUpperCase();
          if (ctrls.sep()) h = h.match(/../g).join(ctrls.sep());
          return h;
        }
      },
      {
        label: '← Hex 转文本', cls: 'ghost', fn: function (t) {
          return DT.u82str(DT.hex2u8(t.replace(/0x/gi, '')));
        }
      }
    ]
  });

  // ================= Base32 / Base58 =================
  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function b32enc(u8) {
    var out = '', bits = 0, val = 0;
    for (var i = 0; i < u8.length; i++) {
      val = (val << 8) | u8[i];
      bits += 8;
      while (bits >= 5) {
        out += B32[(val >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    var padMap = [0, 6, 4, 3, 1];
    for (var p = 0; p < padMap[u8.length % 5]; p++) out += '=';
    return out;
  }

  function b32dec(s) {
    s = s.toUpperCase().replace(/[=\s]/g, '');
    var out = [], bits = 0, val = 0;
    for (var i = 0; i < s.length; i++) {
      var idx = B32.indexOf(s[i]);
      if (idx < 0) throw new Error('无效的 Base32 字符：' + s[i]);
      val = (val << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((val >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(out);
  }

  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  function b58enc(u8) {
    var zeros = 0;
    while (zeros < u8.length && u8[zeros] === 0) zeros++;
    var n = 0n;
    for (var i = zeros; i < u8.length; i++) n = (n << 8n) | BigInt(u8[i]);
    var s = '';
    while (n > 0n) {
      s = B58[Number(n % 58n)] + s;
      n /= 58n;
    }
    for (var z = 0; z < zeros; z++) s = '1' + s;
    return s;
  }

  function b58dec(s) {
    s = s.replace(/\s+/g, '');
    if (!s) return new Uint8Array(0);
    var zeros = 0;
    while (zeros < s.length && s[zeros] === '1') zeros++;
    var n = 0n;
    for (var i = 0; i < s.length; i++) {
      var idx = B58.indexOf(s[i]);
      if (idx < 0) throw new Error('无效的 Base58 字符：' + s[i]);
      n = n * 58n + BigInt(idx);
    }
    var bytes = [];
    while (n > 0n) {
      bytes.unshift(Number(n & 0xffn));
      n >>= 8n;
    }
    var out = new Uint8Array(zeros + bytes.length);
    for (var z = 0; z < zeros; z++) out[z] = 0;
    for (var b = 0; b < bytes.length; b++) out[zeros + b] = bytes[b];
    return out;
  }

  DT._t.b32enc = b32enc; DT._t.b32dec = b32dec;
  DT._t.b58enc = b58enc; DT._t.b58dec = b58dec;

  DT.ioTool({
    id: 'base32-58', cat: 'encode', icon: '🔡', name: 'Base32 / Base58 编码 / 解码', short: 'Base32/58',
    desc: 'Base32（RFC 4648，常见于 TOTP 密钥、DNS）与 Base58（比特币字母表，去除易混淆的 0OIl）。',
    kw: 'base32 base58 编码 解码 bitcoin',
    ph: '输入文本…',
    swap: true,
    controls: function (row) {
      return {
        algo: DT.ctrlSelect(row, '算法', [{ v: '32', t: 'Base32' }, { v: '58', t: 'Base58' }], '32')
      };
    },
    actions: [
      {
        label: '编码 →', fn: function (t, ctrls) {
          var u8 = DT.str2u8(t);
          return ctrls.algo() === '32' ? b32enc(u8) : b58enc(u8);
        }
      },
      {
        label: '← 解码', cls: 'ghost', fn: function (t, ctrls) {
          if (!t.trim()) throw new Error('请输入要解码的内容');
          var u8 = ctrls.algo() === '32' ? b32dec(t) : b58dec(t);
          return DT.u82str(u8);
        }
      }
    ]
  });

  // ================= MD5 =================
  var md5bytes = (function () {
    var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    var K = new Array(64);
    for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

    return function (u8) {
      var len = u8.length;
      var n = (((len + 8) >>> 6) + 1) << 6;
      var buf = new Uint8Array(n);
      buf.set(u8);
      buf[len] = 0x80;
      var dv = new DataView(buf.buffer);
      dv.setUint32(n - 8, (len << 3) >>> 0, true);
      dv.setUint32(n - 4, Math.floor(len / 536870912) >>> 0, true);

      var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
      var M = new Uint32Array(16);
      for (var off = 0; off < n; off += 64) {
        for (var j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
        var A = a0, B = b0, C = c0, D = d0;
        for (var k = 0; k < 64; k++) {
          var F, g;
          if (k < 16) { F = (B & C) | (~B & D); g = k; }
          else if (k < 32) { F = (D & B) | (~D & C); g = (5 * k + 1) % 16; }
          else if (k < 48) { F = B ^ C ^ D; g = (3 * k + 5) % 16; }
          else { F = C ^ (B | ~D); g = (7 * k) % 16; }
          F = (F + A + K[k] + M[g]) >>> 0;
          A = D; D = C; C = B;
          B = (B + ((F << S[k]) | (F >>> (32 - S[k])))) >>> 0;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
      }
      var out = new Uint8Array(16);
      var odv = new DataView(out.buffer);
      odv.setUint32(0, a0, true); odv.setUint32(4, b0, true);
      odv.setUint32(8, c0, true); odv.setUint32(12, d0, true);
      return out;
    };
  })();

  DT.md5hex = function (str) { return DT.u82hex(md5bytes(DT.str2u8(str))); };
  DT.md5hexU8 = function (u8) { return DT.u82hex(md5bytes(u8)); };
  DT._t.md5hex = DT.md5hex;

  DT.ioTool({
    id: 'md5', cat: 'crypto', icon: '🎫', name: 'MD5 哈希', short: 'MD5',
    desc: '计算输入文本的 MD5 摘要（128 位）。MD5 已不安全，仅用于校验 / 去重等非安全场景。',
    kw: 'md5 hash 摘要 校验',
    ph: '输入要计算 MD5 的文本（空文本也可计算）…',
    actions: [
      {
        label: '计算 MD5', fn: function (t) {
          return DT.md5hex(t);
        }
      }
    ]
  });

  // ================= SHA 系列 =================
  DT.ioTool({
    id: 'sha', cat: 'crypto', icon: '🧬', name: 'SHA 哈希（SHA-1 / 256 / 384 / 512）', short: 'SHA 系列',
    desc: '基于浏览器原生 Web Crypto 计算文本摘要，输出 HEX 与 Base64 两种形式。',
    kw: 'sha sha1 sha256 sha384 sha512 hash 摘要',
    ph: '输入要哈希的文本…',
    controls: function (row) {
      return {
        algo: DT.ctrlSelect(row, '算法', [
          { v: 'SHA-1', t: 'SHA-1（已不安全）' },
          { v: 'SHA-256', t: 'SHA-256' },
          { v: 'SHA-384', t: 'SHA-384' },
          { v: 'SHA-512', t: 'SHA-512' }
        ], 'SHA-256')
      };
    },
    actions: [
      {
        label: '计算哈希', fn: function (t, ctrls) {
          if (!DT.hasSubtle()) throw DT.subtleFail();
          var algo = ctrls.algo();
          return crypto.subtle.digest(algo, DT.str2u8(t)).then(function (buf) {
            var u8 = new Uint8Array(buf);
            return algo + '（HEX，小写）\n' + DT.u82hex(u8) + '\n\n' + algo + '（Base64）\n' + DT.u82b64(u8);
          });
        }
      }
    ]
  });

  // ================= HMAC =================
  DT.ioTool({
    id: 'hmac', cat: 'crypto', icon: '🗝️', name: 'HMAC 计算', short: 'HMAC',
    desc: '使用密钥计算 HMAC-SHA1/256/384/512 消息认证码，常用于接口签名。',
    kw: 'hmac 签名 signature secret 密钥',
    ph: '输入消息内容…',
    controls: function (row) {
      return {
        algo: DT.ctrlSelect(row, '算法', [
          { v: 'SHA-1', t: 'HMAC-SHA1' },
          { v: 'SHA-256', t: 'HMAC-SHA256' },
          { v: 'SHA-384', t: 'HMAC-SHA384' },
          { v: 'SHA-512', t: 'HMAC-SHA512' }
        ], 'SHA-256'),
        secret: DT.ctrlText(row, '密钥', '', 'secret')
      };
    },
    actions: [
      {
        label: '计算 HMAC', fn: function (t, ctrls) {
          if (!DT.hasSubtle()) throw DT.subtleFail();
          var secret = ctrls.secret();
          if (!secret) throw new Error('请输入密钥');
          var algo = ctrls.algo();
          return crypto.subtle.importKey(
            'raw', DT.str2u8(secret),
            { name: 'HMAC', hash: { name: algo } },
            false, ['sign']
          ).then(function (key) {
            return crypto.subtle.sign('HMAC', key, DT.str2u8(t));
          }).then(function (sig) {
            var u8 = new Uint8Array(sig);
            return 'HMAC-' + algo.replace('SHA-', 'SHA') + '（HEX）\n' + DT.u82hex(u8) + '\n\nBase64\n' + DT.u82b64(u8);
          });
        }
      }
    ]
  });

  // ================= AES-GCM =================
  function aesDeriveKey(password, salt, iterations) {
    return crypto.subtle.importKey('raw', DT.str2u8(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (km) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      });
  }

  DT.ioTool({
    id: 'aes', cat: 'crypto', icon: '🔒', name: 'AES-GCM 加密 / 解密', short: 'AES 加解密',
    desc: '口令经 PBKDF2（SHA-256）派生 256 位密钥，AES-GCM 加密。输出为 Base64（盐 16B + IV 12B + 密文），可直接粘贴回本工具解密。',
    kw: 'aes gcm 加密 解密 encrypt decrypt pbkdf2',
    ph: '加密：输入明文；解密：粘贴下方输出的 Base64 密文…',
    swap: true,
    controls: function (row) {
      return {
        pw: (function () {
          var input = document.createElement('input');
          input.type = 'password';
          input.placeholder = '密码';
          input.style.width = '150px';
          var label = document.createElement('label');
          label.className = 'ctl';
          var sp = document.createElement('span'); sp.textContent = '密码';
          label.appendChild(sp); label.appendChild(input);
          row.appendChild(label);
          return function () { return input.value; };
        })(),
        iter: DT.ctrlNumber(row, 'PBKDF2 迭代', 100000, 10000, 1000000)
      };
    },
    actions: [
      {
        label: '加密 →', fn: function (t, ctrls) {
          if (!DT.hasSubtle()) throw DT.subtleFail();
          var pw = ctrls.pw();
          if (!pw) throw new Error('请输入密码');
          var salt = crypto.getRandomValues(new Uint8Array(16));
          var iv = crypto.getRandomValues(new Uint8Array(12));
          return aesDeriveKey(pw, salt, ctrls.iter() || 100000).then(function (key) {
            return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, DT.str2u8(t));
          }).then(function (ct) {
            var u8 = new Uint8Array(16 + 12 + ct.byteLength);
            u8.set(salt, 0); u8.set(iv, 16); u8.set(new Uint8Array(ct), 28);
            return DT.u82b64(u8);
          });
        }
      },
      {
        label: '← 解密', cls: 'ghost', fn: function (t, ctrls) {
          if (!DT.hasSubtle()) throw DT.subtleFail();
          var pw = ctrls.pw();
          if (!pw) throw new Error('请输入密码');
          if (!t.trim()) throw new Error('请输入要解密的 Base64 密文');
          var u8;
          try { u8 = DT.b642u8(t); } catch (e) { throw new Error('密文不是有效的 Base64'); }
          if (u8.length < 28) throw new Error('密文格式不对（应为本工具输出的 Base64）');
          var salt = u8.subarray(0, 16), iv = u8.subarray(16, 28), ct = u8.subarray(28);
          return aesDeriveKey(pw, salt, ctrls.iter() || 100000).then(function (key) {
            return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
          }).then(function (pt) {
            return DT.u82str(new Uint8Array(pt));
          }).catch(function () {
            throw new Error('解密失败：密码错误、迭代次数不符或数据已损坏');
          });
        }
      }
    ]
  });

  // ================= JWT 解码 =================
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtLocal(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  DT.fmtLocal = fmtLocal;
  DT.relTime = relTime;

  function relTime(d) {
    var diff = (d.getTime() - Date.now()) / 1000;
    var abs = Math.abs(diff);
    var txt;
    if (abs < 60) txt = Math.round(abs) + ' 秒';
    else if (abs < 3600) txt = Math.round(abs / 60) + ' 分钟';
    else if (abs < 86400) txt = Math.round(abs / 3600) + ' 小时';
    else txt = Math.round(abs / 86400) + ' 天';
    return diff >= 0 ? txt + '后' : txt + '前';
  }

  DT.ioTool({
    id: 'jwt', cat: 'crypto', icon: '🎫', name: 'JWT 解码', short: 'JWT 解码',
    desc: '解析 JWT（JSON Web Token）的 Header 与 Payload，并自动把 exp / iat / nbf 等时间戳字段换算为可读时间。仅解码展示，不验证签名。',
    kw: 'jwt token json web token 解析',
    ph: '粘贴 JWT：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.x…',
    actions: [
      {
        label: '解码 →', fn: function (t) {
          var parts = t.trim().split('.');
          if (parts.length < 2) throw new Error('JWT 格式应为 header.payload.signature（以 . 分隔的三段）');
          function decPart(p, what) {
            try {
              return JSON.parse(DT.u82str(DT.b642u8(p)));
            } catch (e) {
              throw new Error(what + ' 解码后不是有效 JSON');
            }
          }
          var header = decPart(parts[0], 'Header');
          var payload = decPart(parts[1], 'Payload');
          function annotate(obj) {
            return JSON.stringify(obj, null, 2).split('\n').map(function (line) {
              var m = line.match(/^(\s*"([^"]+)"\s*:\s*)(-?\d{9,14})(,?)\s*$/);
              if (m && /^(exp|iat|nbf|auth_time|updated_at|created_at)$/.test(m[2])) {
                var raw = parseInt(m[3], 10);
                var ms = String(Math.abs(raw)).length >= 13 ? raw : raw * 1000;
                var d = new Date(ms);
                if (!isNaN(d.getTime())) return line + '   // ' + fmtLocal(d) + '（' + relTime(d) + '）';
              }
              return line;
            }).join('\n');
          }
          var sigNote = parts[2]
            ? '存在（本工具不校验签名有效性）'
            : '缺失（可能是未签名的 JWT）';
          return '【Header（算法与类型）】\n' + JSON.stringify(header, null, 2) +
            '\n\n【Payload（数据）】\n' + annotate(payload) +
            '\n\n【Signature（签名）】\n' + sigNote +
            '\n\n⚠ 仅解码展示，请勿因此信任 Token 内容；签名需要密钥才能验证。';
        }
      }
    ]
  });
})();
