/* Офлайн-режим: файлы игры кэшируются при первом запуске.
   Если меняешь список скриптов в index.html — обнови ASSETS.
   В каждом выпуске меняй CACHE вместе с GAME_VERSION в js/core.js:
   по новому sw.js открытые вкладки узнают, что вышла новая версия. */
const CACHE = 'khaos-doska-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/core.js',
  './js/audio.js',
  './js/music.js',
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
  './js/arena.js',
  './js/raid.js',
  './js/football.js',
  './js/undertale.js',
  './js/top.js',
  './js/durak.js',
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

// Свои файлы — сначала из сети, чтобы новая версия была видна с первой же загрузки.
// Нет сети или она молчит дольше 3 с — отдаём из кэша. Шрифты и CDN — из кэша, если есть.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const own = new URL(req.url).origin === self.location.origin;
  e.respondWith(own ? fresh(req) : cached(req));
});

function save(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

function fromCache(req) {
  // ссылка-приглашение с ?параметрами офлайн открывает ту же страницу
  return caches.match(req, { ignoreSearch: req.mode === 'navigate' });
}

// GitHub Pages отдаёт файлы с max-age=600: с таким заголовком браузер при перезагрузке
// берёт скрипты из памяти, даже не спрашивая нас, и новая версия не видна до 10 минут.
function revalidate(res) {
  if (!res || res.type !== 'basic') return res;
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function fresh(req) {
  return new Promise((resolve) => {
    let done = false;
    const give = (res) => {
      if (res && !done) {
        done = true;
        resolve(revalidate(res));
      }
    };
    const timer = setTimeout(() => fromCache(req).then(give), 3000);
    fetch(req.url, { cache: 'no-cache' })
      .then((res) => {
        clearTimeout(timer);
        give(save(req, res));
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache(req).then((hit) => give(hit || Response.error()));
      });
  });
}

function cached(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => save(req, res)));
}
