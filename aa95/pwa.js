// Lightweight SW registration for static hosting.
// If you later move to Workbox/VitePWA, you can delete this and let the plugin handle it.
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    // Optional: listen for waiting SW and auto-refresh when activated
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        // When a new SW takes over, reload so new assets are used.
        if (sw.state === "activated") {
          // no forced reload; keep quiet
        }
      });
    });
  } catch (err) {
    // SW failures should never break the sim panel
    console.warn("SW register failed:", err);
  }
}
