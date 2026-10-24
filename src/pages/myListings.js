import { el, toast, timeAgo, skeletonRows, confirmDialog, formatINR } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getUserListings, updateListingStatus, deleteListing, listingPhotos, estimatedValue, createListing } from '../services/listings.js';
import { celebrate } from '../components/confetti.js';
import { getIncomingRequests } from '../services/requests.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';

const FILTERS = ['All', 'Available', 'Reserved', 'Matched', 'Unavailable'];
const PERIOD_DAYS = { weekly: 7, monthly: 30 };

// Recurring listings that sold or paused and are past their cycle — time to put them back up.
function dueRecurring(listings) {
  return listings.filter(l => {
    const days = PERIOD_DAYS[l.recurrence];
    const ms = l.createdAt?.toMillis ? l.createdAt.toMillis() : 0;
    return days && (l.status === 'Matched' || l.status === 'Unavailable') && ms && Date.now() - ms > days * 86400000;
  });
}

const copyOf = (l) => ({ ...l, photos: listingPhotos(l) });

export async function renderMyListings(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'My Listings'), el('p', {}, 'Everything you’re selling — edit details, pause a listing, or remove it.')]),
    el('div', { class: 'flex gap-8 wrap' }, [
      el('button', { class: 'btn btn-outline', onclick: () => navigate('bulk-upload') }, [icon('upload', 16), 'Bulk upload']),
      el('button', { class: 'btn btn-primary', onclick: () => navigate('create-listing') }, [icon('plus', 16), 'New Listing'])
    ])
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
    const due = dueRecurring(listings);
    if (due.length) {
      const relist = el('button', { class: 'btn btn-primary btn-sm' }, [icon('repeat', 14), `Re-list ${due.length}`]);
      relist.addEventListener('click', async () => {
        relist.disabled = true;
        try {
          await Promise.all(due.map(l => createListing(uid, copyOf(l)).then(() => updateListingStatus(l.id, 'Unavailable').catch(() => {}))));
          celebrate('Re-listed', `${due.length} recurring listing${due.length === 1 ? '' : 's'} are live again`);
          await load(); drawSeg(); drawList();
        } catch (err) { console.error(err); toast('Could not re-list.', 'error'); relist.disabled = false; }
      });
      body.appendChild(el('div', { class: 'counter-offer', style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px;' }, [
        el('span', {}, [el('b', {}, 'Recurring supply due: '), `${due.map(l => l.category).join(', ')} — your cycle has passed.`]), relist
      ]));
    }
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
            reqs ? el('span', { class: 'pill pill-reserved' }, `${reqs} request${reqs === 1 ? '' : 's'}`) : null,
            l.recurrence && l.recurrence !== 'none' ? el('span', { class: 'pill pill-neutral' }, `↻ ${l.recurrence}`) : null
          ]),
          el('div', { class: 'text-faint mt-8' }, `Listed ${timeAgo(l.createdAt)}`)
        ])
      ]),
      el('div', { class: 'my-listing-actions' }, [
        el('button', { class: 'btn btn-outline btn-sm', onclick: () => navigate(`listing/${l.id}`) }, 'View'),
        el('button', { class: 'btn btn-primary btn-sm', onclick: () => navigate(`edit-listing/${l.id}`) }, [icon('pencil', 14), 'Edit']),
        el('button', { class: 'btn btn-outline btn-sm', title: 'Create a copy as a new Available listing', onclick: async () => {
          try { await createListing(uid, copyOf(l)); toast('Duplicated — the copy is live.', 'success'); await load(); drawSeg(); drawList(); }
          catch (err) { console.error(err); toast('Could not duplicate.', 'error'); }
        } }, [icon('repeat', 14), 'Duplicate']),
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
