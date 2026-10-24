import { toast } from './utils.js';

// Installable app support: install prompt, service worker, and an offline indicator.
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new Event('w2v-installable'));
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('Waste2Value installed.', 'success'); });

export const canInstall = () => !!deferredPrompt;

export async function installApp() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  return true;
}

export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

export function watchConnectivity() {
  const bar = document.createElement('div');
  bar.className = 'offline-bar';
  bar.textContent = 'You’re offline — showing what’s already loaded. Changes need a connection.';
  document.body.appendChild(bar);
  const update = () => bar.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
