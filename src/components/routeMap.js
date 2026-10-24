import { el, formatINR } from '../utils.js';
import { DISTRICT_COORDS, distanceKm, estimateTransport } from '../data/geo.js';

// Constellation-style map of Maharashtra's districts with an animated route between two of them.
const W = 560, H = 440;
const LAT = [15.7, 22.0], LNG = [72.6, 81.0];
const project = ([lat, lng]) => [
  28 + ((lng - LNG[0]) / (LNG[1] - LNG[0])) * (W - 56),
  24 + ((LAT[1] - lat) / (LAT[1] - LAT[0])) * (H - 48)
];

export function routeMap(from, to, { kg = 0, compact = false } = {}) {
  const a = DISTRICT_COORDS[from], b = DISTRICT_COORDS[to];
  const km = distanceKm(from, to);
  const est = estimateTransport(km, kg);

  const dots = Object.entries(DISTRICT_COORDS).map(([name, c]) => {
    const [x, y] = project(c);
    const on = name === from || name === to;
    return on ? '' : `<circle class="rm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"><title>${name}</title></circle>`;
  }).join('');

  let route = '';
  if (a && b) {
    const [x1, y1] = project(a), [x2, y2] = project(b);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(60, len * 0.25);
    const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
    const labelRight = x1 < W / 2;
    route = `
      <path class="rm-path-bg" d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}"/>
      <path class="rm-path" d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}"/>
      <circle class="rm-pulse" cx="${x1}" cy="${y1}" r="9"/>
      <circle class="rm-from" cx="${x1}" cy="${y1}" r="6"/>
      <circle class="rm-to" cx="${x2}" cy="${y2}" r="6"/>
      <text class="rm-label" x="${x1 + (labelRight ? 12 : -12)}" y="${y1 + 4}" text-anchor="${labelRight ? 'start' : 'end'}">${from.split(' (')[0]}</text>
      <text class="rm-label" x="${x2 + (x2 > W / 2 ? -12 : 12)}" y="${y2 + 4}" text-anchor="${x2 > W / 2 ? 'end' : 'start'}">${to.split(' (')[0]}</text>`;
  }

  const wrap = el('div', { class: `route-map ${compact ? 'compact' : ''}` });
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Route from ${from} to ${to}">
      <rect class="rm-bg" x="0" y="0" width="${W}" height="${H}" rx="16"/>${dots}${route}</svg>`;
  if (km != null) {
    wrap.appendChild(el('div', { class: 'route-stats' }, [
      el('div', {}, [el('span', {}, 'Distance'), el('strong', {}, `≈ ${km} km`)]),
      est ? el('div', {}, [el('span', {}, `Est. freight · ${est.vehicle}`), el('strong', {}, `${formatINR(est.low)} – ${formatINR(est.high)}`)]) : null,
      el('em', {}, 'Indicative only — partners set their own price.')
    ]));
  }
  return wrap;
}
