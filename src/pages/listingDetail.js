import { el, toast, skeletonRows, copyText, formatINR } from '../utils.js';
import { state } from '../state.js';
import { navigate, renderRoute } from '../router.js';
import { getListingById, listingPhotos, totalKg, estimatedValue } from '../services/listings.js';
import { sendRequest, getOutgoingRequests, revealLevel, dealTerms } from '../services/requests.js';
import { getMarketStats, priceVerdict } from '../services/benchmarks.js';
import { getRatingSummary } from '../services/reviews.js';
import { fetchUserDoc } from '../auth.js';
import { distanceKm } from '../data/geo.js';
import { renderRevealCard } from '../components/blindReveal.js';
import { icon } from '../components/logo.js';
import { emptyState } from '../components/emptyState.js';
import { routeMap } from '../components/routeMap.js';
import { stars } from '../components/reviews.js';
import { celebrate } from '../components/confetti.js';

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
  const home = state.userDoc?.district;
  const km = home ? distanceKm(home, listing.district) : null;

  // placeholders filled asynchronously (never block the page)
  const sellerLine = el('div', { class: 'flex gap-8 wrap mt-8', style: 'align-items:center;' });
  const benchmark = el('div', {});

  const left = el('div', { class: 'card' }, [
    gallery,
    el('div', { class: 'mt-16' }, [
      el('div', { class: 'listing-cat' }, listing.category),
      el('h2', {}, `${listing.quantity} ${listing.unit} available`),
      el('div', { class: 'flex gap-8 mt-8 wrap' }, [
        el('span', { class: `pill pill-grade-${listing.grade?.toLowerCase()}` }, `Grade ${listing.grade}`),
        el('span', { class: `pill pill-${listing.status.toLowerCase()}` }, listing.status),
        el('span', { class: 'pill pill-neutral' }, km != null && !isOwner ? `${listing.district} · ≈ ${km} km from you` : listing.district),
        listing.recurrence && listing.recurrence !== 'none' ? el('span', { class: 'pill pill-neutral' }, [icon('repeat', 12), `Recurring ${listing.recurrence}`]) : null
      ]),
      sellerLine,
      el('p', { class: 'mt-16' }, listing.description || 'No description provided.'),
      el('div', { class: 'stat-row mt-16' }, [
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, `₹${listing.costPerKg}`), el('div', { class: 'l' }, 'per kg (indicative)')]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, formatINR(perTonne)), el('div', { class: 'l' }, 'per tonne')]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, formatINR(estimatedValue(listing))), el('div', { class: 'l' }, `est. total · ${totalKg(listing).toLocaleString('en-IN')} kg`)]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'n' }, listing.availabilityFrequency), el('div', { class: 'l' }, listing.frequencyQty ? `${listing.frequencyQty} ${listing.unit} / cycle` : 'Availability')]),
      ]),
      benchmark,
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
    const terms = dealTerms(myExistingRequest);
    right.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Your request'),
      el('span', { class: `pill pill-${statusPillClass(myExistingRequest.status)}` }, myExistingRequest.status),
      el('p', { class: 'mt-8' }, `Your terms: ${terms.qty} ${listing.unit} at ₹${terms.price}/kg (${terms.source}).`),
      el('button', { class: 'btn btn-outline btn-sm', onclick: () => navigate('matches') }, 'Open in Matches')
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
      el('p', {}, 'Send one message with your offer — the seller can accept, counter, discuss, or decline.'),
      sendBtn,
      renderRevealCard('none', null, 'Seller')
    ]));
    sendBtn.addEventListener('click', () => openRequestModal(listing));
  }

  // route preview for buyers
  if (!isOwner && home && km != null) {
    right.appendChild(el('div', { class: 'card mt-16' }, [
      el('h3', {}, 'Where it is'),
      el('p', { class: 'text-faint', style: 'margin:0;' }, `${listing.district} → ${home}`),
      routeMap(listing.district, home, { kg: totalKg(listing), compact: true })
    ]));
  }

  container.appendChild(el('div', { class: 'detail-grid' }, [left, right]));

  // ---- async extras: seller reputation + market benchmark ----
  fetchUserDoc(listing.ownerId).then(async owner => {
    if (owner?.verified) sellerLine.appendChild(el('span', { class: 'verified' }, [icon('shieldcheck', 14), 'Verified seller']));
    const summary = await getRatingSummary(listing.ownerId).catch(() => null);
    if (summary) sellerLine.appendChild(stars(summary.avg, { count: summary.count }));
  }).catch(() => {});

  getMarketStats().then(stats => {
    const s = stats[listing.category];
    const verdict = priceVerdict(Number(listing.costPerKg), s);
    if (!s || !verdict) return;
    const span = Math.max(0.01, s.max - s.min);
    const pos = Math.min(100, Math.max(0, ((Number(listing.costPerKg) - s.min) / span) * 100));
    benchmark.replaceChildren(el('div', { class: 'mt-16' }, [
      el('div', { class: 'flex-between wrap' }, [
        el('strong', { style: 'color:var(--navy);' }, `Market price · ${listing.category}`),
        el('span', { class: `verdict ${verdict.tone}` }, `${verdict.label} (${verdict.diff > 0 ? '+' : ''}${verdict.diff}% vs avg ₹${s.avg.toFixed(0)})`)
      ]),
      el('div', { class: 'price-meter' }, el('i', { style: `left:${pos}%` })),
      el('div', { class: 'price-meter-labels' }, [el('span', {}, `₹${s.min.toFixed(0)} lowest`), el('span', {}, `${s.count} listings`), el('span', {}, `₹${s.max.toFixed(0)} highest`)])
    ]));
  }).catch(() => {});
}

function openRequestModal(listing) {
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const textarea = el('textarea', { placeholder: 'e.g. Interested in this lot, can you confirm grade and pickup timing?' });
  const qtyInput = el('input', { type: 'number', min: '0', step: 'any', placeholder: `e.g. ${listing.quantity}`, class: 'input' });
  const priceInput = el('input', { type: 'number', min: '0', step: 'any', placeholder: `Asking ₹${listing.costPerKg}`, class: 'input' });
  const sendBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Send Request');
  const modal = el('div', { class: 'modal' }, [
    el('h3', {}, 'Send a request'),
    el('p', { class: 'text-faint' }, 'This is a one-time message. The seller can accept, counter-offer, discuss, or decline.'),
    el('div', { class: 'field-row mt-16' }, [
      el('div', { class: 'field' }, [el('label', {}, `Quantity (${listing.unit})`), qtyInput]),
      el('div', { class: 'field' }, [el('label', {}, 'Your offer ₹/kg'), priceInput])
    ]),
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
      await sendRequest({ listing, buyerId: state.firebaseUser.uid, message, offeredQty: qtyInput.value, offerPrice: priceInput.value });
      overlay.remove();
      celebrate('Request sent', 'The seller has been notified');
      renderRoute();
    } catch (err) {
      console.error(err);
      toast(err.code === 'permission-denied' ? 'Not allowed — your account may be suspended, or the latest rules aren’t published.' : 'Could not send request.', 'error');
      sendBtn.disabled = false; sendBtn.textContent = 'Send Request';
    }
  });
}
