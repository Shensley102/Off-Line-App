/**
 * sw-helper.js
 * Listens for messages from the service worker and shows
 * an updating prompt when a new version is installed.
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
    // Show updating overlay
    createUpdatingOverlay();
    // Reload after a short delay so the user can see the message
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  }
});
