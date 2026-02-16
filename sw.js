/**
 * sw.js — Workbox service worker (local import)
 * Option 2: immediate update with "Updating…" notification
 */

importScripts('/lib/workbox/workbox-sw.js');

if (workbox) {
  console.log('Workbox loaded');

  workbox.setConfig({ debug: false });

  // Precache all generated assets
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  // Immediately activate new service worker
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Notify client that update occurred
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      clients.matchAll().then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      })
    );
  });

  // Navigation: network first
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 3,
    })
  );

  // Static assets: cache first
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'asset-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        }),
      ],
    })
  );

} else {
  console.warn('Workbox failed to load.');
}
