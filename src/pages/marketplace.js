import { el, debounce, toast, skeletonCards, formatINR } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getListings, filterListingsClientSide, sortListings, SORT_OPTIONS, listingPhotos, estimatedValue } from '../services/listings.js';
import { toggleSaved, isSaved, savedIds } from '../services/saved.js';
import { getSearches, addSearch, removeSearch, markSearchesSeen, newMatches } from '../services/searches.js';
import { getMarketStats } from '../services/benchmarks.js';
import { fetchUserDoc } from '../auth.js';
import { PLASTIC_CATEGORIES, GRADES, FREQUENCIES } from '../data/categories.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';
import { distanceKm } from '../data/geo.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';
import { toggleCompare, isCompared, renderTray } from '../components/compare.js';

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

function storedView() {
  try { return localStorage.getItem('w2v-view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
}
function storeView(v) {
  try { localStorage.setItem('w2v-view', v); } catch { /* storage unavailable */ }
}

export async function renderMarketplace(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [ el('h1', {}, 'Marketplace'), el('p', {}, 'Browse available plastic scrap and by-products across Maharashtra.') ])
  ]));

  const uid = state.firebaseUser.uid;
  const home = state.userDoc?.district;
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
  let view = storedView();        // 'grid' | 'list'
  let allListings = [];
  let verified = new Set();       // owner ids an admin has verified
  let newCounts = {};             // saved-search id -> new matches since last visit

  const tabBar = el('div', { class: 'tab-bar' });
  const marketStrip = el('div', { class: 'market-strip' });
  const searchesEl = el('div', { class: 'saved-searches' });
  const countEl = el('div', { class: 'result-count' });
  const chipsEl = el('div', { class: 'chip-row' });
  const gridEl = el('div', { class: 'grid-marketplace' });

  function control(key, node) { controls[key] = node; return node; }
  function selectEl(key, placeholder, options) {
    return control(key, el('select', { 'aria-label': placeholder, onchange: e => { filters[key] = e.target.value; refresh(); } },
      [el('option', { value: '' }, placeholder)].concat(options.map(([v, label]) => el('option', { value: v }, label)))));
  }

  // Sort + view controls exist twice (desktop filter bar, mobile top bar) and are kept in sync.
  const sortSelects = [];
  const makeSort = (cls) => {
    const s = el('select', { class: cls, 'aria-label': 'Sort listings', onchange: e => { sortKey = e.target.value; sortSelects.forEach(x => { x.value = sortKey; }); refresh(); } },
      SORT_OPTIONS.filter(([v]) => v !== 'distance' || home).map(([v, label]) => el('option', { value: v }, label)));
    sortSelects.push(s);
    return s;
  };
  const viewToggles = [];
  const makeViewToggle = () => {
    const wrap = el('div', { class: 'view-toggle', role: 'group', 'aria-label': 'View' }, [
      el('button', { type: 'button', 'data-view': 'grid', title: 'Grid view', onclick: () => setView('grid') }, icon('grid', 17)),
      el('button', { type: 'button', 'data-view': 'list', title: 'List view', onclick: () => setView('list') }, icon('rows', 17))
    ]);
    viewToggles.push(wrap);
    return wrap;
  };
  function setView(v) {
    view = v; storeView(v);
    viewToggles.forEach(w => w.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === v)));
    gridEl.classList.toggle('list-view', v === 'list');
  }

  const filterBar = el('div', { class: 'filter-bar' }, [
    control('search', el('input', { type: 'search', placeholder: 'Search…', oninput: debounce(e => { filters.search = e.target.value.trim(); refresh(); }, 250) })),
    selectEl('category', 'All Categories', PLASTIC_CATEGORIES.map(c => [c.code, c.code])),
    selectEl('grade', 'All Grades', GRADES.map(g => [g.code, `Grade ${g.code}`])),
    selectEl('district', 'All Districts', MAHARASHTRA_DISTRICTS.map(d => [d, d])),
    selectEl('frequency', 'Any Frequency', FREQUENCIES.map(f => [f, f])),
    control('maxPrice', el('input', { type: 'number', min: '0', placeholder: 'Max ₹/kg', style: 'width:110px;', oninput: debounce(e => { filters.maxPrice = e.target.value; refresh(); }, 250) })),
    makeSort('sort-select'),
    makeViewToggle()
  ]);

  const filtersBtn = el('button', { class: 'btn btn-outline btn-sm', onclick: () => filterBar.classList.toggle('open') }, [icon('sliders', 16), 'Filters', el('span', { class: 'seg-n', hidden: true }, '0')]);
  const marketBar = el('div', { class: 'market-bar' }, [filtersBtn, makeSort('sort-select-m'), makeViewToggle()]);

  container.append(tabBar, marketStrip, marketBar, filterBar, searchesEl, chipsEl, countEl, gridEl);
  setView(view);
  renderTray();

  function drawTabs() {
    tabBar.innerHTML = '';
    [['all', 'All listings'], ['saved', `★ Saved (${savedIds().length})`]].forEach(([key, label]) => {
      tabBar.appendChild(el('button', {
        class: `tab-btn ${tab === key ? 'active' : ''}`,
        onclick: () => { tab = key; drawTabs(); refresh(); }
      }, label));
    });
  }

  function applyFilters(f) {
    Object.keys(filters).forEach(k => { filters[k] = f[k] || ''; if (controls[k]) controls[k].value = filters[k]; });
    refresh();
  }

  // ---- saved searches (alerts when something new matches) ----
  async function promptSaveSearch() {
    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
    const defaultName = [filters.category, filters.grade && `Grade ${filters.grade}`, filters.district].filter(Boolean).join(' · ') || 'My search';
    const name = el('input', { type: 'text', class: 'input', value: defaultName, maxlength: '40' });
    const save = el('button', { class: 'btn btn-primary btn-block' }, 'Save search');
    overlay.appendChild(el('div', { class: 'modal' }, [
      el('h3', {}, 'Save this search'),
      el('p', { class: 'text-faint' }, 'We’ll flag new listings that match these filters on your dashboard and in notifications.'),
      el('div', { class: 'field mt-16' }, [el('label', {}, 'Name'), name]),
      save
    ]));
    document.body.appendChild(overlay);
    name.select();
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await addSearch(uid, name.value.trim() || defaultName, filters);
        overlay.remove();
        toast('Search saved — we’ll alert you about new matches.', 'success');
        drawSearches();
      } catch (err) {
        console.error(err);
        toast('Could not save the search.', 'error');
        save.disabled = false;
      }
    });
  }

  function drawSearches() {
    const searches = getSearches();
    searchesEl.replaceChildren(...searches.map(s => el('span', { class: 'ss-chip', title: 'Apply this saved search', onclick: () => applyFilters(s.filters || {}) }, [
      icon('bell', 13), s.name,
      newCounts[s.id] ? el('span', { class: 'ss-new' }, `${newCounts[s.id]} new`) : null,
      el('button', { class: 'ss-x', title: 'Delete saved search', onclick: async (e) => { e.stopPropagation(); try { await removeSearch(uid, s.id); drawSearches(); } catch { toast('Could not delete.', 'error'); } } }, '×')
    ])));
  }

  function drawChips() {
    chipsEl.innerHTML = '';
    const active = Object.keys(filters).filter(k => filters[k]);
    const badge = filtersBtn.querySelector('.seg-n');
    badge.textContent = String(active.length);
    badge.hidden = active.length === 0;
    if (!active.length) return;
    active.forEach(k => {
      chipsEl.appendChild(el('button', {
        class: 'chip',
        title: 'Remove filter',
        onclick: () => { filters[k] = ''; controls[k].value = ''; refresh(); }
      }, [chipLabels[k](filters[k]), el('span', { class: 'chip-x' }, '×')]));
    });
    chipsEl.appendChild(el('button', { class: 'chip chip-clear', onclick: () => applyFilters({}) }, 'Clear all'));
    chipsEl.appendChild(el('button', { class: 'chip', onclick: promptSaveSearch }, [icon('bell', 13), 'Save search']));
  }

  function sorted(list) {
    if (sortKey === 'distance' && home) {
      return [...list].sort((a, b) => (distanceKm(home, a.district) ?? 1e9) - (distanceKm(home, b.district) ?? 1e9));
    }
    return sortListings(list, sortKey);
  }

  function refresh() {
    drawChips();
    const base = tab === 'saved' ? allListings.filter(l => isSaved(l.id)) : allListings;
    const filtered = sorted(filterListingsClientSide(base, filters));
    countEl.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'}`;
    gridEl.innerHTML = '';
    if (!filtered.length) {
      const empty = tab === 'saved' && !savedIds().length
        ? emptyState('saved', 'Nothing saved yet — tap ☆ on a listing to keep it here.')
        : emptyState('search', 'No listings match your filters yet.');
      empty.style.gridColumn = '1/-1';
      gridEl.appendChild(empty);
      return;
    }
    filtered.forEach(l => gridEl.appendChild(listingCard(l, { home, verified, onSavedChange: () => { drawTabs(); if (tab === 'saved') refresh(); } })));
  }

  window.addEventListener('w2v-compare-changed', refresh, { once: false });
  drawTabs();
  drawSearches();
  gridEl.appendChild(skeletonCards(6));
  try {
    const data = await getListings({ status: 'Available' });
    allListings = data.filter(l => l.ownerId !== uid);
  } catch (err) {
    console.error(err);
    gridEl.innerHTML = '';
    const empty = emptyState('search', 'Could not load listings — check your connection and Firestore rules.');
    empty.style.gridColumn = '1/-1';
    gridEl.appendChild(empty);
    return;
  }

  // saved-search alerts: count once for this visit, then mark them seen
  getSearches().forEach(s => { const n = newMatches(allListings, s, uid).length; if (n) newCounts[s.id] = n; });
  drawSearches();
  if (Object.keys(newCounts).length) setTimeout(() => markSearchesSeen(uid).catch(() => {}), 2500);
  refresh();

  // secondary data — never blocks the grid
  getMarketStats().then(stats => {
    const cats = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
    marketStrip.replaceChildren(...cats.map(([cat, s]) => el('button', {
      class: 'market-chip', title: `${s.count} listings · ₹${s.min.toFixed(0)}–₹${s.max.toFixed(0)}/kg`,
      onclick: () => { filters.category = cat; controls.category.value = cat; refresh(); }
    }, [el('b', {}, cat), el('strong', {}, `₹${s.avg.toFixed(0)}`), el('span', {}, `avg/kg · ${s.count} listed`)])));
  }).catch(() => {});

  Promise.all([...new Set(allListings.map(l => l.ownerId))].slice(0, 40).map(id => fetchUserDoc(id).catch(() => null))).then(docs => {
    docs.forEach(d => { if (d?.verified) verified.add(d.id); });
    if (verified.size) refresh();
  });
}

