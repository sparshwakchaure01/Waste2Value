import { el, toast, timeAgo, skeletonRows, confirmDialog, formatINR } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getUserListings, updateListingStatus, deleteListing, listingPhotos, estimatedValue } from '../services/listings.js';
import { getIncomingRequests } from '../services/requests.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';

const FILTERS = ['All', 'Available', 'Reserved', 'Matched', 'Unavailable'];

export async function renderMyListings(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'My Listings'), el('p', {}, 'Everything you’re selling — edit details, pause a listing, or remove it.')]),
    el('button', { class: 'btn btn-primary', onclick: () => navigate('create-listing') }, [icon('plus', 16), 'New Listing'])
  ]));

  const seg = el('div', { class: 'seg' });
  const body = el('div', { class: 'mt-16' });
  container.append(seg, body);
  body.appendChild(skeletonRows(3));

  const uid = state.firebaseUser.uid;
  let listings = [];
  let requestCounts = {};
  let filter = 'All';

  async function load() {
    const [mine, incoming] = await Promise.all([getUserListings(uid), getIncomingRequests(uid)]);
    listings = mine;
    requestCounts = {};
    incoming.forEach(r => { requestCounts[r.listingId] = (requestCounts[r.listingId] || 0) + 1; });
  }

  function drawSeg() {
    seg.innerHTML = '';
    FILTERS.forEach(f => {
      const n = f === 'All' ? listings.length : listings.filter(l => l.status === f).length;
      seg.appendChild(el('button', { class: `seg-btn ${filter === f ? 'active' : ''}`, onclick: () => { filter = f; drawSeg(); drawList(); } },
        [f, el('span', { class: 'seg-n' }, String(n))]));
    });
  }

  function drawList() {
    const shown = filter === 'All' ? listings : listings.filter(l => l.status === filter);
    body.innerHTML = '';
    if (!shown.length) {
      body.appendChild(listings.length
        ? emptyState('search', `No ${filter.toLowerCase()} listings.`)
        : emptyState('listings', 'You haven’t listed anything yet.',
            el('button', { class: 'btn btn-primary', onclick: () => navigate('create-listing') }, 'Create your first listing')));
      return;
    }
    shown.forEach(l => body.appendChild(listingRow(l)));
  }

  function listingRow(l) {
    const photo = listingPhotos(l)[0];
    const locked = l.status === 'Matched';
    const statusSelect = el('select', { 'aria-label': 'Change status', disabled: locked ? true : false },
      (locked ? ['Matched'] : ['Available', 'Reserved', 'Unavailable']).map(s => el('option', { value: s, selected: s === l.status ? true : false }, s)));
    statusSelect.addEventListener('change', async () => {
      statusSelect.disabled = true;
      try {
        await updateListingStatus(l.id, statusSelect.value);
        l.status = statusSelect.value;
        toast(`Marked ${l.status.toLowerCase()}.`, 'success');
        drawSeg(); drawList();
      } catch (err) {
        console.error(err);
        toast('Could not change status.', 'error');
        statusSelect.value = l.status;
        statusSelect.disabled = false;
      }
    });

    const del = el('button', { class: 'btn btn-outline btn-sm', disabled: locked ? true : false, title: locked ? 'Matched listings can’t be deleted' : 'Delete listing' }, [icon('trash', 14), 'Delete']);
    del.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete this listing?',
        text: `${l.category} · ${l.quantity} ${l.unit} will be removed from the marketplace. This can’t be undone.`,
        confirmLabel: 'Delete', danger: true
      });
      if (!ok) return;
      try {
        await deleteListing(l.id);
        listings = listings.filter(x => x.id !== l.id);
        toast('Listing deleted.', 'success');
        drawSeg(); drawList();
      } catch (err) {
        console.error(err);
        toast('Could not delete the listing.', 'error');
      }
    });

    const reqs = requestCounts[l.id] || 0;
    return el('div', { class: 'request-card' }, [
      el('div', { class: 'my-listing' }, [
        photo ? el('img', { class: 'my-listing-photo', src: photo, alt: l.category }) : el('div', { class: 'my-listing-photo' }, '♻️'),
        el('div', { class: 'my-listing-body' }, [
          el('div', { class: 'flex-between' }, [
            el('strong', {}, `${l.category} · ${l.quantity} ${l.unit}`),
            el('span', { class: `pill pill-${l.status.toLowerCase()}` }, l.status)
          ]),
          el('div', { class: 'meta-chips' }, [
            el('span', { class: `pill pill-grade-${l.grade?.toLowerCase()}` }, `Grade ${l.grade}`),
            el('span', { class: 'pill pill-neutral' }, l.district),
            el('span', { class: 'pill pill-neutral' }, `₹${l.costPerKg}/kg · ≈ ${formatINR(estimatedValue(l))}`),
            reqs ? el('span', { class: 'pill pill-reserved' }, `${reqs} request${reqs === 1 ? '' : 's'}`) : null
          ]),
          el('div', { class: 'text-faint mt-8' }, `Listed ${timeAgo(l.createdAt)}`)
        ])
      ]),
      el('div', { class: 'my-listing-actions' }, [
        el('button', { class: 'btn btn-outline btn-sm', onclick: () => navigate(`listing/${l.id}`) }, 'View'),
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate(`edit-listing/${l.id}`) }, [icon('pencil', 14), 'Edit']),
        statusSelect,
        del
      ])
    ]);
  }

  try {
    await load();
  } catch (err) {
    console.error(err);
    body.innerHTML = '';
    body.appendChild(emptyState('listings', 'Could not load your listings.'));
    return;
  }
  drawSeg();
  drawList();
}
