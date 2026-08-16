// ============================================================
//  sw.js — Wakfu 攻略站 Service Worker（PWA 离线支持）
//  策略：
//    - 页面导航请求：网络优先（保证更新及时），失败回退缓存
//    - 静态资源（同源）：缓存优先，命中后后台刷新（下次打开拿到新版本）
//    - CDN 资源（mermaid/hljs/katex）：缓存优先 + 后台刷新
//  版本号更新时修改 CACHE 名称即可让全部缓存失效。
// ============================================================
'use strict';

var CACHE = 'wakfu-static-v2';

var CORE = [
  '/',
  '/index.html',
  '/func.html',
  '/funcs/manifest.js',
  '/funcs/devtools.html',
  '/funcs/devtools.js',
  '/funcs/devtools-qr.js',
  '/funcs/devtools-enc.js',
  '/funcs/devtools-data.js',
  '/funcs/devtools-gen.js',
  '/funcs/editor.html',
  '/funcs/editor-core.js',
  '/funcs/editor-md.js',
  '/funcs/math.html',
  '/theme.css',
  '/theme.js',
  '/favicon.ico',
  '/logo.webp',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        return c.add(u).catch(function () { }); // 单项失败不阻塞
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // 页面导航：网络优先，失败回退缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先，命中后一律后台刷新（保证下次打开拿到新版本）
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            caches.open(CACHE).then(function (c) { c.put(req, res); });
          }
        }).catch(function () { });
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
