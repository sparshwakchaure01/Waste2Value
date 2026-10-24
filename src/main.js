import { $ } from './utils.js';
import { brandMarkSvg } from './components/logo.js';
import { listenAuthState } from './auth.js';
import { initRouter, renderRoute } from './router.js';
import { applyTheme } from './theme.js';
import { initPaletteHotkey } from './components/palette.js';
import { registerServiceWorker, watchConnectivity } from './pwa.js';

// Simple full-screen loader while Firebase resolves the auth session.
function showLoading() {
  const app = $('#app');
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:14px;">
      <div>${brandMarkSvg(48)}</div>
      <div style="color:var(--ink-faint);font-size:13px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;">
        Loading Waste2Value…
      </div>
    </div>`;
}

// Allow /admin and /admin-login as plain paths (e.g. typed into the address bar).
const pathRoute = window.location.pathname.replace(/\/+$/, '');
if (pathRoute === '/admin' || pathRoute === '/admin-login') {
  window.history.replaceState(null, '', `/#${pathRoute}`);
}

applyTheme();
initPaletteHotkey();
registerServiceWorker();
watchConnectivity();
showLoading();

let routerStarted = false;
listenAuthState(() => {
  if (!routerStarted) {
    routerStarted = true;
    initRouter();
  } else {
    renderRoute();
  }
});

// Material-style press ripple on every .btn.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn || btn.disabled) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});
