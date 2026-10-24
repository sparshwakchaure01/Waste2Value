import { el } from '../utils.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

// Multi-select of Maharashtra's 36 districts with search, select-all and clear.
// `selected` is a Set that the picker mutates; `onChange` fires after every change.
export function districtPicker(selected, onChange = () => {}) {
  const grid = el('div', { class: 'district-grid' });
  const chips = new Map();
  const countEl = el('span', { class: 'text-faint' });
  let disabled = false;

  const updateCount = () => { countEl.textContent = `${selected.size} of ${MAHARASHTRA_DISTRICTS.length} selected`; };

  MAHARASHTRA_DISTRICTS.forEach(d => {
    const chip = el('div', { class: `district-chip ${selected.has(d) ? 'selected' : ''}` }, d);
    chip.addEventListener('click', () => {
      if (disabled) return;
      if (selected.has(d)) { selected.delete(d); chip.classList.remove('selected'); }
      else { selected.add(d); chip.classList.add('selected'); }
      updateCount(); onChange(selected);
    });
    chips.set(d, chip);
    grid.appendChild(chip);
  });

  const visible = () => MAHARASHTRA_DISTRICTS.filter(d => chips.get(d).style.display !== 'none');
  const search = el('input', { type: 'search', class: 'input', placeholder: 'Search districts…' });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    chips.forEach((chip, d) => { chip.style.display = d.toLowerCase().includes(q) ? '' : 'none'; });
  });

  const setAll = (on) => {
    if (disabled) return;
    visible().forEach(d => {
      if (on) selected.add(d); else selected.delete(d);
      chips.get(d).classList.toggle('selected', on);
    });
    updateCount(); onChange(selected);
  };

  const root = el('div', {}, [
    el('div', { class: 'district-tools' }, [
      search,
      el('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => setAll(true) }, 'Select all'),
      el('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => setAll(false) }, 'Clear'),
      countEl
    ]),
    grid
  ]);
  updateCount();

  return {
    element: root,
    setDisabled(v) { disabled = v; root.classList.toggle('is-disabled', v); }
  };
}
