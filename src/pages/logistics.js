import { el, toast, timeAgo, skeletonRows } from '../utils.js';
import { state, setState } from '../state.js';
import { saveLogisticsProfile } from '../services/logistics.js';
import { getAcceptedDealsForDistricts, getCompletedDealsForDistricts, markPickedUp } from '../services/requests.js';
import { fetchUserDoc } from '../auth.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

const VEHICLE_TYPES = ['Mini Truck (Tata Ace / similar)', 'Pickup', 'Truck (6-10 tonne)', 'Trailer (10+ tonne)', 'Tempo / Van'];

export async function renderLogistics(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Service Area & Vehicle'), el('p', {}, 'Pick the districts you operate in — flexible pickup and drop within each, point A to point B.')])
  ]));

  const profile = state.userDoc;
  const selected = new Set(profile.districts || []);

  const grid = el('div', { class: 'district-grid' });
  MAHARASHTRA_DISTRICTS.forEach(d => {
    const chip = el('div', { class: `district-chip ${selected.has(d) ? 'selected' : ''}` }, d);
    chip.addEventListener('click', () => {
      if (selected.has(d)) { selected.delete(d); chip.classList.remove('selected'); }
      else { selected.add(d); chip.classList.add('selected'); }
    });
    grid.appendChild(chip);
  });

  const vehicleSelect = el('select', { id: 'f-vehicle' },
    VEHICLE_TYPES.map(v => el('option', { value: v, selected: v === profile.vehicleType }, v)));
  const phoneInput = el('input', { type: 'tel', id: 'f-phone', value: profile.phone || '', placeholder: '10-digit mobile number' });
  const companyInput = el('input', { type: 'text', id: 'f-company', value: profile.companyName || '', placeholder: 'Transport company / owner name' });

  const saveBtn = el('button', { class: 'btn btn-primary' }, 'Save Service Area');

  const form = el('div', { class: 'card' }, [
    el('h3', {}, 'Vehicle details'),
    el('div', { class: 'flex gap-12 mt-16' }, [
      el('div', { class: 'field', style: 'flex:1;' }, [el('label', {}, 'Company / Owner name'), companyInput]),
      el('div', { class: 'field', style: 'flex:1;' }, [el('label', {}, 'Phone'), phoneInput]),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Vehicle type'), vehicleSelect]),
    el('h3', { class: 'mt-16' }, 'Districts you operate in'),
    el('p', { class: 'text-faint' }, 'Select every district you can serve. You’ll see deals ready for pickup in any of them.'),
    grid,
    el('div', { class: 'mt-16' }, saveBtn)
  ]);

  saveBtn.addEventListener('click', async () => {
    const companyName = companyInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!companyName || !phone) { toast('Please fill in company name and phone.', 'error'); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      await saveLogisticsProfile(state.firebaseUser.uid, {
        vehicleType: vehicleSelect.value,
        districts: Array.from(selected),
        phone, companyName
      });
      const userDoc = await fetchUserDoc(state.firebaseUser.uid);
      setState({ userDoc });
      toast('Service area updated.', 'success');
    } catch (err) {
      console.error(err);
      toast('Could not save.', 'error');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Save Service Area';
    }
  });

  container.appendChild(form);

  container.appendChild(el('h3', { class: 'mt-16' }, 'Deals ready for pickup'));
  const dealsWrap = el('div', {});
  container.appendChild(dealsWrap);
  container.appendChild(el('h3', { class: 'mt-24' }, 'Completed pickups'));
  const doneWrap = el('div', {});
  container.appendChild(doneWrap);

  function emptyState(text) {
    return el('div', { class: 'empty-state' }, [el('div', { class: 'ic' }, '🚚'), el('p', {}, text)]);
  }

  function openDealCard(d) {
    const btn = el('button', { class: 'btn btn-primary btn-sm' }, 'Mark picked up');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await markPickedUp(d.id);
        toast('Marked as picked up.', 'success');
        drawDeals();
      } catch (err) {
        console.error(err);
        toast('Could not update — save your service area first, then try again.', 'error');
        btn.disabled = false; btn.textContent = 'Mark picked up';
      }
    });
    return el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('strong', {}, `${d.category} · ${d.quantity} ${d.unit}`),
        el('span', { class: 'pill pill-matched' }, d.status)
      ]),
      el('div', { class: 'text-faint' }, `${d.district} · accepted ${timeAgo(d.updatedAt || d.createdAt)}`),
      el('div', { class: 'mt-16' }, btn)
    ]);
  }

  function doneDealCard(d) {
    return el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('strong', {}, `${d.category} · ${d.quantity} ${d.unit}`),
        el('span', { class: 'pill pill-neutral' }, 'picked up')
      ]),
      el('div', { class: 'text-faint' }, `${d.district} · ${timeAgo(d.updatedAt || d.createdAt)}`)
    ]);
  }

  async function drawDeals() {
    dealsWrap.replaceChildren(skeletonRows(2));
    const districts = Array.from(selected);
    try {
      const [open, done] = await Promise.all([
        getAcceptedDealsForDistricts(districts), getCompletedDealsForDistricts(districts)
      ]);
      dealsWrap.replaceChildren(...(open.length ? open.map(openDealCard) : [emptyState('No accepted deals in your districts yet.')]));
      doneWrap.replaceChildren(...(done.length ? done.map(doneDealCard) : [emptyState('Nothing picked up yet.')]));
    } catch (err) {
      console.error(err);
      dealsWrap.replaceChildren(emptyState('Could not load deals.'));
    }
  }

  await drawDeals();
}
