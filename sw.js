/**
 * Zpěvník — service worker.
 *
 * Díky němu zpěvník funguje i bez signálu (třeba u vody).
 * Po každé úpravě písní nebo kódu zvedni CACHE_VERSION, aby si prohlížeče
 * stáhly novou verzi: 'zpevnik-v1' → 'zpevnik-v2'.
 */

const CACHE_VERSION = 'zpevnik-v8';

const PRECACHE = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/lib.js',
  './assets/app.js',
  './data/songs.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // Jednotlivě, aby jeden chybějící soubor nerozbil celou instalaci.
      .then(function (cache) {
        return Promise.all(
          PRECACHE.map(function (url) {
            return cache.add(url).catch(function () {
              return null;
            });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key !== CACHE_VERSION) {
              return caches.delete(key);
            }
            return null;
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.match(request).then(function (cached) {
        const network = fetch(request).then(function (response) {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });

        if (cached) {
          // Uživatel dostane uloženou verzi hned, na pozadí se cache obnoví.
          network.catch(function () {});
          return cached;
        }

        return network.catch(function () {
          if (request.mode === 'navigate') {
            return cache.match('./index.html');
          }
          return Response.error();
        });
      });
    })
  );
});
