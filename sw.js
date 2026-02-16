/* sw.js - service worker for Aviation Simulators PWA */

const CACHE_NAME = "radio-sim-v3";

const ASSETS = [
  "/",
  "/index.html",
  "/aa95.html",
  "/rc9100.html",
  "/manifest.json",
  "/codeplug.json",

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
  "/aa95/aa95-panel.svg",

  // Icons
  "/icons/icon-16.png",
  "/icons/icon-32.png",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png"
];

// Map clean URLs to actual HTML files for offline support
const ROUTE_MAP = {
  "/control-panel": "/aa95.html",
  "/radio": "/rc9100.html"
};

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

  const url = new URL(req.url);

  // Handle navigation requests (HTML pages)
  if (req.mode === "navigate") {
    // Check if this is a mapped route
    const mappedFile = ROUTE_MAP[url.pathname];
    
    event.respondWith(
      fetch(req)
        .then(response => {
          // If response is ok, return it
          if (response.ok) return response;
          
          // If 404 and we have a mapped route, serve the cached HTML
          if (response.status === 404 && mappedFile) {
            return caches.match(mappedFile) || response;
          }
          return response;
        })
        .catch(() => {
          // Network failed - serve from cache
          if (mappedFile) {
            return caches.match(mappedFile);
          }
          return caches.match(url.pathname) || caches.match("/index.html");
        })
    );
    return;
  }

  // Cache-first for other assets
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      
      return fetch(req).then(resp => {
        if (resp.ok && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return resp;
      });
    })
  );
});
