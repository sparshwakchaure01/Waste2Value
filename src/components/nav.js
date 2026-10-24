import { el, initials } from '../utils.js';
import { state } from '../state.js';
import { signOutUser, isAdminEmail } from '../auth.js';
import { navigate } from '../router.js';
import { brandLockup } from './logo.js';
import { getIncomingRequests } from '../services/requests.js';

// Count of received requests waiting on the seller (pending or discussing).
let badgeCount = 0;
let badgeAt = 0;

function paintBadge() {
  document.querySelectorAll('.nav-badge').forEach(b => {
    b.textContent = String(badgeCount);
    b.hidden = badgeCount === 0;
  });
}

export async function refreshNavBadge(force = false) {
  if (state.userDoc?.role !== 'industry' || !state.firebaseUser) return;
  if (force || Date.now() - badgeAt > 15000) {
    try {
      const incoming = await getIncomingRequests(state.firebaseUser.uid);
      badgeCount = incoming.filter(r => r.status === 'pending' || r.status === 'discussing').length;
      badgeAt = Date.now();
    } catch {
      return;
    }
  }
  paintBadge();
}

export function renderNav() {
  const currentHash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  const role = state.userDoc?.role;
  const isAdmin = isAdminEmail(state.firebaseUser?.email);

  const links = [];
  if (role === 'industry') {
    links.push(
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'marketplace', label: 'Marketplace' },
      { path: 'matches', label: 'My Matches', badge: true },
    );
  } else if (role === 'logistics') {
    links.push(
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'logistics', label: 'Service Area & Deals' },
    );
  }
  if (isAdmin) links.push({ path: 'admin', label: 'Admin' });

  const nav = el('nav', { class: 'topnav' }, [
    el('div', { class: 'topnav-inner' }, [
      el('div', {
        class: 'brand',
        onclick: () => navigate(role ? 'dashboard' : isAdmin ? 'admin' : '')
      }, brandLockup()),
      el('div', { class: 'nav-links' },
        links.map(l => el('a', {
          class: `nav-link ${currentHash === l.path ? 'active' : ''}`,
          onclick: () => navigate(l.path)
        }, [l.label, l.badge ? el('span', { class: 'nav-badge', hidden: true }, '0') : null]))
      ),
      el('div', { class: 'nav-user' }, [
        role ? el('span', { class: 'nav-role-badge' }, role) : null,
        el('div', { class: 'nav-avatar' }, initials(state.userDoc?.name || state.firebaseUser?.displayName || '?')),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: signOutUser }, 'Sign out')
      ])
    ])
  ]);
  queueMicrotask(() => { paintBadge(); refreshNavBadge(); });
  return nav;
}
