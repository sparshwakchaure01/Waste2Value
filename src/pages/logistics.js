import { el, toast, timeAgo, skeletonRows } from '../utils.js';
import { state, setState } from '../state.js';
import { saveLogisticsProfile } from '../services/logistics.js';
import { getAcceptedDealsForDistricts } from '../services/requests.js';
import { getIncomingTransports, updateTransportStatus, completePickup, transportRevealLevel } from '../services/transports.js';
import { fetchUserDoc } from '../auth.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';
import { renderRevealCard } from '../components/blindReveal.js';
import { emptyState } from '../components/emptyState.js';

const VEHICLE_TYPES = ['Mini Truck (Tata Ace / similar)', 'Pickup', 'Truck (6-10 tonne)', 'Trailer (10+ tonne)', 'Tempo / Van'];

export async function renderLogistics(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Service Area & Deals'), el('p', {}, 'Pick the districts you operate in. Buyers and sellers of accepted deals there can request your transport.')])
  ]));

  const profile = state.userDoc;
  const selected = new Set(profile.districts || []);

  // ---- district picker with search / select all / clear ----
  const grid = el('div', { class: 'district-grid' });
  const chips = new Map();
  MAHARASHTRA_DISTRICTS.forEach(d => {
    const chip = el('div', { class: `district-chip ${selected.has(d) ? 'selected' : ''}` }, d);
    chip.addEventListener('click', () => {
      if (selected.has(d)) { selected.delete(d); chip.classList.remove('selected'); }
      else { selected.add(d); chip.classList.add('selected'); }
      updateCount();
    });
    chips.set(d, chip);
    grid.appendChild(chip);
  });

  const countEl = el('span', { class: 'text-faint' });
  const updateCount = () => { countEl.textContent = `${selected.size} of ${MAHARASHTRA_DISTRICTS.length} selected`; };
  updateCount();

  const visibleDistricts = () => MAHARASHTRA_DISTRICTS.filter(d => chips.get(d).style.display !== 'none');
  const searchInput = el('input', { type: 'search', class: 'input', placeholder: 'Search districts…' });
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    chips.forEach((chip, d) => { chip.style.display = d.toLowerCase().includes(q) ? '' : 'none'; });
  });
  const setAll = (on) => {
    visibleDistricts().forEach(d => {
      if (on) selected.add(d); else selected.delete(d);
      chips.get(d).classList.toggle('selected', on);
    });
    updateCount();
  };

  const vehicleSelect = el('select', { id: 'f-vehicle' },
    VEHICLE_TYPES.map(v => el('option', { value: v, selected: v === profile.vehicleType ? true : false }, v)));
  const phoneInput = el('input', { type: 'tel', id: 'f-phone', value: profile.phone || '', placeholder: '10-digit mobile number' });
  const companyInput = el('input', { type: 'text', id: 'f-company', value: profile.companyName || '', placeholder: 'Transport company / owner name' });
  const saveBtn = el('button', { class: 'btn btn-primary' }, 'Save Service Area');

  container.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Vehicle details'),
    el('div', { class: 'field-row mt-16' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Company / Owner name'), companyInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Phone'), phoneInput]),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Vehicle type'), vehicleSelect]),
    el('h3', { class: 'mt-16' }, 'Districts you operate in'),
    el('p', { class: 'text-faint' }, 'Select every district you can serve — flexible point A to point B within each.'),
    el('div', { class: 'district-tools' }, [
      searchInput,
      el('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => setAll(true) }, 'Select all'),
      el('button', { type: 'button', class: 'btn btn-outline btn-sm', onclick: () => setAll(false) }, 'Clear'),
      countEl
    ]),
    grid,
    el('div', { class: 'mt-16' }, saveBtn)
  ]));

  saveBtn.addEventListener('click', async () => {
    const companyName = companyInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!companyName || !phone) { toast('Please fill in company name and phone.', 'error'); return; }
    if (!selected.size) { toast('Select at least one district.', 'error'); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      await saveLogisticsProfile(state.firebaseUser.uid, {
        vehicleType: vehicleSelect.value,
        districts: Array.from(selected),
        phone, companyName
      });
      const userDoc = await fetchUserDoc(state.firebaseUser.uid);
      setState({ userDoc });
      toast('Service area saved.', 'success');
      drawDeals();
    } catch (err) {
      console.error(err);
      toast(`Could not save${err.code ? ` (${err.code})` : ''}. ${err.code === 'permission-denied' ? 'Publish the latest Firestore rules.' : 'Try again.'}`, 'error');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Save Service Area';
    }
  });

  // ---- deals / transport requests ----
  const sections = el('div', {});
  container.appendChild(sections);

  function heading(text, note) {
    return el('div', { class: 'section-head' }, [el('h3', {}, text), note ? el('span', { class: 'text-faint' }, note) : null]);
  }

  async function transportCard(t, actions) {
    const level = transportRevealLevel(t.status);
    const requester = level !== 'none' ? await fetchUserDoc(t.requesterId) : null;
    const card = el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('div', {}, [
          el('strong', {}, `${t.category} · ${t.quantity} ${t.unit}`),
          el('div', { class: 'text-faint' }, `${t.district} · ${timeAgo(t.updatedAt || t.createdAt)}`)
        ]),
        el('span', { class: `pill pill-${t.status === 'pending' ? 'reserved' : t.status === 'declined' ? 'declined' : 'matched'}` }, t.status === 'completed' ? 'picked up' : t.status)
      ]),
      renderRevealCard(level, requester, 'Requester')
    ]);
    if (actions) card.appendChild(el('div', { class: 'flex gap-12 mt-16' }, actions));
    return card;
  }

  async function drawDeals() {
    sections.replaceChildren(skeletonRows(2));
    let transports, openDeals;
    try {
      const districts = Array.from(selected);
      [transports, openDeals] = await Promise.all([
        getIncomingTransports(state.firebaseUser.uid),
        getAcceptedDealsForDistricts(districts)
      ]);
    } catch (err) {
      console.error(err);
      sections.replaceChildren(emptyState('deals', 'Could not load deals — check your connection and Firestore rules.'));
      return;
    }

    const pending = transports.filter(t => t.status === 'pending');
    const accepted = transports.filter(t => t.status === 'accepted');
    const done = transports.filter(t => t.status === 'completed');
    const handled = new Set(transports.map(t => t.requestId));
    const unassigned = openDeals.filter(d => !handled.has(d.id));

    const out = [];

    out.push(heading('Transport requests', `${pending.length} waiting`));
    if (!pending.length) out.push(emptyState('partners', 'No new transport requests.'));
    for (const t of pending) {
      const decline = el('button', { class: 'btn btn-outline btn-sm' }, 'Decline');
      const accept = el('button', { class: 'btn btn-primary btn-sm' }, 'Accept');
      const run = async (status, msg) => {
        decline.disabled = accept.disabled = true;
        try {
          await updateTransportStatus(t.id, status);
          toast(msg, 'success');
          drawDeals();
        } catch (err) {
          console.error(err);
          toast(`Could not update${err.code ? ` (${err.code})` : ''}.`, 'error');
          decline.disabled = accept.disabled = false;
        }
      };
      decline.addEventListener('click', () => run('declined', 'Request declined.'));
      accept.addEventListener('click', () => run('accepted', 'Accepted — requester details unlocked.'));
      out.push(await transportCard(t, [decline, accept]));
    }

    out.push(heading('My pickups', `${accepted.length} to collect`));
    if (!accepted.length) out.push(emptyState('deals', 'Accepted transport jobs appear here.'));
    for (const t of accepted) {
      const btn = el('button', { class: 'btn btn-primary btn-sm' }, 'Mark picked up');
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
          await completePickup(t);
          toast('Marked as picked up.', 'success');
          drawDeals();
        } catch (err) {
          console.error(err);
          toast(`Could not mark as picked up${err.code ? ` (${err.code})` : ''}.`, 'error');
          btn.disabled = false; btn.textContent = 'Mark picked up';
        }
      });
      out.push(await transportCard(t, [btn]));
    }

    out.push(heading('Deals ready for pickup in your districts', 'Buyers/sellers can request you from their Matches page'));
    if (!unassigned.length) out.push(emptyState('deals', selected.size ? 'No other accepted deals in your districts right now.' : 'Save your districts to see accepted deals nearby.'));
    unassigned.forEach(d => out.push(el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('strong', {}, `${d.category} · ${d.quantity} ${d.unit}`),
        el('span', { class: 'pill pill-matched' }, d.status)
      ]),
      el('div', { class: 'text-faint' }, `${d.district} · accepted ${timeAgo(d.updatedAt || d.createdAt)}`)
    ])));

    if (done.length) {
      out.push(heading('Completed pickups', `${done.length}`));
      done.forEach(t => out.push(el('div', { class: 'request-card' }, [
        el('div', { class: 'flex-between' }, [
          el('strong', {}, `${t.category} · ${t.quantity} ${t.unit}`),
          el('span', { class: 'pill pill-neutral' }, 'picked up')
        ]),
        el('div', { class: 'text-faint' }, `${t.district} · ${timeAgo(t.updatedAt || t.createdAt)}`)
      ])));
    }

    sections.replaceChildren(...out);
  }

  await drawDeals();
}
