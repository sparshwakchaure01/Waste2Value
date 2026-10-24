import { el, toast, skeletonRows, copyText, formatINR } from '../utils.js';
import { state } from '../state.js';
import { navigate, renderRoute } from '../router.js';
import { getListingById, listingPhotos, totalKg, estimatedValue } from '../services/listings.js';
import { sendRequest, getOutgoingRequests, revealLevel } from '../services/requests.js';
import { fetchUserDoc } from '../auth.js';
import { renderRevealCard } from '../components/blindReveal.js';
import { icon } from '../components/logo.js';
import { emptyState } from '../components/emptyState.js';

const statusPillClass = s => (s === 'pending' ? 'reserved' : s === 'accepted' || s === 'completed' ? 'matched' : s === 'discussing' ? 'available' : 'declined');

export async function renderListingDetail(container, params) {
  const skeleton = skeletonRows(2);
  container.appendChild(skeleton);
  let listing;
  try { listing = await getListingById(params.id); } finally { skeleton.remove(); }
  if (!listing) {
    container.appendChild(emptyState('search', 'Listing not found.'));
    return;
  }

  const isOwner = listing.ownerId === state.firebaseUser.uid;
  let myExistingRequest = null;
  if (!isOwner) {
    const outgoing = await getOutgoingRequests(state.firebaseUser.uid);
    myExistingRequest = outgoing.find(r => r.listingId === listing.id) || null;
  }

  const photos = listingPhotos(listing);
  const gallery = el('div', {}, []);
  const drawGallery = (active = 0) => {
    gallery.innerHTML = '';
    if (!photos.length) { gallery.appendChild(el('div', { class: 'gallery-ph' }, '♻️')); return; }
    gallery.appendChild(el('img', { class: 'gallery-main', src: photos[active], alt: listing.category }));
    if (photos.length > 1) {
      gallery.appendChild(el('div', { class: 'thumbs' }, photos.map((src, i) =>
        el('img', { class: `thumb ${i === active ? 'active' : ''}`, src, alt: `Photo ${i + 1}`, onclick: () => drawGallery(i) }))));
    }
  };
  drawGallery();

  const copyLink = el('button', { class: 'btn btn-outline btn-sm' }, [icon('link', 14), 'Copy link']);
  copyLink.addEventListener('click', async () => {
    const ok = await copyText(`${window.location.origin}/#/listing/${listing.id}`);
    toast(ok ? 'Listing link copied' : 'Could not copy the link', ok ? 'success' : 'error');
  });

  const perTonne = Number(listing.costPerKg) * 1000;
  const left = el('div', { class: 'card' }, [
    gallery,
    el('div', { class: 'mt-16' }, [
      el('div', { class: 'listing-cat' }, listing.category),
      el('h2', {}, `${listing.quantity} ${listing.unit} available`),
      el('div', { class: 'flex gap-8 mt-8 wrap' }, [
        el('span', { class: `pill pill-grade-${listing.grade?.toLowerCase()}` }, `Grade ${listing.grade}`),
        el('span', { class: `pill pill-${listing.status.toLowerCase()}` }, listing.status),
        el('span', { class: 'pill pill-neutral' }, listing.district)
      ]),
      el('p', { class: 'mt-16' }, listing.description || 'No description provided.'),
      el('div', { class: 'stat-row mt-16' }, [
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, `₹${listing.costPerKg}`), el('div', { class: 'l' }, 'per kg (indicative)')]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, formatINR(perTonne)), el('div', { class: 'l' }, 'per tonne')]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, formatINR(estimatedValue(listing))), el('div', { class: 'l' }, `est. total · ${totalKg(listing).toLocaleString('en-IN')} kg`)]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, listing.availabilityFrequency), el('div', { class: 'l' }, listing.frequencyQty ? `${listing.frequencyQty} ${listing.unit} / cycle` : 'Availability')]),
      ]),
      el('div', { class: 'detail-actions' }, [copyLink])
    ])
  ]);

  const right = el('div', {});
  if (isOwner) {
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'This is your listing'),
      el('p', {}, 'Edit it, change its availability, or review requests from the Matches page.'),
      el('div', { class: 'flex gap-8 wrap' }, [
        el('button', { class: 'btn btn-primary', onclick: () => navigate(`edit-listing/${listing.id}`) }, [icon('pencil', 14), 'Edit listing']),
        el('button', { class: 'btn btn-outline', onclick: () => navigate('matches') }, 'View Requests')
      ])
    ]));
  } else if (myExistingRequest) {
    const level = revealLevel(myExistingRequest.status);
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Your request'),
      el('span', { class: `pill pill-${statusPillClass(myExistingRequest.status)}` }, myExistingRequest.status),
      myExistingRequest.offeredQty ? el('p', { class: 'mt-8' }, `You offered to take ${myExistingRequest.offeredQty} ${listing.unit}.`) : null,
    ]));
    if (level !== 'none') {
      const sellerDoc = await fetchUserDoc(listing.ownerId);
      right.appendChild(renderRevealCard(level, sellerDoc, 'Seller'));
    } else {
      right.appendChild(renderRevealCard('none', null, 'Seller'));
    }
  } else if (listing.status !== 'Available') {
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Not available right now'),
      el('p', {}, `This listing is currently ${listing.status.toLowerCase()}.`)
    ]));
  } else {
    const sendBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Send Request');
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Interested in this material?'),
      el('p', {}, 'Send one message with your request — the seller can accept, discuss, or decline.'),
      sendBtn,
      renderRevealCard('none', null, 'Seller')
    ]));
    sendBtn.addEventListener('click', () => openRequestModal(listing));
  }

  container.appendChild(el('div', { class: 'detail-grid' }, [left, right]));
}

function openRequestModal(listing) {
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const textarea = el('textarea', { placeholder: 'e.g. Interested in this lot, can you confirm grade and pickup timing?' });
  const qtyInput = el('input', { type: 'number', min: '0', step: 'any', placeholder: `e.g. ${listing.quantity}`, class: 'input' });
  const sendBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Send Request');
  const modal = el('div', { class: 'modal' }, [
    el('h3', {}, 'Send a request'),
    el('p', { class: 'text-faint' }, 'This is a one-time message. The seller will decide to Accept, Discuss, or Decline.'),
    el('div', { class: 'field mt-16' }, [el('label', {}, `Quantity you want (${listing.unit}, optional)`), qtyInput]),
    el('div', { class: 'field' }, [el('label', {}, 'Message'), textarea]),
    sendBtn
  ]);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  sendBtn.addEventListener('click', async () => {
    const message = textarea.value.trim();
    if (!message) { toast('Please add a short message.', 'error'); return; }
    sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
    try {
      await sendRequest({ listing, buyerId: state.firebaseUser.uid, message, offeredQty: qtyInput.value });
      toast('Request sent!', 'success');
      overlay.remove();
      renderRoute();
    } catch (err) {
      console.error(err);
      toast('Could not send request.', 'error');
      sendBtn.disabled = false; sendBtn.textContent = 'Send Request';
    }
  });
}
