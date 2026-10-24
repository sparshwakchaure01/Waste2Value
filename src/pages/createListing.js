import { el, toast, fileToBase64 } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { createListing } from '../services/listings.js';
import { PLASTIC_CATEGORIES, GRADES, FREQUENCIES, UNITS } from '../data/categories.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

export function renderCreateListing(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'New Listing'), el('p', {}, 'List plastic scrap or by-product for other industries to discover.')])
  ]));

  let photoBase64 = null;

  const photoInput = el('input', { type: 'file', accept: 'image/*' });
  const photoPreview = el('div', { class: 'listing-photo-placeholder', style: 'border-radius:12px;height:180px;margin-top:10px;' }, 'No photo selected');

  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photoBase64 = await fileToBase64(file);
      photoPreview.innerHTML = '';
      photoPreview.style.height = '';
      photoPreview.appendChild(el('img', { src: photoBase64, style: 'width:100%;max-height:220px;object-fit:cover;border-radius:12px;' }));
    } catch (err) {
      toast(err.message, 'error');
      photoInput.value = '';
      photoBase64 = null;
    }
  });

  const categorySelect = el('select', { id: 'f-category', required: true },
    [el('option', { value: '' }, 'Select category')].concat(PLASTIC_CATEGORIES.map(c => el('option', { value: c.code }, c.label))));
  const gradeSelect = el('select', { id: 'f-grade', required: true },
    [el('option', { value: '' }, 'Select grade')].concat(GRADES.map(g => el('option', { value: g.code }, g.label))));
  const unitSelect = el('select', { id: 'f-unit' }, UNITS.map(u => el('option', { value: u }, u)));
  const frequencySelect = el('select', { id: 'f-frequency' }, FREQUENCIES.map(f => el('option', { value: f }, f)));
  const districtSelect = el('select', { id: 'f-district', required: true },
    [el('option', { value: '' }, 'Select district')].concat(MAHARASHTRA_DISTRICTS.map(d => el('option', { value: d }, d))));

  const form = el('form', { class: 'card', style: 'max-width:680px;' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Photo (optional, under 1MB)'), photoInput, photoPreview]),
    el('div', { class: 'field' }, [el('label', {}, 'Category of Plastic'), categorySelect]),
    el('div', { class: 'field' }, [el('label', {}, 'Grade'), gradeSelect]),
    el('div', { class: 'flex gap-12' }, [
      el('div', { class: 'field', style: 'flex:1;' }, [el('label', {}, 'Quantity'), el('input', { type: 'number', id: 'f-quantity', min: '0', step: 'any', required: true, placeholder: 'e.g. 500' })]),
      el('div', { class: 'field', style: 'width:120px;' }, [el('label', {}, 'Unit'), unitSelect]),
    ]),
    el('div', { class: 'flex gap-12' }, [
      el('div', { class: 'field', style: 'flex:1;' }, [el('label', {}, 'Cost (₹ per kg, indicative)'), el('input', { type: 'number', id: 'f-cost', min: '0', step: 'any', required: true, placeholder: 'e.g. 18' })]),
      el('div', { class: 'field', style: 'flex:1;' }, [el('label', {}, 'Availability'), frequencySelect]),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Quantity per cycle (optional)'), el('input', { type: 'number', id: 'f-freqqty', min: '0', step: 'any', placeholder: 'e.g. 500 kg/week' })]),
    el('div', { class: 'field' }, [el('label', {}, 'District'), districtSelect]),
    el('div', { class: 'field' }, [el('label', {}, 'Description'), el('textarea', { id: 'f-description', placeholder: 'Condition, contamination level, packaging, pickup notes…' })]),
    el('div', { class: 'flex gap-12 mt-16' }, [
      el('button', { type: 'button', class: 'btn btn-outline', onclick: () => navigate('dashboard') }, 'Cancel'),
      el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Publish Listing')
    ])
  ]);

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
    btn.disabled = true; btn.textContent = 'Publishing…';

    try {
      const id = await createListing(state.firebaseUser.uid, {
        category, grade, quantity, unit: unitSelect.value,
        costPerKg, availabilityFrequency: frequencySelect.value,
        frequencyQty: form.querySelector('#f-freqqty').value,
        description: form.querySelector('#f-description').value,
        photoBase64, district
      });
      toast('Listing published!', 'success');
      navigate(`listing/${id}`);
    } catch (err) {
      console.error(err);
      toast('Could not publish listing — please try again.', 'error');
      btn.disabled = false; btn.textContent = 'Publish Listing';
    }
  });

  container.appendChild(form);
}
