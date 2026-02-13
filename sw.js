const CACHE_NAME = 'rc9100-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/radio',
  '/rc9100.html',
  '/control-panel',
  '/aa95.html',
  '/manifest.json',
  '/codeplug.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/aa95/panel-bg.jpg',
  '/images/aa95/com1_toggle.png',
  '/images/aa95/com2_toggle.png',
  '/images/aa95/fm1_toggle.png',
  '/images/aa95/fm2_toggle.png',
  '/images/aa95/aux_toggle.png',
  '/images/aa95/adf_toggle.png',
  '/images/aa95/dplr_toggle.png',
  '/images/aa95/pat_toggle.png',
  '/images/aa95/iso_emr.png',
  '/images/aa95/key_toggle.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});
