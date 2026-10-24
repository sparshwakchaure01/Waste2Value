import { el } from '../utils.js';

// Small line illustrations (currentColor = brand emerald) for empty states.
const ILLUS = {
  listings: '<rect x="22" y="30" width="76" height="52" rx="8"/><path d="M22 46h76M42 30v-8h36v8"/><path d="M40 62h14M40 72h24" opacity=".5"/>',
  requests: '<path d="M22 28h76v44H58l-16 14V72H22z"/><path d="M38 44h44M38 56h28" opacity=".5"/>',
  saved: '<path d="M60 22l10.4 21 23.1 3.4-16.7 16.3 3.9 23-20.7-10.9-20.7 10.9 3.9-23L26.5 46.4l23.1-3.4z"/>',
  deals: '<path d="M16 34h54v38H16z"/><path d="M70 46h18l14 14v12H70z"/><circle cx="34" cy="76" r="7"/><circle cx="88" cy="76" r="7"/>',
  search: '<circle cx="54" cy="46" r="22"/><path d="M70 62l24 22"/><path d="M44 46h20" opacity=".5"/>',
  partners: '<circle cx="42" cy="40" r="12"/><path d="M20 82c0-14 10-24 22-24s22 10 22 24"/><circle cx="82" cy="46" r="9" opacity=".6"/><path d="M70 82c1-10 6-18 14-18s13 8 13 18" opacity=".6"/>'
};

export function emptyState(kind, text, action = null) {
  const wrap = el('span', {});
  wrap.innerHTML = `<svg class="illus" viewBox="0 0 120 96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ILLUS[kind] || ILLUS.search}</svg>`;
  return el('div', { class: 'empty-state' }, [wrap, el('p', {}, text), action]);
}
