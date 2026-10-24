import { el, formatINR, toast } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { totalKg, estimatedValue, listingPhotos } from '../services/listings.js';
import { getMarketStats } from '../services/benchmarks.js';
import { distanceKm } from '../data/geo.js';

// Compare up to three listings side by side. The selection lives in memory for the session.
const MAX = 3;
const picked = new Map();   // id -> listing

export const isCompared = (id) => picked.has(id);
export const compareCount = () => picked.size;

export function toggleCompare(listing) {
  if (picked.has(listing.id)) picked.delete(listing.id);
  else if (picked.size >= MAX) { toast(`You can compare up to ${MAX} listings.`, 'error'); return false; }
  else picked.set(listing.id, listing);
  renderTray();
  return picked.has(listing.id);
}

export function clearCompare() { picked.clear(); renderTray(); }

let tray = null;
export function renderTray() {
  if (!tray) { tray = el('div', { class: 'compare-tray' }); document.body.appendChild(tray); }
  if (!picked.size) { tray.classList.remove('show'); return; }
  tray.replaceChildren(
    el('div', { class: 'compare-thumbs' }, [...picked.values()].map(l => {
      const p = listingPhotos(l)[0];
      return el('span', { class: 'compare-chip' }, [
        p ? el('img', { src: p, alt: '' }) : el('span', {}, '♻️'),
        `${l.category} · ${l.quantity} ${l.unit}`,
        el('button', { title: 'Remove', onclick: () => { picked.delete(l.id); renderTray(); window.dispatchEvent(new Event('w2v-compare-changed')); } }, '×')
      ]);
    })),
    el('div', { class: 'flex gap-8' }, [
      el('button', { class: 'btn btn-ghost-light btn-sm', onclick: () => { clearCompare(); window.dispatchEvent(new Event('w2v-compare-changed')); } }, 'Clear'),
      el('button', { class: 'btn btn-primary btn-sm', disabled: picked.size < 2 ? true : false, onclick: openCompare }, picked.size < 2 ? 'Pick one more' : `Compare ${picked.size}`)
    ])
  );
  tray.classList.add('show');
}

export function hideTray() { tray?.classList.remove('show'); }

async function openCompare() {
  const items = [...picked.values()];
  let stats = {};
  try { stats = await getMarketStats(); } catch { /* benchmark is optional */ }
  const home = state.userDoc?.district;

  const rows = [
    ['Category', l => l.category],
    ['Grade', l => `Grade ${l.grade}`],
    ['Quantity', l => `${l.quantity} ${l.unit}`],
    ['Price / kg', l => `₹${l.costPerKg}`, 'min', l => Number(l.costPerKg)],
    ['Est. total', l => formatINR(estimatedValue(l)), 'min', l => estimatedValue(l)],
    ['vs market avg', l => {
      const s = stats[l.category];
      if (!s || s.count < 2) return '—';
      const d = Math.round(((l.costPerKg - s.avg) / s.avg) * 100);
      return `${d > 0 ? '+' : ''}${d}%`;
    }],
    ['District', l => l.district],
    ['Distance from you', l => { const k = home ? distanceKm(home, l.district) : null; return k == null ? '—' : `≈ ${k} km`; }, 'min', l => (home ? distanceKm(home, l.district) ?? 1e9 : 1e9)],
    ['Availability', l => l.availabilityFrequency],
    ['Volume (kg)', l => totalKg(l).toLocaleString('en-IN'), 'max', l => totalKg(l)]
  ];

  const best = (row) => {
    if (!row[2]) return null;
    const vals = items.map(row[3]);
    return row[2] === 'min' ? Math.min(...vals) : Math.max(...vals);
  };

  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  overlay.appendChild(el('div', { class: 'modal compare-modal' }, [
    el('div', { class: 'flex-between' }, [el('h3', {}, 'Compare listings'), el('button', { class: 'btn btn-ghost btn-sm', onclick: () => overlay.remove() }, 'Close')]),
    el('div', { class: 'table-wrap mt-16' }, el('table', { class: 'compare-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, ''), ...items.map(l => el('th', {}, el('button', { class: 'btn btn-outline btn-sm', onclick: () => { overlay.remove(); navigate(`listing/${l.id}`); } }, `View ${l.category}`)))])),
      el('tbody', {}, rows.map(row => {
        const b = best(row);
        return el('tr', {}, [
          el('td', { class: 'compare-label' }, row[0]),
          ...items.map(l => el('td', { class: b !== null && row[3](l) === b ? 'compare-best' : '' }, row[1](l)))
        ]);
      }))
    ])),
    el('p', { class: 'text-faint mt-8' }, 'Highlighted cells are the best value in each row (lowest price, nearest, largest volume).')
  ]));
  document.body.appendChild(overlay);
}

