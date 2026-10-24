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
