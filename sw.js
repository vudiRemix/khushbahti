/* Офлайн-режим: файлы игры кэшируются при первом запуске.
   Если меняешь список скриптов в index.html — обнови ASSETS и поменяй CACHE. */
const CACHE = 'khaos-doska-v6';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/core.js',
  './js/audio.js',
  './js/art.js',
  './js/board.js',
  './js/entities.js',
  './js/weapons.js',
  './js/extras.js',
  './js/enemies2.js',
  './js/bosses.js',
  './js/levels.js',
  './js/achievements.js',
  './js/net.js',
  './js/duel.js',
  './js/game.js',
  './js/render.js',
  './js/main.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' — мимо HTTP-кэша браузера, чтобы после обновления не смешались старые и новые файлы
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала отдаём из кэша (быстро и без сети), параллельно обновляем кэш из сети.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => {
      // свои файлы перепроверяем на сервере (no-cache), чужие (шрифты, CDN) берём как есть
      const own = new URL(req.url).origin === self.location.origin;
      const net = (own ? fetch(req.url, { cache: 'no-cache' }) : fetch(req))
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
