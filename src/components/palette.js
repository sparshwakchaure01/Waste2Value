import { el } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { signOutUser, isAdminEmail } from '../auth.js';
import { getListings, listingPhotos } from '../services/listings.js';
import { ACCENTS, getTheme, setTheme } from '../theme.js';
import { canInstall, installApp } from '../pwa.js';
import { icon } from './logo.js';

// Ctrl/⌘+K command palette: jump to any page, run quick actions, or search live listings.
let openState = null;

function buildCommands(close) {
  const role = state.userDoc?.role;
  const go = (path) => () => { close(); navigate(path); };
  const cmds = [];
  const add = (label, hint, ic, run, keywords = '') => cmds.push({ label, hint, ic, run, keywords });

  if (role === 'industry') {
    add('Dashboard', 'Go to', 'chart', go('dashboard'), 'home overview');
    add('Marketplace', 'Go to', 'grid', go('marketplace'), 'browse buy listings');
    add('New listing', 'Create', 'plus', go('create-listing'), 'sell publish add');
    add('My listings', 'Go to', 'boxes', go('my-listings'), 'edit manage');
    add('Bulk upload listings (CSV)', 'Create', 'upload', go('bulk-upload'), 'import csv excel');
    add('My matches', 'Go to', 'inbox', go('matches'), 'requests deals');
  } else if (role === 'logistics') {
    add('Dashboard', 'Go to', 'chart', go('dashboard'), 'home overview');
    add('Transport jobs', 'Go to', 'truck', go('logistics'), 'requests pickup');
  }
  if (role) {
    add('Notifications', 'Go to', 'bell', go('notifications'), 'alerts inbox');
    add('My profile', 'Go to', 'user', go('profile'), 'account settings');
  }
  if (isAdminEmail(state.firebaseUser?.email)) add('Admin panel', 'Go to', 'shield', go('admin'), 'moderate users');

  add('Replay the guided tour', 'Help', 'spark', async () => { close(); (await import('./tour.js')).startTour(true); }, 'walkthrough onboarding help');
  Object.entries(ACCENTS).forEach(([key, a]) => add(`Accent: ${a.label}`, 'Appearance', 'spark', () => { setTheme({ accent: key }); close(); }, 'colour color theme'));
  add(getTheme().compact ? 'Switch to comfortable density' : 'Switch to compact density', 'Appearance', 'rows', () => { setTheme({ compact: !getTheme().compact }); close(); }, 'compact density spacing');
  if (canInstall()) add('Install Waste2Value app', 'App', 'download', () => { close(); installApp(); }, 'pwa install');
  add('Sign out', 'Account', 'user', () => { close(); signOutUser(); }, 'logout');
  return cmds;
}

export function openPalette() {
  if (openState) return;
  if (!state.firebaseUser) return;
  const close = () => {
    if (!openState) return;
    openState.overlay.remove();
    document.removeEventListener('keydown', openState.onKey, true);
    openState = null;
  };

  const input = el('input', { class: 'palette-input', type: 'text', placeholder: 'Type a command or search listings…', autocomplete: 'off', spellcheck: 'false' });
  const list = el('div', { class: 'palette-list', role: 'listbox' });
  const overlay = el('div', { class: 'palette-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, [
    el('div', { class: 'palette' }, [
      el('div', { class: 'palette-head' }, [icon('search', 18), input, el('kbd', {}, 'Esc')]),
      list,
      el('div', { class: 'palette-foot' }, [el('span', {}, '↑↓ navigate'), el('span', {}, '↵ select'), el('span', {}, 'Ctrl K to toggle')])
    ])
  ]);
  document.body.appendChild(overlay);

  const commands = buildCommands(close);
  let listings = null;          // loaded lazily for industry users
  let active = 0;
  let shown = [];

  async function loadListings() {
    if (state.userDoc?.role !== 'industry') return;
    try { listings = (await getListings({ status: 'Available' })).filter(l => l.ownerId !== state.firebaseUser.uid); } catch { listings = []; }
    render();
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    const cmdHits = commands.filter(c => !q || `${c.label} ${c.keywords}`.toLowerCase().includes(q)).slice(0, q ? 6 : 12);
    const listingHits = q.length >= 2 && listings
      ? listings.filter(l => `${l.category} ${l.district} ${l.grade} ${l.description || ''}`.toLowerCase().includes(q)).slice(0, 5)
      : [];

    shown = [
      ...cmdHits.map(c => ({ ...c, type: 'cmd' })),
      ...listingHits.map(l => ({
        type: 'listing', label: `${l.category} · ${l.quantity} ${l.unit}`, hint: `${l.district} · ₹${l.costPerKg}/kg · Grade ${l.grade}`,
        ic: 'boxes', run: () => { close(); navigate(`listing/${l.id}`); }, photo: listingPhotos(l)[0]
      }))
    ];
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.replaceChildren(...(shown.length ? shown.map((s, i) => el('button', {
      class: `palette-item ${i === active ? 'active' : ''}`, role: 'option',
      onmousemove: () => { active = i; paintActive(); }, onclick: () => s.run()
    }, [
      s.photo ? el('img', { src: s.photo, alt: '' }) : el('span', { class: 'palette-ic' }, icon(s.ic || 'spark', 16)),
      el('span', { class: 'palette-label' }, s.label),
      el('span', { class: 'palette-hint' }, s.hint)
    ])) : [el('div', { class: 'palette-empty' }, 'No matches')]));
  }

  function paintActive() {
    list.querySelectorAll('.palette-item').forEach((n, i) => n.classList.toggle('active', i === active));
    list.querySelector('.palette-item.active')?.scrollIntoView({ block: 'nearest' });
  }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); paintActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); paintActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); shown[active]?.run(); }
    else if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); close(); }
  };
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', () => { active = 0; render(); });

  openState = { overlay, onKey };
  render();
  input.focus();
  loadListings();
}

export function initPaletteHotkey() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openPalette(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openPalette(); }
  });
}
