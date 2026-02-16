/**
 * sw-helper.js
 * Displays an overlay when the service worker signals an update.
 */

function createUpdatingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'sw-update-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontSize = '24px';
  overlay.style.zIndex = '9999';
  overlay.textContent = 'Updating…';
  document.body.appendChild(overlay);
  return overlay;
}

navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SW_UPDATED') {
    createUpdatingOverlay();
    setTimeout(() => window.location.reload(), 1200);
  }
});
