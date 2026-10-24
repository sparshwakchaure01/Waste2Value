import { el, toast } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { createListing } from '../services/listings.js';
import { PLASTIC_CATEGORIES, GRADES, FREQUENCIES, UNITS } from '../data/categories.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';
import { celebrate } from '../components/confetti.js';
import { icon } from '../components/logo.js';

const MAX_ROWS = 50;
const HEADERS = ['category', 'grade', 'quantity', 'unit', 'costPerKg', 'availabilityFrequency', 'district', 'description'];

const TEMPLATE = [
  HEADERS.join(','),
  'PET,A,500,kg,18,Weekly,Pune,"Clear bottle flakes, baled"',
  'HDPE,B,2,tonnes,24,Monthly,Nashik,"Mixed-colour crates"'
].join('\n');

// Small RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF).
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

const norm = s => String(s || '').trim().toLowerCase().replace(/[^a-z]/g, '');
const HEADER_ALIASES = {
  category: 'category', resin: 'category', material: 'category',
  grade: 'grade', quantity: 'quantity', qty: 'quantity', unit: 'unit',
  costperkg: 'costPerKg', price: 'costPerKg', priceperkg: 'costPerKg', cost: 'costPerKg', rate: 'costPerKg',
  availabilityfrequency: 'availabilityFrequency', frequency: 'availabilityFrequency', availability: 'availabilityFrequency',
  district: 'district', description: 'description', notes: 'description'
};

function validate(raw) {
  const errors = [];
  const category = String(raw.category || '').trim().toUpperCase();
  if (!PLASTIC_CATEGORIES.some(c => c.code === category)) errors.push(`resin “${raw.category || ''}” not one of ${PLASTIC_CATEGORIES.map(c => c.code).join('/')}`);
  const grade = String(raw.grade || '').trim().toUpperCase();
  if (!GRADES.some(g => g.code === grade)) errors.push('grade must be A, B or C');
  const quantity = Number(raw.quantity);
  if (!(quantity > 0)) errors.push('quantity must be > 0');
  const unit = String(raw.unit || 'kg').trim().toLowerCase();
  if (!UNITS.includes(unit)) errors.push('unit must be kg or tonnes');
  const costPerKg = Number(raw.costPerKg);
  if (!(costPerKg >= 0) || raw.costPerKg === undefined || String(raw.costPerKg).trim() === '') errors.push('price (₹/kg) required');
  const freqRaw = String(raw.availabilityFrequency || 'One-time').trim().toLowerCase();
  const frequency = FREQUENCIES.find(f => f.toLowerCase() === freqRaw);
  if (!frequency) errors.push(`frequency must be ${FREQUENCIES.join('/')}`);
  const district = MAHARASHTRA_DISTRICTS.find(d => d.toLowerCase() === String(raw.district || '').trim().toLowerCase()
    || d.toLowerCase().startsWith(String(raw.district || '').trim().toLowerCase() + ' ('));
  if (!district) errors.push(`district “${raw.district || ''}” not found`);
  return {
    errors,
    data: { category, grade, quantity, unit, costPerKg, availabilityFrequency: frequency, district, description: String(raw.description || '').trim(), photos: [] }
  };
}

export function renderBulkUpload(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Bulk upload'), el('p', {}, `Import up to ${MAX_ROWS} listings from a CSV. Photos can be added to each listing afterwards.`)]),
    el('button', { class: 'btn btn-outline', onclick: () => navigate('my-listings') }, 'Back to My Listings')
  ]));

  const fileInput = el('input', { type: 'file', accept: '.csv,text/csv', style: 'display:none;' });
  const drop = el('div', { class: 'dropzone', onclick: () => fileInput.click() }, [
    el('div', { style: 'color:var(--teal);display:flex;justify-content:center;margin-bottom:8px;' }, icon('upload', 30)),
    el('strong', {}, 'Drop a CSV here, or click to choose'),
    el('p', { class: 'text-faint', style: 'margin:6px 0 0;' }, `Columns: ${HEADERS.join(', ')}`)
  ]);
  const templateBtn = el('button', { class: 'btn btn-outline btn-sm' }, [icon('download', 14), 'Download template']);
  templateBtn.addEventListener('click', () => {
    const a = el('a', { href: URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })), download: 'waste2value-listings-template.csv' });
    document.body.appendChild(a); a.click(); a.remove();
  });

  const preview = el('div', { class: 'mt-16' });
  container.append(
    el('div', { class: 'card' }, [drop, fileInput, el('div', { class: 'mt-16 flex gap-8 wrap' }, [templateBtn])]),
    preview
  );

  async function handle(file) {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { toast('That file has no data rows.', 'error'); return; }
    const keys = rows[0].map(h => HEADER_ALIASES[norm(h)] || null);
    if (!keys.includes('category') || !keys.includes('quantity')) { toast('Header row must include at least “category” and “quantity”.', 'error'); return; }
    const body = rows.slice(1, MAX_ROWS + 1).map((cells, i) => {
      const raw = {};
      keys.forEach((k, idx) => { if (k) raw[k] = cells[idx]; });
      return { line: i + 2, ...validate(raw) };
    });
    if (rows.length - 1 > MAX_ROWS) toast(`Only the first ${MAX_ROWS} rows are imported.`, 'error');
    draw(body);
  }

  function draw(items) {
    const good = items.filter(x => !x.errors.length);
    const importBtn = el('button', { class: 'btn btn-primary', disabled: good.length ? false : true }, `Import ${good.length} listing${good.length === 1 ? '' : 's'}`);
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true; importBtn.textContent = 'Importing…';
      let done = 0;
      try {
        for (let i = 0; i < good.length; i += 8) {
          await Promise.all(good.slice(i, i + 8).map(x => createListing(state.firebaseUser.uid, x.data).then(() => { done++; })));
          importBtn.textContent = `Importing… ${done}/${good.length}`;
        }
        celebrate('Listings imported', `${done} listing${done === 1 ? '' : 's'} are live`);
        setTimeout(() => navigate('my-listings'), 1400);
      } catch (err) {
        console.error(err);
        toast(`Imported ${done}, then failed${err.code ? ` (${err.code})` : ''}.`, 'error');
        importBtn.disabled = false; importBtn.textContent = `Retry import`;
      }
    });

    preview.replaceChildren(
      el('div', { class: 'flex-between wrap', style: 'margin-bottom:12px;' }, [
        el('div', {}, [el('strong', {}, `${good.length} valid`), el('span', { class: 'text-faint' }, ` · ${items.length - good.length} with problems`)]),
        importBtn
      ]),
      el('div', { class: 'table-wrap' }, el('table', {}, [
        el('thead', {}, el('tr', {}, ['Row', 'Resin', 'Grade', 'Qty', '₹/kg', 'Frequency', 'District', 'Check'].map(h => el('th', {}, h)))),
        el('tbody', {}, items.map(x => el('tr', { class: x.errors.length ? 'row-bad' : 'row-ok' }, [
          el('td', {}, String(x.line)), el('td', {}, x.data.category || '—'), el('td', {}, x.data.grade || '—'),
          el('td', {}, `${x.data.quantity || '—'} ${x.data.unit || ''}`), el('td', {}, String(x.data.costPerKg ?? '—')),
          el('td', {}, x.data.availabilityFrequency || '—'), el('td', {}, x.data.district || '—'),
          el('td', {}, x.errors.length ? el('span', { class: 'err-text' }, x.errors.join('; ')) : '✓')
        ])))
      ]))
    );
  }

  fileInput.addEventListener('change', () => handle(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handle(e.dataTransfer.files[0]));
}
