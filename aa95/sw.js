/* AA95 PWA service worker (static, versioned). */
const CACHE_VERSION = "aa95-20260213202301";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/aa95.html",
  "/manifest.json",
  "/app/aa95/index.js",
  "/app/aa95/config.js",
  "/app/aa95/state.js",
  "/app/aa95/render.js",
  "/app/aa95/status.js",
  "/app/aa95/toggles.js",
  "/app/aa95/selector.js",
  "/app/aa95/events.js",
  "/app/aa95/toggleMotion.js",
  "/app/aa95/pwa.js",
  "/app/aa95/styles.css",
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

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => k !== CACHE_VERSION ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  // Navigation: network-first so HTML updates quickly after deploy
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("/aa95.html") || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Static assets: cache-first with background refresh
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone());
        } catch {}
      })());
      return cached;
    }

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return new Response("", { status: 504 });
    }
  })());
});

// Allow the page to trigger immediate activation (optional)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
