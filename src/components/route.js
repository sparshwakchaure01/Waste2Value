import { el } from '../utils.js';

// "Pune → Nashik" route display used on transport requests.
export function routeLine(from, to) {
  return el('div', { class: 'route' }, [
    el('div', { class: 'route-stop' }, [el('span', { class: 'route-dot from' }), el('div', {}, [el('div', { class: 'route-label' }, 'Pickup'), el('strong', {}, from || '—')])]),
    el('div', { class: 'route-line' }),
    el('div', { class: 'route-stop' }, [el('span', { class: 'route-dot to' }), el('div', {}, [el('div', { class: 'route-label' }, 'Drop'), el('strong', {}, to || '—')])])
  ]);
}

const STEPS = ['Requested', 'Confirmed', 'In transit', 'Delivered'];
const INDEX = { pending: 0, accepted: 1, in_transit: 2, completed: 3 };

// Four-step progress for a transport job.
export function transportStepper(status) {
  const current = INDEX[status] ?? 0;
  return el('div', { class: 'timeline' }, STEPS.map((label, i) =>
    el('div', { class: `tl-step ${i < current || status === 'completed' ? 'done' : ''} ${i === current && status !== 'completed' ? 'current' : ''}` }, [
      el('span', { class: 'tl-dot' }, i < current || status === 'completed' ? '✓' : ''),
      el('span', { class: 'tl-label' }, label)
    ])
  ));
}
