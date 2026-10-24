import { el, initials } from '../utils.js';
import { state } from '../state.js';
import { signOutUser, isAdminEmail } from '../auth.js';
import { navigate } from '../router.js';
import { brandLockup } from './logo.js';
import { getIncomingRequests } from '../services/requests.js';
import { getInsights, buildNotifications, unreadCount } from '../services/insights.js';
import { openPalette } from './palette.js';
import { icon } from './logo.js';

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

if (typeof document !== 'undefined' && !window.__w2vMenuClose) {
  window.__w2vMenuClose = true;
  document.addEventListener('click', () => document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open')));
}

// Unread notification count on the bell (and the drawer's Notifications link).
let bellCount = 0;
function paintBell() {
  document.querySelectorAll('.bell-badge').forEach(b => { b.textContent = bellCount > 9 ? '9+' : String(bellCount); b.hidden = bellCount === 0; });
}
export async function refreshBell(force = false) {
  if (!state.userDoc?.role || !state.firebaseUser) return;
  try {
    const events = buildNotifications(await getInsights(force));
    bellCount = unreadCount(events, state.userDoc.notifSeenAt);
  } catch { return; }
  paintBell();
}

export function closeNav() {
  document.body.classList.remove('nav-open');
}

export function renderNav() {
  closeNav();
  const currentHash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  const role = state.userDoc?.role;
  const isAdmin = isAdminEmail(state.firebaseUser?.email);

  const links = [];
  if (role === 'industry') {
    links.push(
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'marketplace', label: 'Marketplace' },
      { path: 'my-listings', label: 'My Listings', match: ['my-listings', 'edit-listing', 'create-listing'] },
      { path: 'matches', label: 'My Matches', badge: true },
    );
  } else if (role === 'logistics') {
    links.push(
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'logistics', label: 'Transport Jobs' },
    );
  }
  if (isAdmin) links.push({ path: 'admin', label: 'Admin' });

  const profileActive = currentHash === 'profile';
  const linkEl = (l) => el('a', {
    class: `nav-link ${(l.match || [l.path]).includes(currentHash) ? 'active' : ''}`,
    onclick: () => { closeNav(); navigate(l.path); }
  }, [l.label, l.badge ? el('span', { class: 'nav-badge', hidden: true }, '0') : null]);

  const name = state.userDoc?.companyName || state.userDoc?.name || state.firebaseUser?.displayName || '';
  const avatarText = initials(state.userDoc?.name || state.firebaseUser?.displayName || '?');
  const toggle = el('button', {
    class: 'nav-toggle', 'aria-label': 'Menu',
    onclick: () => document.body.classList.toggle('nav-open')
  }, [el('span'), el('span'), el('span')]);

  const goProfile = () => { closeNav(); menu.classList.remove('open'); navigate('profile'); };
  const menu = el('div', { class: 'user-menu' }, [
    el('div', { class: 'user-menu-head' }, [el('strong', {}, name || 'Signed in'), el('span', {}, state.firebaseUser?.email || '')]),
    el('button', { class: 'user-menu-item', onclick: goProfile }, 'My Profile'),
    el('button', { class: 'user-menu-item', onclick: signOutUser }, 'Sign out')
  ]);
  const avatarBtn = el('button', {
    class: `nav-avatar nav-avatar-btn ${profileActive ? 'active' : ''}`, 'aria-label': 'Account menu', title: 'Account',
    onclick: (e) => { e.stopPropagation(); menu.classList.toggle('open'); }
  }, avatarText);
  const userMenu = el('div', { class: 'user-menu-wrap' }, [avatarBtn, menu]);

  const searchBtn = role ? el('button', { class: 'nav-search', onclick: () => openPalette(), 'aria-label': 'Search and commands' }, [icon('search', 15), el('span', { class: 'ns-label' }, 'Search'), el('kbd', {}, 'Ctrl K')]) : null;
  const bell = role ? el('button', { class: `nav-bell ${currentHash === 'notifications' ? 'active' : ''}`, 'aria-label': 'Notifications', onclick: () => { closeNav(); navigate('notifications'); } }, [icon('bell', 19), el('span', { class: 'bell-badge', hidden: true }, '0')]) : null;

  const nav = el('nav', { class: 'topnav' }, [
    el('div', { class: 'topnav-inner' }, [
      el('div', {
        class: 'brand',
        onclick: () => { closeNav(); navigate(role ? 'dashboard' : isAdmin ? 'admin' : ''); }
      }, brandLockup()),
      el('div', { class: 'nav-links' }, links.map(linkEl)),
      el('div', { class: 'nav-user' }, [
        searchBtn,
        bell,
        role ? el('span', { class: 'nav-role-badge' }, role) : null,
        userMenu,
        toggle
      ])
    ]),
    // Mobile drawer
    el('div', { class: 'nav-drawer' }, [
      ...links.map(linkEl),
      role ? el('a', { class: `nav-link ${currentHash === 'notifications' ? 'active' : ''}`, onclick: () => { closeNav(); navigate('notifications'); } }, ['Notifications', el('span', { class: 'bell-badge', style: 'position:static;', hidden: true }, '0')]) : null,
      el('a', { class: `nav-link ${profileActive ? 'active' : ''}`, onclick: goProfile }, 'My Profile'),
      el('div', { class: 'nav-drawer-user' }, [
        el('div', { class: 'nav-avatar' }, avatarText),
        el('div', {}, [el('div', { style: 'color:#fff;font-weight:700;' }, name || 'Signed in'), role ? el('div', {}, role) : null])
      ]),
      el('button', { class: 'btn btn-outline btn-block', onclick: signOutUser }, 'Sign out')
    ]),
    el('div', { class: 'nav-scrim', onclick: closeNav })
  ]);
  queueMicrotask(() => { paintBadge(); paintBell(); refreshNavBadge(); refreshBell(); });
  return nav;
}
