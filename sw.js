/* sw.js - service worker for Aviation Simulators PWA */

const CACHE_NAME = "radio-sim-v6";

const ASSETS = [
  "/",
  "/index.html",
  "/rc9100.html",
  "/manifest.json",
  "/codeplug.json",

  // AA95 assets (real photo cutout system)
  "/aa95/aa95.html",
  "/aa95/styles.css",
  "/aa95/panel.js",
  
  // Base panel
  "/aa95/assests/img_001.webp",
  
  // Real photo cutouts
  "/aa95/assests/toggle-white.webp",
  "/aa95/assests/mic-lever.webp",
  "/aa95/assests/iso-emr.webp",
  "/aa95/assests/selector-knob.webp",
  "/aa95/assests/rx-knob.webp",
  "/aa95/assests/ics-knob.webp",
  "/aa95/assests/vox-knob.webp",
  "/aa95/assests/ics-call-btn.webp",

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

// Map clean URLs to HTML files
const ROUTE_MAP = {
  "/control-panel": "/aa95/aa95.html",
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

  // Navigation requests: network-first
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(req, clone);
            });
          }
          return response;
        })
        .catch(() => {
          const url = new URL(req.url);
          const mappedFile = ROUTE_MAP[url.pathname];
          
          if (mappedFile) {
            return caches.match(mappedFile);
          }
          return caches.match(req) || caches.match("/index.html");
        })
    );
    return;
  }

  // Other assets: cache-first
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