function isNew(l) {
  const ms = l.createdAt?.toMillis ? l.createdAt.toMillis() : null;
  return ms !== null && Date.now() - ms < NEW_WINDOW_MS;
}

function listingCard(l, { home, verified, onSavedChange }) {
  const photo = listingPhotos(l)[0];
  const km = home ? distanceKm(home, l.district) : null;
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

  const cmp = el('button', {
    class: `cmp-btn ${isCompared(l.id) ? 'on' : ''}`, title: 'Compare listings',
    onclick: (e) => { e.stopPropagation(); const on = toggleCompare(l); cmp.classList.toggle('on', on); cmp.lastChild.textContent = on ? 'Added' : 'Compare'; }
  }, [icon('compare', 13), el('span', {}, isCompared(l.id) ? 'Added' : 'Compare')]);

  return el('div', { class: 'card listing-card card-glow', onclick: () => navigate(`listing/${l.id}`) }, [
    el('div', { class: 'listing-photo-wrap' }, [
      photo
        ? el('img', { class: 'listing-photo', src: photo, alt: l.category, loading: 'lazy' })
        : el('div', { class: 'listing-photo-placeholder' }, '♻️'),
      isNew(l) ? el('span', { class: 'new-badge' }, 'New') : null,
      star, cmp
    ]),
    el('div', { class: 'listing-body' }, [
      el('div', { class: 'flex-between' }, [
        el('div', { class: 'listing-cat' }, l.category),
        verified.has(l.ownerId) ? el('span', { class: 'verified', title: 'Verified seller' }, [icon('shieldcheck', 13), 'Verified']) : null
      ]),
      el('div', { class: 'listing-title' }, `${l.quantity} ${l.unit}`),
      el('div', { class: 'flex gap-8 wrap' }, [
        el('span', { class: `pill pill-grade-${l.grade?.toLowerCase()}` }, `Grade ${l.grade}`),
        el('span', { class: 'pill pill-neutral' }, km != null ? `${l.district} · ${km} km` : l.district)
      ]),
      el('div', { class: 'listing-meta' }, [
        el('span', { class: 'listing-price' }, `₹${l.costPerKg}/kg`),
        el('span', { class: 'listing-total' }, `≈ ${formatINR(estimatedValue(l))} · ${l.availabilityFrequency}`)
      ])
    ])
  ]);
}
