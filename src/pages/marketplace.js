import { el, debounce, toast, skeletonCards } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getListings, filterListingsClientSide, sortListings, SORT_OPTIONS } from '../services/listings.js';
import { toggleSaved, isSaved, savedIds } from '../services/saved.js';
import { PLASTIC_CATEGORIES, GRADES, FREQUENCIES } from '../data/categories.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

export async function renderMarketplace(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [ el('h1', {}, 'Marketplace'), el('p', {}, 'Browse available plastic scrap and by-products across Maharashtra.') ])
  ]));

  const filters = { category: '', grade: '', district: '', frequency: '', maxPrice: '', search: '' };
  const chipLabels = {
    category: v => `Category: ${v}`,
    grade: v => `Grade ${v}`,
    district: v => v,
    frequency: v => v,
    maxPrice: v => `≤ ₹${v}/kg`,
    search: v => `“${v}”`
  };
  const controls = {};            // filter key -> input/select, so chips can reset them
  let sortKey = 'newest';
  let tab = 'all';                // 'all' | 'saved'
  let allListings = [];

  const tabBar = el('div', { class: 'tab-bar' });
  const countEl = el('div', { class: 'result-count' });
  const chipsEl = el('div', { class: 'chip-row' });
  const gridEl = el('div', { class: 'grid-marketplace' });

  function control(key, node) { controls[key] = node; return node; }
  function selectEl(key, placeholder, options) {
    return control(key, el('select', { onchange: e => { filters[key] = e.target.value; refresh(); } },
      [el('option', { value: '' }, placeholder)].concat(options.map(([v, label]) => el('option', { value: v }, label)))));
  }

  const sortSelect = el('select', { class: 'sort-select', 'aria-label': 'Sort listings', onchange: e => { sortKey = e.target.value; refresh(); } },
    SORT_OPTIONS.map(([v, label]) => el('option', { value: v }, label)));

  const filterBar = el('div', { class: 'filter-bar' }, [
    control('search', el('input', { type: 'text', placeholder: 'Search…', oninput: debounce(e => { filters.search = e.target.value.trim(); refresh(); }, 250) })),
    selectEl('category', 'All Categories', PLASTIC_CATEGORIES.map(c => [c.code, c.code])),
    selectEl('grade', 'All Grades', GRADES.map(g => [g.code, `Grade ${g.code}`])),
    selectEl('district', 'All Districts', MAHARASHTRA_DISTRICTS.map(d => [d, d])),
    selectEl('frequency', 'Any Frequency', FREQUENCIES.map(f => [f, f])),
    control('maxPrice', el('input', { type: 'number', min: '0', placeholder: 'Max ₹/kg', style: 'width:110px;', oninput: debounce(e => { filters.maxPrice = e.target.value; refresh(); }, 250) })),
    sortSelect
  ]);

  container.append(tabBar, filterBar, chipsEl, countEl, gridEl);

  function drawTabs() {
    tabBar.innerHTML = '';
    [['all', 'All listings'], ['saved', `★ Saved (${savedIds().length})`]].forEach(([key, label]) => {
      tabBar.appendChild(el('button', {
        class: `tab-btn ${tab === key ? 'active' : ''}`,
        onclick: () => { tab = key; drawTabs(); refresh(); }
      }, label));
    });
  }

  function drawChips() {
    chipsEl.innerHTML = '';
    const active = Object.keys(filters).filter(k => filters[k]);
    if (!active.length) return;
    active.forEach(k => {
      chipsEl.appendChild(el('button', {
        class: 'chip',
        title: 'Remove filter',
        onclick: () => { filters[k] = ''; controls[k].value = ''; refresh(); }
      }, [chipLabels[k](filters[k]), el('span', { class: 'chip-x' }, '×')]));
    });
    chipsEl.appendChild(el('button', {
      class: 'chip chip-clear',
      onclick: () => {
        Object.keys(filters).forEach(k => { filters[k] = ''; controls[k].value = ''; });
        refresh();
      }
    }, 'Clear all'));
  }

  function refresh() {
    drawChips();
    const base = tab === 'saved' ? allListings.filter(l => isSaved(l.id)) : allListings;
    const filtered = sortListings(filterListingsClientSide(base, filters), sortKey);
    countEl.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'}`;
    gridEl.innerHTML = '';
    if (!filtered.length) {
      const msg = tab === 'saved' && !savedIds().length
        ? 'Nothing saved yet — tap ☆ on a listing to keep it here.'
        : 'No listings match your filters yet.';
      gridEl.appendChild(el('div', { class: 'empty-state', style: 'grid-column:1/-1;' }, [
        el('div', { class: 'ic' }, tab === 'saved' ? '☆' : '📦'),
        el('p', {}, msg)
      ]));
      return;
    }
    filtered.forEach(l => gridEl.appendChild(listingCard(l, () => { drawTabs(); if (tab === 'saved') refresh(); })));
  }

  drawTabs();
  gridEl.appendChild(skeletonCards(6));
  try {
    const data = await getListings({ status: 'Available' });
    allListings = data.filter(l => l.ownerId !== state.firebaseUser.uid);
  } catch (err) {
    console.error(err);
    gridEl.innerHTML = '';
    gridEl.appendChild(el('div', { class: 'empty-state', style: 'grid-column:1/-1;' }, [
      el('div', { class: 'ic' }, '⚠️'), el('p', {}, 'Could not load listings — check your connection and Firestore rules.')
    ]));
    return;
  }
  refresh();
}

function isNew(l) {
  const ms = l.createdAt?.toMillis ? l.createdAt.toMillis() : null;
  return ms !== null && Date.now() - ms < NEW_WINDOW_MS;
}

function listingCard(l, onSavedChange) {
  const star = el('button', {
    class: `save-btn ${isSaved(l.id) ? 'saved' : ''}`,
    title: isSaved(l.id) ? 'Remove from saved' : 'Save listing',
    'aria-label': 'Save listing',
    onclick: async (e) => {
      e.stopPropagation();
      star.disabled = true;
      try {
        const on = await toggleSaved(state.firebaseUser.uid, l.id);
        star.classList.toggle('saved', on);
        star.textContent = on ? '★' : '☆';
        star.title = on ? 'Remove from saved' : 'Save listing';
        onSavedChange();
      } catch (err) {
        console.error(err);
        toast('Could not update saved listings.', 'error');
      } finally {
        star.disabled = false;
      }
    }
  }, isSaved(l.id) ? '★' : '☆');

  return el('div', { class: 'card listing-card', onclick: () => navigate(`listing/${l.id}`) }, [
    el('div', { class: 'listing-photo-wrap' }, [
      l.photoBase64
        ? el('img', { class: 'listing-photo', src: l.photoBase64, alt: l.category })
        : el('div', { class: 'listing-photo-placeholder' }, '♻️'),
      isNew(l) ? el('span', { class: 'new-badge' }, 'New') : null,
      star
    ]),
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
