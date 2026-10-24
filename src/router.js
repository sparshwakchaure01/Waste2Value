import { $ } from './utils.js';
import { state } from './state.js';
import { isAdminEmail } from './auth.js';

import { renderLanding } from './pages/landing.js';
import { renderOnboarding } from './pages/onboarding.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderMarketplace } from './pages/marketplace.js';
import { renderListingDetail } from './pages/listingDetail.js';
import { renderCreateListing, renderEditListing } from './pages/createListing.js';
import { renderMatches } from './pages/matches.js';
import { renderLogistics } from './pages/logistics.js';
import { renderAdmin } from './pages/admin.js';
import { renderAdminLogin } from './pages/adminLogin.js';
import { renderMyListings } from './pages/myListings.js';
import { renderNav } from './components/nav.js';

const routes = [
  { path: '', auth: false, render: renderLanding },
  { path: 'onboarding', auth: true, render: renderOnboarding },
  { path: 'dashboard', auth: true, requiresRole: true, render: renderDashboard },
  { path: 'marketplace', auth: true, requiresRole: true, roles: ['industry'], render: renderMarketplace },
  { path: 'listing/:id', auth: true, requiresRole: true, roles: ['industry'], render: renderListingDetail },
  { path: 'create-listing', auth: true, requiresRole: true, roles: ['industry'], render: renderCreateListing },
  { path: 'my-listings', auth: true, requiresRole: true, roles: ['industry'], render: renderMyListings },
  { path: 'edit-listing/:id', auth: true, requiresRole: true, roles: ['industry'], render: renderEditListing },
  { path: 'matches', auth: true, requiresRole: true, roles: ['industry'], render: renderMatches },
  { path: 'logistics', auth: true, requiresRole: true, roles: ['logistics'], render: renderLogistics },
  { path: 'admin-login', auth: false, render: renderAdminLogin },
  { path: 'admin', auth: false, adminOnly: true, render: renderAdmin },
];

function matchRoute(hash) {
  const clean = hash.replace(/^#\/?/, '');
  const parts = clean.split('/').filter(Boolean);
  for (const route of routes) {
    const routeParts = route.path.split('/').filter(Boolean);
    if (routeParts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) params[routeParts[i].slice(1)] = parts[i];
      else if (routeParts[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#/${path}`;
}

export function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}

export function renderRoute() {
  const app = $('#app');
  const matched = matchRoute(window.location.hash || '#/');

  if (!matched) {
    app.innerHTML = '';
    app.appendChild(renderNav());
    const body = document.createElement('div');
    body.className = 'container page-body';
    body.innerHTML = `<div class="empty-state"><div class="ic">🔍</div><h3>Page not found</h3></div>`;
    app.appendChild(body);
    return;
  }

  const { route, params } = matched;

  // Auth gating
  if (route.adminOnly && !state.firebaseUser) { navigate('admin-login'); return; }
  if (route.auth && !state.firebaseUser) { navigate(''); return; }
  if (route.requiresRole && state.firebaseUser && !state.userDoc) { navigate('onboarding'); return; }
  if (route.path === 'onboarding' && state.userDoc) { navigate('dashboard'); return; }
  if (route.path === '' && state.firebaseUser && state.userDoc) { navigate('dashboard'); return; }

  if (route.roles && state.userDoc && !route.roles.includes(state.userDoc.role)) { navigate('dashboard'); return; }
  if (route.adminOnly && !isAdminEmail(state.firebaseUser?.email)) { navigate(state.userDoc ? 'dashboard' : 'admin-login'); return; }

  app.innerHTML = '';
  if (route.path !== '' && route.path !== 'admin-login') app.appendChild(renderNav());
  const body = document.createElement('div');
  body.className = route.path === '' ? 'page-body' : 'container page-body';
  app.appendChild(body);
  Promise.resolve(route.render(body, params)).catch(err => {
    console.error(err);
    body.innerHTML = `<div class="empty-state"><div class="ic">⚠️</div><h3>Something went wrong</h3><p>${err.code || err.message || 'Please try again.'}</p></div>`;
  });
}
