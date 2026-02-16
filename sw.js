/* sw.js - simple service worker (no workbox) */

const CACHE_NAME = "radio-sim-v2";

/*
  Adjust these paths ONLY if your files move.
  These match your current repo screenshots.
*/
const ASSETS = [
  "/",
  "/aa95.html",
  "/manifest.json",

  // AA95 assets
  "/aa95/styles.css",
  "/aa95/index.js",
  "/aa95/config.js",
  "/aa95/dom.js",
  "/aa95/event.js",
  "/aa95/pwa.js",
  "/aa95/render.js",
  "/aa95/selector.js",
  "/aa95/state.js",
  "/aa95/status.js",
  "/aa95/sw-helper.js",
  "/aa95/toggleMotion.js",
  "/aa95/toggles.js",
  "/aa95/aa95-panel.svg"
];

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(k => (k === CACHE_NAME ? null : caches.delete(k)))
      );
      await self.clients.claim();
    })()
  );
});

// FETCH
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  // Navigation fallback (for /control-panel route)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/aa95.html"))
    );
    return;
  }

  // Cache-first for assets
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(resp => {
        if (resp.ok && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return resp;
      });
    })
  );
});
