import { el, initials } from '../utils.js';
import { state } from '../state.js';
import { signOutUser } from '../auth.js';
import { navigate } from '../router.js';
import { ADMIN_EMAILS } from '../data/categories.js';

export function renderNav() {
  const currentHash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  const role = state.userDoc?.role;
  const isAdmin = ADMIN_EMAILS.includes(state.firebaseUser?.email);

  const links = [];
  if (role === 'industry') {
    links.push(
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'marketplace', label: 'Marketplace' },
      { path: 'matches', label: 'My Matches' },
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
        onclick: () => navigate(role ? 'dashboard' : '')
      }, [
        el('div', { class: 'brand-mark' }, '♻️'),
        'Waste2Value'
      ]),
      el('div', { class: 'nav-links' },
        links.map(l => el('a', {
          class: `nav-link ${currentHash === l.path ? 'active' : ''}`,
          onclick: () => navigate(l.path)
        }, l.label))
      ),
      el('div', { class: 'nav-user' }, [
        role ? el('span', { class: 'nav-role-badge' }, role) : null,
        el('div', { class: 'nav-avatar' }, initials(state.userDoc?.name || state.firebaseUser?.displayName || '?')),
        el('button', { class: 'btn btn-ghost btn-sm', onclick: signOutUser }, 'Sign out')
      ])
    ])
  ]);
  return nav;
}
