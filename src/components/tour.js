import { el } from '../utils.js';
import { state } from '../state.js';
import { saveProfile } from '../services/profile.js';

// First-run guided tour: spotlight + tooltip, per role. Auto-starts once; can be replayed from the palette / profile.
const STEPS = {
  industry: [
    { title: 'Welcome to Waste2Value', text: 'List plastic scrap, find material you can reuse, and close deals without exposing your identity until both sides agree. Here’s a 30-second tour.' },
    { sel: '.nav-links', mobileSel: '.nav-toggle', title: 'Your workspace', text: 'Marketplace to browse, My Listings to sell and edit, My Matches for requests, counter-offers and deals.' },
    { sel: '.qa-grid', title: 'Quick actions', text: 'Publish a listing in a minute — or bulk-upload many from a CSV.' },
    { sel: '.attention', title: 'Needs your attention', text: 'Replies, counter-offers, transport partners to pick and saved-search alerts surface here so nothing slips.' },
    { sel: '.nav-avatar-btn', mobileSel: '.nav-toggle', title: 'Profile & account', text: 'Complete your profile and verify your details — buyers trust complete profiles.' },
    { title: 'Power tip', text: 'Press Ctrl K (or /) anywhere to jump to any page or search live listings. You’re all set!' }
  ],
  logistics: [
    { title: 'Welcome, transport partner', text: 'Buyers and sellers of confirmed deals can request you directly. Only requests sent to you appear here.' },
    { sel: '.nav-avatar-btn', mobileSel: '.nav-toggle', title: 'Set your service area', text: 'Open My Profile to add your vehicle and the districts you cover — or tick “any district”.' },
    { sel: '.nav-links', mobileSel: '.nav-toggle', title: 'Transport jobs', text: 'Accept a request to unlock both parties’ contacts, then mark pickup and delivery as you go.' },
    { title: 'Power tip', text: 'Press Ctrl K (or /) anywhere to jump around quickly. Happy hauling!' }
  ]
};

const flagKey = () => `w2v-tour-${state.firebaseUser?.uid}`;
const seenLocally = () => { try { return localStorage.getItem(flagKey()) === '1'; } catch { return false; } };

export function shouldAutoStart() {
  const u = state.userDoc;
  return !!u && !!STEPS[u.role] && !u.tourDone && !seenLocally();
}

let active = null;

export function startTour(force = false) {
  if (active) return;
  const role = state.userDoc?.role;
  const steps = STEPS[role];
  if (!steps || (!force && !shouldAutoStart())) return;

  let i = 0;
  const spot = el('div', { class: 'tour-spot' });
  const card = el('div', { class: 'tour-card' });
  const overlay = el('div', { class: 'tour-overlay' }, [spot, card]);
  document.body.appendChild(overlay);
  active = overlay;

  async function finish() {
    overlay.remove();
    window.removeEventListener('resize', place);
    active = null;
    try { localStorage.setItem(flagKey(), '1'); } catch { /* storage unavailable */ }
    if (!state.userDoc.tourDone) { try { await saveProfile(state.firebaseUser.uid, { tourDone: true }); } catch { /* offline: local flag is enough */ } }
  }

  function target(step) {
    for (const sel of [step.sel, step.mobileSel]) {
      if (!sel) continue;
      const node = document.querySelector(sel);
      const r = node?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) return { node, r };
    }
    return null;
  }

  function place() {
    const step = steps[i];
    const t = target(step);
    card.replaceChildren(
      el('div', { class: 'tour-step' }, `${i + 1} / ${steps.length}`),
      el('h3', {}, step.title),
      el('p', {}, step.text),
      el('div', { class: 'tour-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', onclick: finish }, i === steps.length - 1 ? 'Close' : 'Skip'),
        el('div', { class: 'flex gap-8' }, [
          i > 0 ? el('button', { class: 'btn btn-outline btn-sm', onclick: () => { i--; place(); } }, 'Back') : null,
          el('button', { class: 'btn btn-primary btn-sm', onclick: () => { if (i === steps.length - 1) finish(); else { i++; place(); } } }, i === steps.length - 1 ? 'Done' : 'Next')
        ])
      ])
    );

    if (t) {
      t.node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const r = t.node.getBoundingClientRect();
      const pad = 8;
      Object.assign(spot.style, { display: 'block', top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      const below = r.bottom + 16 + 190 < window.innerHeight;
      const cardW = Math.min(340, window.innerWidth - 24);
      card.style.width = `${cardW}px`;
      card.style.left = `${Math.max(12, Math.min(window.innerWidth - cardW - 12, r.left))}px`;
      card.style.top = below ? `${r.bottom + 16}px` : `${Math.max(12, r.top - 16 - card.offsetHeight)}px`;
      card.style.transform = 'none';
    } else {
      spot.style.display = 'none';
      overlay.classList.add('dim');
      card.style.width = `${Math.min(380, window.innerWidth - 24)}px`;
      card.style.left = '50%'; card.style.top = '50%'; card.style.transform = 'translate(-50%, -50%)';
    }
    overlay.classList.toggle('dim', !t);
  }

  window.addEventListener('resize', place);
  place();
}
