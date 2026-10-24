import { el, debounce } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getListings, filterListingsClientSide } from '../services/listings.js';
import { PLASTIC_CATEGORIES, GRADES, FREQUENCIES } from '../data/categories.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

export async function renderMarketplace(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [ el('h1', {}, 'Marketplace'), el('p', {}, 'Browse available plastic scrap and by-products across Maharashtra.') ])
  ]));

  const filters = { category: '', grade: '', district: '', frequency: '', maxPrice: '', search: '' };
  const gridEl = el('div', { class: 'grid-marketplace' });

  const filterBar = el('div', { class: 'filter-bar' }, [
    el('input', { type: 'text', placeholder: 'Search…', oninput: debounce(e => { filters.search = e.target.value; refresh(); }, 250) }),
    selectEl('All Categories', PLASTIC_CATEGORIES.map(c => [c.code, c.code]), v => { filters.category = v; refresh(); }),
    selectEl('All Grades', GRADES.map(g => [g.code, `Grade ${g.code}`]), v => { filters.grade = v; refresh(); }),
    selectEl('All Districts', MAHARASHTRA_DISTRICTS.map(d => [d, d]), v => { filters.district = v; refresh(); }),
    selectEl('Any Frequency', FREQUENCIES.map(f => [f, f]), v => { filters.frequency = v; refresh(); }),
    el('input', { type: 'number', placeholder: 'Max ₹/kg', style: 'width:110px;', oninput: debounce(e => { filters.maxPrice = e.target.value; refresh(); }, 250) }),
  ]);

  container.appendChild(filterBar);
  container.appendChild(gridEl);

  let allListings = [];
  async function load() {
    const data = await getListings({ status: 'Available' });
    allListings = data.filter(l => l.ownerId !== state.firebaseUser.uid);
    refresh();
  }
  function refresh() {
    const filtered = filterListingsClientSide(allListings, filters);
    gridEl.innerHTML = '';
    if (!filtered.length) {
      gridEl.appendChild(el('div', { class: 'empty-state', style: 'grid-column:1/-1;' }, [
        el('div', { class: 'ic' }, '📦'),
        el('p', {}, 'No listings match your filters yet.')
      ]));
      return;
    }
    filtered.forEach(l => gridEl.appendChild(listingCard(l)));
  }
  await load();
}

function selectEl(placeholder, options, onChange) {
  const sel = el('select', { onchange: e => onChange(e.target.value) },
    [el('option', { value: '' }, placeholder)].concat(options.map(([v, label]) => el('option', { value: v }, label)))
  );
  return sel;
}

function listingCard(l) {
  return el('div', { class: 'card listing-card', onclick: () => navigate(`listing/${l.id}`) }, [
    l.photoBase64
      ? el('img', { class: 'listing-photo', src: l.photoBase64, alt: l.category })
      : el('div', { class: 'listing-photo-placeholder' }, '♻️'),
    el('div', { class: 'listing-body' }, [
      el('div', { class: 'listing-cat' }, l.category),
      el('div', { class: 'listing-title' }, `${l.quantity} ${l.unit}`),
      el('div', { class: 'flex gap-8' }, [
        el('span', { class: `pill pill-grade-${l.grade?.toLowerCase()}` }, `Grade ${l.grade}`),
        el('span', { class: 'pill pill-neutral' }, l.district)
      ]),
      el('div', { class: 'listing-meta' }, [
        el('span', { class: 'listing-price' }, `₹${l.costPerKg}/kg`),
        el('span', {}, l.availabilityFrequency)
      ])
    ])
  ]);
}
