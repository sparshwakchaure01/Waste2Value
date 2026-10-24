import { el, toast } from '../utils.js';
import { state } from '../state.js';
import { navigate, renderRoute } from '../router.js';
import { getListingById } from '../services/listings.js';
import { sendRequest, getOutgoingRequests, revealLevel } from '../services/requests.js';
import { fetchUserDoc } from '../auth.js';
import { renderRevealCard } from '../components/blindReveal.js';

export async function renderListingDetail(container, params) {
  const listing = await getListingById(params.id);
  if (!listing) {
    container.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'ic' }, '❓'), el('p', {}, 'Listing not found.')]));
    return;
  }

  const isOwner = listing.ownerId === state.firebaseUser.uid;
  let myExistingRequest = null;
  if (!isOwner) {
    const outgoing = await getOutgoingRequests(state.firebaseUser.uid);
    myExistingRequest = outgoing.find(r => r.listingId === listing.id) || null;
  }

  const wrap = el('div', { style: 'display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:start;' });

  const left = el('div', { class: 'card' }, [
    listing.photoBase64
      ? el('img', { src: listing.photoBase64, style: 'width:100%;border-radius:12px;max-height:320px;object-fit:cover;' })
      : el('div', { class: 'listing-photo-placeholder', style: 'border-radius:12px;height:260px;' }, '♻️'),
    el('div', { class: 'mt-16' }, [
      el('div', { class: 'listing-cat' }, listing.category),
      el('h2', {}, `${listing.quantity} ${listing.unit} available`),
      el('div', { class: 'flex gap-8 mt-8' }, [
        el('span', { class: `pill pill-grade-${listing.grade?.toLowerCase()}` }, `Grade ${listing.grade}`),
        el('span', { class: `pill pill-${listing.status.toLowerCase()}` }, listing.status),
        el('span', { class: 'pill pill-neutral' }, listing.district)
      ]),
      el('p', { class: 'mt-16' }, listing.description || 'No description provided.'),
      el('div', { class: 'stat-row mt-16' }, [
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, `₹${listing.costPerKg}`), el('div', { class: 'l' }, 'per kg (indicative)')]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, listing.availabilityFrequency), el('div', { class: 'l' }, listing.frequencyQty ? `${listing.frequencyQty} ${listing.unit} / cycle` : 'Availability')]),
      ])
    ])
  ]);

  const right = el('div', {});
  if (isOwner) {
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'This is your listing'),
      el('p', {}, 'Manage requests from the Matches page.'),
      el('button', { class: 'btn btn-primary btn-block', onclick: () => navigate('matches') }, 'View Requests')
    ]));
  } else if (myExistingRequest) {
    const level = revealLevel(myExistingRequest.status);
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Your request'),
      el('span', { class: `pill pill-${myExistingRequest.status === 'pending' ? 'reserved' : myExistingRequest.status === 'accepted' ? 'matched' : myExistingRequest.status === 'discussing' ? 'available' : 'declined'}` }, myExistingRequest.status),
      el('div', { class: 'mt-16' })
    ]));
    if (level !== 'none') {
      const sellerDoc = await fetchUserDoc(listing.ownerId);
      right.appendChild(renderRevealCard(level, sellerDoc, 'Seller'));
    }
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

  wrap.append(left, right);
  container.appendChild(wrap);
}

function openRequestModal(listing) {
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const textarea = el('textarea', { placeholder: 'e.g. Interested in 500kg, can you confirm grade and pickup timing?' });
  const sendBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Send Request');
  const modal = el('div', { class: 'modal' }, [
    el('h3', {}, 'Send a request'),
    el('p', { class: 'text-faint' }, 'This is a one-time message. The seller will decide to Accept, Discuss, or Decline.'),
    el('div', { class: 'field mt-16' }, [el('label', {}, 'Message'), textarea]),
    sendBtn
  ]);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  sendBtn.addEventListener('click', async () => {
    const message = textarea.value.trim();
    if (!message) { toast('Please add a short message.', 'error'); return; }
    sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
    try {
      await sendRequest({ listing, buyerId: state.firebaseUser.uid, message });
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
