import { el, toast, fileToBase64, skeletonRows } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { createListing, updateListing, getListingById, listingPhotos } from '../services/listings.js';
import { PLASTIC_CATEGORIES, GRADES, FREQUENCIES, UNITS } from '../data/categories.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';
import { emptyState } from '../components/emptyState.js';
import { getMarketStats, priceVerdict } from '../services/benchmarks.js';
import { celebrate } from '../components/confetti.js';

const MAX_PHOTOS = 4;
const MAX_TOTAL_CHARS = 850000; // keeps the whole Firestore document under its 1MiB limit
const EDITABLE_STATUSES = ['Available', 'Reserved', 'Unavailable'];

export function renderCreateListing(container) {
  buildForm(container, null);
}

export async function renderEditListing(container, params) {
  const skeleton = skeletonRows(2);
  container.appendChild(skeleton);
  let listing;
  try { listing = await getListingById(params.id); } finally { skeleton.remove(); }
  if (!listing || listing.ownerId !== state.firebaseUser.uid) {
    container.appendChild(emptyState('listings', 'Listing not found, or it isn’t yours to edit.'));
    return;
  }
  buildForm(container, listing);
}

function buildForm(container, existing) {
  const editing = !!existing;
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [
      el('h1', {}, editing ? 'Edit Listing' : 'New Listing'),
      el('p', {}, editing ? 'Update details, photos or availability.' : 'List plastic scrap or by-product for other industries to discover.')
    ])
  ]));

  let photos = existing ? [...listingPhotos(existing)] : [];

  const photoGrid = el('div', { class: 'photo-grid' });
  const photoInput = el('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none;' });

  function drawPhotos() {
    photoGrid.innerHTML = '';
    photos.forEach((src, i) => {
      photoGrid.appendChild(el('div', { class: 'photo-tile' }, [
        el('img', { src, alt: `Photo ${i + 1}` }),
        el('button', { type: 'button', title: 'Remove photo', onclick: () => { photos.splice(i, 1); drawPhotos(); } }, '×')
      ]));
    });
    if (photos.length < MAX_PHOTOS) {
      photoGrid.appendChild(el('div', { class: 'photo-add', onclick: () => photoInput.click() }, [
        el('span', { style: 'font-size:22px;line-height:1;' }, '+'), `Add photo`
      ]));
    }
  }

  photoInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_PHOTOS - photos.length);
    photoInput.value = '';
    for (const file of files) {
      try {
        const data = await fileToBase64(file, { maxDim: 1000, quality: 0.72 });
        if (photos.join('').length + data.length > MAX_TOTAL_CHARS) {
          toast('Photos are too large together — remove one or use smaller images.', 'error');
          break;
        }
        photos.push(data);
      } catch (err) {
        toast(err.message, 'error');
      }
    }
    drawPhotos();
  });
  drawPhotos();

  const opt = (value, label, selected) => el('option', { value, selected: selected ? true : false }, label);
  const categorySelect = el('select', { id: 'f-category', required: true },
    [opt('', 'Select category')].concat(PLASTIC_CATEGORIES.map(c => opt(c.code, c.label, existing?.category === c.code))));
  const gradeSelect = el('select', { id: 'f-grade', required: true },
    [opt('', 'Select grade')].concat(GRADES.map(g => opt(g.code, g.label, existing?.grade === g.code))));
  const unitSelect = el('select', { id: 'f-unit' }, UNITS.map(u => opt(u, u, existing?.unit === u)));
  const frequencySelect = el('select', { id: 'f-frequency' }, FREQUENCIES.map(f => opt(f, f, existing?.availabilityFrequency === f)));
  const districtSelect = el('select', { id: 'f-district', required: true },
    [opt('', 'Select district')].concat(MAHARASHTRA_DISTRICTS.map(d => opt(d, d, existing?.district === d))));
  const isMatched = existing?.status === 'Matched';
  const statusSelect = editing ? el('select', { id: 'f-status', disabled: isMatched ? true : false },
    (isMatched ? ['Matched'] : EDITABLE_STATUSES).map(s => opt(s, s, existing.status === s))) : null;

  const input = (id, type, value, extra = {}) => el('input', { type, id, value: value ?? '', ...extra });

  const recurrenceSelect = el('select', { id: 'f-recurrence' },
    [['none', 'One listing (no repeat)'], ['weekly', 'Repeats weekly'], ['monthly', 'Repeats monthly']].map(([v, l]) => opt(v, l, (existing?.recurrence || 'none') === v)));
  const costHint = el('div', { class: 'field-hint' }, '');

  async function updateHint() {
    const cat = categorySelect.value;
    if (!cat) { costHint.textContent = ''; return; }
    try {
      const s = (await getMarketStats())[cat];
      if (!s || s.count < 2) { costHint.textContent = `Not enough ${cat} listings yet for a market price.`; return; }
      const price = Number(form.querySelector('#f-cost')?.value);
      const v = priceVerdict(price, s);
      costHint.textContent = `Market for ${cat}: avg ₹${s.avg.toFixed(0)} (range ₹${s.min.toFixed(0)}–₹${s.max.toFixed(0)}, ${s.count} listings)${v ? ` — yours is ${v.label.toLowerCase()}` : ''}.`;
    } catch { costHint.textContent = ''; }
  }

  const form = el('form', { class: 'card form-card' }, [
    el('div', { class: 'field' }, [el('label', {}, `Photos (up to ${MAX_PHOTOS}, each under 1MB)`), photoInput, photoGrid]),
    el('div', { class: 'field' }, [el('label', {}, 'Category of Plastic'), categorySelect]),
    el('div', { class: 'field' }, [el('label', {}, 'Grade'), gradeSelect]),
    el('div', { class: 'field-row' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Quantity'), input('f-quantity', 'number', existing?.quantity, { min: '0', step: 'any', required: true, placeholder: 'e.g. 500' })]),
      el('div', { class: 'field' }, [el('label', {}, 'Unit'), unitSelect]),
    ]),
    el('div', { class: 'field-row' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Cost (₹ per kg, indicative)'), input('f-cost', 'number', existing?.costPerKg, { min: '0', step: 'any', required: true, placeholder: 'e.g. 18' }), costHint]),
      el('div', { class: 'field' }, [el('label', {}, 'Availability'), frequencySelect]),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Quantity per cycle (optional)'), input('f-freqqty', 'number', existing?.frequencyQty, { min: '0', step: 'any', placeholder: 'e.g. 500 kg/week' })]),
    el('div', { class: 'field' }, [el('label', {}, 'Recurring supply'), recurrenceSelect, el('div', { class: 'field-hint' }, 'We’ll remind you to re-list when a recurring lot sells.')]),
    el('div', { class: 'field' }, [el('label', {}, 'District'), districtSelect]),
    statusSelect ? el('div', { class: 'field' }, [
      el('label', {}, 'Listing status'), statusSelect,
      isMatched ? el('div', { class: 'field-hint' }, 'Matched listings are locked — the deal was accepted.') : el('div', { class: 'field-hint' }, 'Only “Available” listings appear in the marketplace.')
    ]) : null,
    el('div', { class: 'field' }, [el('label', {}, 'Description'), el('textarea', { id: 'f-description', placeholder: 'Condition, contamination level, packaging, pickup notes…' }, existing?.description || '')]),
    el('div', { class: 'flex gap-12 mt-16' }, [
      el('button', { type: 'button', class: 'btn btn-outline', onclick: () => navigate(editing ? 'my-listings' : 'dashboard') }, 'Cancel'),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, editing ? 'Save Changes' : 'Publish Listing')
    ])
  ]);

  form.querySelector('textarea').value = existing?.description || '';
  categorySelect.addEventListener('change', updateHint);
  form.querySelector('#f-cost').addEventListener('input', updateHint);
  updateHint();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = categorySelect.value;
    const grade = gradeSelect.value;
    const quantity = form.querySelector('#f-quantity').value;
    const costPerKg = form.querySelector('#f-cost').value;
    const district = districtSelect.value;

    if (!category || !grade || !quantity || !costPerKg || !district) {
      toast('Please fill in every required field.', 'error');
      return;
    }

    const btn = form.querySelector('button[type=submit]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = editing ? 'Saving…' : 'Publishing…';

    const data = {
      category, grade, quantity, unit: unitSelect.value,
      costPerKg, availabilityFrequency: frequencySelect.value,
      frequencyQty: form.querySelector('#f-freqqty').value,
      description: form.querySelector('#f-description').value,
      photos, district, recurrence: recurrenceSelect.value
    };

    try {
      if (editing) {
        if (statusSelect && !isMatched) data.status = statusSelect.value;
        await updateListing(existing.id, data);
        toast('Listing updated.', 'success');
        navigate(`listing/${existing.id}`);
      } else {
        const id = await createListing(state.firebaseUser.uid, data);
        celebrate('Listing published', 'It’s live in the marketplace');
        navigate(`listing/${id}`);
      }
    } catch (err) {
      console.error(err);
      toast(err.code === 'permission-denied' ? 'Not allowed — check Firestore rules.' : 'Could not save the listing — try again.', 'error');
      btn.disabled = false; btn.textContent = label;
    }
  });

  container.appendChild(form);
}
