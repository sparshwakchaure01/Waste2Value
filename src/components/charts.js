import { el } from '../utils.js';

// Horizontal bar chart from [label, value] pairs.
export function barChart(entries) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return el('div', { class: 'bars' }, entries.map(([label, value], i) =>
    el('div', { class: 'bar-row' }, [
      el('span', { class: 'bar-label' }, label),
      el('div', { class: 'bar-track' }, el('div', {
        class: 'bar-fill',
        style: `width:${Math.max(4, (value / max) * 100)}%;animation-delay:${i * 60}ms`
      })),
      el('span', { class: 'bar-val' }, String(value))
    ])
  ));
}

// Area line chart from [label, value] pairs (SVG, no dependencies).
export function lineChart(points, { height = 150 } = {}) {
  const W = 560, H = height, padX = 8, padY = 14;
  const max = Math.max(1, ...points.map(([, v]) => v));
  const step = points.length > 1 ? (W - padX * 2) / (points.length - 1) : 0;
  const xy = points.map(([, v], i) => [padX + i * step, H - padY - (v / max) * (H - padY * 2)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H - padY} L${xy[0][0].toFixed(1)} ${H - padY} Z`;
  const wrap = el('div', { class: 'line-chart' });
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
      <defs><linearGradient id="lc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--teal-bright)" stop-opacity=".35"/><stop offset="1" stop-color="var(--teal-bright)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#lc-g)"/>
      <path d="${line}" fill="none" stroke="var(--teal)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" class="lc-line"/>
      ${xy.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" class="lc-dot"><title>${points[i][0]}: ${points[i][1]}</title></circle>`).join('')}
    </svg>`;
  wrap.appendChild(el('div', { class: 'lc-axis' }, [el('span', {}, points[0]?.[0] || ''), el('span', {}, `peak ${max}`), el('span', {}, points[points.length - 1]?.[0] || '')]));
  return wrap;
}
