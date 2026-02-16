/* Workbox powered service worker for aa95 panel with Option2 immediate updates */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.6.2/workbox-sw.js');

if (workbox) {
  console.log('Workbox loaded successfully');

  // Turn off debug logging
  workbox.setConfig({ debug: false });

  /**
   * Precache manifest placeholder
   * Workbox will replace `self.__WB_MANIFEST` with a precache list at build time,
   * OR if you are manually generating a list, it will exist here.
   */
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  /**
   * Immediately take control of the page when a new service worker installs
   * (skip waiting) and claim clients so the new SW starts controlling ASAP.
   */
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  /**
   * Send a message to the client so it can show a UI update prompt
   * after activation, then reload the page (Option2 behavior).
   */
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      clients.matchAll().then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      })
    );
  });

  /**
   * Navigation route handler:
   *   Use NetworkFirst for HTML pages (so updates fetch new HTML),
   *   fallback to cache if offline.
   */
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 3
    })
  );

  /**
   * Static assets handler:
   *   Use CacheFirst for scripts/styles/images with a long expiration.
   */
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
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Days
        })
      ]
    })
  );

  console.log('Service Worker registered and routing set up.');

} else {
  console.warn('Workbox failed to load.');
}
