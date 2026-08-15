#!/usr/bin/env node
// ============================================================
//  gen_manifest.js
//  扫描 funcs/*.html 的 <meta name="func-*"> 标签，自动生成
//  funcs/manifest.js（func.html 功能列表的数据源）。
//
//  用法：在项目根目录运行
//      node scripts/gen_manifest.js
//
//  约定：每个 funcs/*.html 在 <head> 内声明以下 meta（缺省则用 <title> 兜底）：
//      <meta name="func-icon"  content="🧸">
//      <meta name="func-title" content="数学小勇士">
//      <meta name="func-badge" content="加减乘练习">
//      <meta name="func-desc"  content="...">
//      <meta name="func-tags"  content="加法,减法,乘法">   (逗号分隔)
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FUNCS_DIR = path.join(ROOT, 'funcs');
const MANIFEST = path.join(FUNCS_DIR, 'manifest.js');

// 读取某个 meta 的 content
function readMeta(html, name) {
    const re = new RegExp('<meta\\s+name="' + name + '"\\s+content="([^"]*)"', 'i');
    const m = html.match(re);
    return m ? m[1] : '';
}

function readTitle(html) {
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m ? m[1].trim() : '';
}

// 读取现有 manifest 的 href 顺序，用于保持稳定的卡片排序
function readOldOrder() {
    const order = [];
    try {
        const txt = fs.readFileSync(MANIFEST, 'utf8');
        const re = /href:\s*"(funcs\/[^"]+)"/g;
        let m;
        while ((m = re.exec(txt)) !== null) order.push(m[1]);
    } catch (_) { /* 首次生成时文件不存在，忽略 */ }
    return order;
}

// 扫描 funcs 下所有 html
const files = fs.readdirSync(FUNCS_DIR)
    .filter(f => f.endsWith('.html'))
    .sort();

const entries = files.map(f => {
    const html = fs.readFileSync(path.join(FUNCS_DIR, f), 'utf8');
    const href = 'funcs/' + f;
    const title = readMeta(html, 'func-title') || readTitle(html) || f;
    const icon = readMeta(html, 'func-icon') || '📄';
    const badge = readMeta(html, 'func-badge') || '';
    const desc = readMeta(html, 'func-desc') || '';
    const tagsRaw = readMeta(html, 'func-tags') || '';
    const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    return { href, icon, title, badge, desc, tags };
});

// 稳定排序：沿用旧 manifest 的顺序；新文件按文件名追加到末尾
const oldOrder = readOldOrder();
const orderIdx = {};
oldOrder.forEach((h, i) => { orderIdx[h] = i; });
entries.sort((a, b) => {
    const ia = orderIdx[a.href];
    const ib = orderIdx[b.href];
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a.href.localeCompare(b.href);
});

// 生成 manifest.js 文本
const body = entries.map(e => {
    return '  {\n' +
        '    href: ' + JSON.stringify(e.href) + ',\n' +
        '    icon: ' + JSON.stringify(e.icon) + ',\n' +
        '    title: ' + JSON.stringify(e.title) + ',\n' +
        '    badge: ' + JSON.stringify(e.badge) + ',\n' +
        '    desc: ' + JSON.stringify(e.desc) + ',\n' +
        '    tags: ' + JSON.stringify(e.tags) + '\n' +
        '  }';
}).join(',\n');

const out =
'// ============================================================\n' +
'//  功能清单数据源 (由 func.html 加载并动态渲染卡片)\n' +
'//  本文件由 scripts/gen_manifest.js 自动生成，也可手动维护。\n' +
'//  新增功能：在 funcs/ 放带 <meta name="func-*"> 的 html 后运行\n' +
'//           `node scripts/gen_manifest.js` 即可重写本文件。\n' +
'// ============================================================\n' +
'window.FUNCS = [\n' +
body + '\n' +
'];\n';

fs.writeFileSync(MANIFEST, out, 'utf8');
console.log('✓ 已生成 ' + path.relative(ROOT, MANIFEST) + '，共 ' + entries.length + ' 个功能：');
entries.forEach(e => console.log('  - ' + e.href + '  ' + e.title));
