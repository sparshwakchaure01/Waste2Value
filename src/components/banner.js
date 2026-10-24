import { el } from '../utils.js';
import { getAnnouncement } from '../services/announcement.js';

// Platform announcement banner (set by admins). Dismissal is remembered per announcement for the session.
const dismissKey = (a) => `w2v-ann-${a.text.length}-${a.text.slice(0, 24)}`;

export function renderBanner() {
  const host = el('div', {});
  getAnnouncement().then(a => {
    if (!a || !a.active || !a.text) return;
    try { if (sessionStorage.getItem(dismissKey(a))) return; } catch { /* storage unavailable */ }
    const bar = el('div', { class: `announce ${a.tone === 'warn' ? 'warn' : a.tone === 'alert' ? 'alert' : ''}`, role: 'status' }, [
      el('span', {}, a.text),
      el('button', {
        'aria-label': 'Dismiss',
        onclick: () => { try { sessionStorage.setItem(dismissKey(a), '1'); } catch { /* ignore */ } bar.remove(); }
      }, '×')
    ]);
    host.appendChild(bar);
  }).catch(() => {});
  return host;
}
