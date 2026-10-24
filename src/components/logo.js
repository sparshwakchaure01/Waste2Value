import { el } from '../utils.js';

// Brand mark: an open ring (the material loop) closing on a gold node (the value
// recovered). Drawn in brand tokens so it follows the design system.
const MARK_PATH = 'M22.96 11.12 A8.5 8.5 0 1 1 16.74 7.53';

export function brandMarkSvg(size = 32) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="32" height="32" rx="9" style="fill:var(--teal)"/>
    <path d="${MARK_PATH}" stroke="#FBF9F5" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="16.74" cy="7.53" r="2.7" style="fill:var(--gold)"/>
  </svg>`;
}

export function brandMark(size = 32) {
  const node = el('span', { class: 'brand-mark' });
  node.innerHTML = brandMarkSvg(size);
  return node;
}

// "Waste2Value" wordmark with the 2 picked out in gold.
export function brandWordmark() {
  return el('span', { class: 'brand-word' }, [
    'Waste', el('span', { class: 'brand-two' }, '2'), 'Value'
  ]);
}

export function brandLockup() {
  return [brandMark(), brandWordmark()];
}

// 24px line icons, stroke inherits currentColor.
const ICONS = {
  factory: '<path d="M3 21V10l6 3.5V10l6 3.5V6h3v15z"/><path d="M3 21h18"/><path d="M8 17h1M12 17h1M16 17h1"/>',
  truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  list: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'
};

export function icon(name, size = 24) {
  const node = el('span', { class: 'icon' });
  node.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return node;
}
