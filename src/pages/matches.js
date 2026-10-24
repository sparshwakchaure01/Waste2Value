import { el, timeAgo, toast, skeletonRows } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import {
  getIncomingRequests, getOutgoingRequests, updateRequestStatus, revealLevel, sendCounter, respondCounter, dealTerms
} from '../services/requests.js';
import { getLogisticsPartners, getTransportsForUser, sendTransportRequest, TRANSPORT_LABEL } from '../services/transports.js';
import { getReviewsBy, reviewId } from '../services/reviews.js';
import { fetchUserDoc } from '../auth.js';
import { renderRevealCard } from '../components/blindReveal.js';
import { refreshNavBadge, refreshBell } from '../components/nav.js';
import { emptyState } from '../components/emptyState.js';
import { routeLine, transportStepper } from '../components/route.js';
import { routeMap } from '../components/routeMap.js';
import { openReviewModal } from '../components/reviews.js';
import { celebrate } from '../components/confetti.js';
import { icon } from '../components/logo.js';
import { clearInsights } from '../services/insights.js';

const STATUS_FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['discussing', 'Discussing'],
  ['accepted', 'Accepted'],
  ['completed', 'Delivered'],
  ['declined', 'Declined']
];

const statusPill = s =>
  s === 'pending' ? 'reserved' : s === 'accepted' || s === 'completed' ? 'matched' : s === 'discussing' ? 'available' : 'declined';
const transportPill = s => (s === 'pending' ? 'reserved' : s === 'declined' ? 'declined' : 'matched');

// Status timeline: Sent → Discussing → Accepted → Delivered (or Sent → Declined).
function timeline(status) {
  const declined = status === 'declined';
  const steps = declined ? ['Sent', 'Declined'] : ['Sent', 'Discussing', 'Accepted', 'Delivered'];
  const current = declined ? 1 : { pending: 0, discussing: 1, accepted: 2, completed: 3 }[status] ?? 0;
  return el('div', { class: 'timeline' }, steps.map((label, i) =>
    el('div', {
      class: `tl-step ${i < current ? 'done' : ''} ${i === current ? (declined ? 'declined' : 'current') : ''}`
    }, [el('span', { class: 'tl-dot' }, i < current || (i === current && status === 'completed') ? '✓' : ''), el('span', { class: 'tl-label' }, label)])
  ));
}

export async function renderMatches(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Matches'), el('p', {}, 'Requests you’ve received and sent — decline, discuss, counter-offer or accept. Accepted deals can book a transport partner.')])
  ]));

  const tabBar = el('div', { class: 'tab-bar' });
  const segBar = el('div', { class: 'seg' });
  const body = el('div', { class: 'mt-16' });
  container.append(tabBar, segBar, body);

  const tabs = [
    { key: 'incoming', label: 'Received' },
    { key: 'outgoing', label: 'Sent' }
  ];
  let active = 'incoming';
  let filter = 'all';
  const cache = {};
  let myReviews = new Set();
  const uid = state.firebaseUser.uid;

  const touched = () => { clearInsights(); refreshNavBadge(true); refreshBell(true); };

  function drawTabs() {
    tabBar.innerHTML = '';
    tabs.forEach(t => {
      tabBar.appendChild(el('button', {
        class: `tab-btn ${active === t.key ? 'active' : ''}`,
        onclick: () => { active = t.key; filter = 'all'; drawTabs(); drawBody(); }
      }, t.label));
    });
  }

  function drawSeg(list) {
    segBar.innerHTML = '';
    STATUS_FILTERS.forEach(([key, label]) => {
      const n = key === 'all' ? list.length : list.filter(r => r.status === key).length;
      segBar.appendChild(el('button', {
        class: `seg-btn ${filter === key ? 'active' : ''}`,
        onclick: () => { filter = key; drawSeg(list); drawList(list); }
      }, [label, el('span', { class: 'seg-n' }, String(n))]));
    });
  }

  async function drawBody(force = false) {
    body.innerHTML = '';
    body.appendChild(skeletonRows(3));
    try {
      if (force || !cache[active]) {
        const [list, reviews] = await Promise.all([
          active === 'incoming' ? getIncomingRequests(uid) : getOutgoingRequests(uid),
          getReviewsBy(uid).catch(() => [])
        ]);
        cache[active] = list;
        myReviews = new Set(reviews.map(r => r.id));
      }
    } catch (err) {
      console.error(err);
      body.innerHTML = '';
      body.appendChild(emptyState('requests', 'Could not load requests.'));
      return;
    }
    drawSeg(cache[active]);
    await drawList(cache[active]);
  }

  async function drawList(list) {
    const shown = filter === 'all' ? list : list.filter(r => r.status === filter);
    const frag = [];
    if (!shown.length) {
      frag.push(emptyState('requests', list.length
        ? 'No requests with this status.'
        : (active === 'incoming' ? 'No requests received yet.' : 'You haven’t sent any requests yet.'),
        !list.length && active === 'outgoing' ? el('button', { class: 'btn btn-primary', onclick: () => navigate('marketplace') }, 'Browse Marketplace') : null));
    } else {
      for (const r of shown) frag.push(await requestCard(r, active));
    }
    body.replaceChildren(...frag);
  }

  // ---------------- counter-offers ----------------
  function openCounterModal(r) {
    const base = dealTerms(r);
    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
    const price = el('input', { type: 'number', min: '0', step: 'any', class: 'input', value: base.price });
    const qty = el('input', { type: 'number', min: '0', step: 'any', class: 'input', value: base.qty });
    const note = el('textarea', { maxlength: '200', placeholder: 'e.g. Price holds for 3 days; pickup from our Chakan yard.' });
    const send = el('button', { class: 'btn btn-primary btn-block' }, 'Send counter-offer');
    overlay.appendChild(el('div', { class: 'modal' }, [
      el('h3', {}, 'Counter-offer'),
      el('p', { class: 'text-faint' }, `Buyer asked for ${r.offeredQty ?? r.quantity} ${r.unit} at ₹${r.offerPrice ?? r.costPerKg}/kg (listing ₹${r.costPerKg}). Propose your terms — they accept or decline.`),
      el('div', { class: 'field-row mt-16' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Price ₹/kg'), price]),
        el('div', { class: 'field' }, [el('label', {}, `Quantity (${r.unit})`), qty])
      ]),
      el('div', { class: 'field' }, [el('label', {}, 'Note (optional)'), note]),
      send
    ]));
    document.body.appendChild(overlay);
    send.addEventListener('click', async () => {
      if (!(Number(price.value) >= 0) || !(Number(qty.value) > 0)) { toast('Enter a valid price and quantity.', 'error'); return; }
      send.disabled = true; send.textContent = 'Sending…';
      try {
        await sendCounter(r.id, { price: price.value, qty: qty.value, note: note.value.trim() });
        overlay.remove();
        toast('Counter-offer sent.', 'success');
        touched();
        await drawBody(true);
      } catch (err) {
        console.error(err);
        toast(err.code === 'permission-denied' ? 'Not allowed — publish the latest Firestore rules.' : 'Could not send the counter-offer.', 'error');
        send.disabled = false; send.textContent = 'Send counter-offer';
      }
    });
  }

  function counterBanner(r, mode) {
    const c = r.counter;
    if (!c) return null;
    const line = `₹${c.price}/kg for ${c.qty} ${r.unit}`;
    if (c.status === 'open') {
      if (mode === 'outgoing') {
        const accept = el('button', { class: 'btn btn-primary btn-sm' }, 'Accept counter');
        const decline = el('button', { class: 'btn btn-outline btn-sm' }, 'Decline');
        const run = (ok) => async () => {
          accept.disabled = decline.disabled = true;
          try {
            await respondCounter(r.id, c, ok);
            if (ok) celebrate('Counter accepted', `Agreed at ${line}`); else toast('Counter declined.', 'success');
            touched();
            await drawBody(true);
          } catch (err) {
            console.error(err);
            toast(err.code === 'permission-denied' ? 'Not allowed — publish the latest Firestore rules.' : 'Could not respond.', 'error');
            accept.disabled = decline.disabled = false;
          }
        };
        accept.addEventListener('click', run(true)); decline.addEventListener('click', run(false));
        return el('div', { class: 'counter-offer' }, [
          el('div', {}, [el('b', {}, 'Seller countered: '), line, c.note ? ` — “${c.note}”` : '']),
          el('div', { class: 'flex gap-8 mt-8' }, [decline, accept])
        ]);
      }
      return el('div', { class: 'counter-offer' }, [el('b', {}, 'Your counter-offer: '), line, ' — waiting for the buyer.']);
    }
    if (c.status === 'accepted') return el('div', { class: 'counter-offer ok' }, [el('b', {}, 'Counter accepted — '), `agreed ${line}.`]);
    return el('div', { class: 'counter-offer bad' }, [`Counter-offer (${line}) was declined.`]);
  }

  // ---------------- transport: pick a logistics partner for an accepted deal ----------------
  function openTransportModal(r, partner, route, onSent) {
    const kg = Number(r.offeredQty ?? r.quantity) * (r.unit === 'tonnes' ? 1000 : 1);
    const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
    const dateIn = el('input', { type: 'date', class: 'input', min: new Date().toISOString().slice(0, 10) });
    const noteIn = el('textarea', { placeholder: 'Loading time, gate / contact person, special handling…', maxlength: '240' });
    const sendBtn = el('button', { class: 'btn btn-primary btn-block' }, 'Send request');
    overlay.appendChild(el('div', { class: 'modal' }, [
      el('h3', {}, 'Request transport'),
      el('p', { class: 'text-faint' }, `${partner.companyName || partner.name || 'Partner'} will see this route and accept or decline. Contact details unlock for both sides once they accept.`),
      routeMap(route.from, route.to, { kg, compact: true }),
      el('div', { class: 'field mt-16' }, [el('label', {}, 'Pickup by (optional)'), dateIn]),
      el('div', { class: 'field' }, [el('label', {}, 'Note for the driver (optional)'), noteIn]),
      sendBtn
    ]));
    document.body.appendChild(overlay);
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
      try {
        await sendTransportRequest({
          request: r, partner, requesterId: uid,
          fromDistrict: route.from, toDistrict: route.to,
          fromAddress: route.fromAddress, toAddress: route.toAddress,
          pickupDate: dateIn.value, note: noteIn.value.trim()
        });
        overlay.remove();
        toast('Transport request sent.', 'success');
        touched();
        onSent();
      } catch (err) {
        console.error(err);
        toast(err.code === 'permission-denied'
          ? 'Not allowed — the deal may already have a partner, or the latest rules aren’t published.'
          : 'Could not send the request.', 'error');
        sendBtn.disabled = false; sendBtn.textContent = 'Send request';
      }
    });
  }

  function partnersPanel(r, sellerDoc, buyerDoc) {
    const panel = el('div', { class: 'partners' });
    const heading = el('h4', {}, 'Transport');
    const route = {
      from: r.district, to: buyerDoc?.district || '',
      fromAddress: sellerDoc?.address || '', toAddress: buyerDoc?.address || ''
    };

    function partnerLabel(p) {
      const sub = [p.vehicleType, p.capacityTonnes ? `${p.capacityTonnes} t` : null].filter(Boolean).join(' · ');
      const covers = p.servesAll ? 'Any district'
        : [p.coversFrom ? 'Pickup ✓' : null, p.coversTo ? 'Drop ✓' : null].filter(Boolean).join(' · ');
      return el('div', {}, [
        el('div', { class: 'partner-name' }, [p.companyName || p.name || 'Logistics partner', p.verified ? el('span', { class: 'verified', style: 'margin-left:8px;' }, [icon('shieldcheck', 12), 'Verified']) : null]),
        el('div', { class: 'partner-sub' }, [sub, covers].filter(Boolean).join(' — '))
      ]);
    }

    async function fill() {
      panel.replaceChildren(heading, skeletonRows(1));
      let transports;
      try {
        transports = await getTransportsForUser(uid);
      } catch (err) {
        console.error(err);
        panel.replaceChildren(heading, el('p', { class: 'text-faint' }, 'Could not load transport details.'));
        return;
      }
      const mine = transports.filter(t => t.requestId === r.id);
      const assigned = mine.find(t => ['accepted', 'in_transit', 'completed'].includes(t.status));
      const assignedId = r.logisticsId || assigned?.logisticsId;

      // A partner has taken the job: show them, the route and progress.
      if (assignedId) {
        const t = mine.find(x => x.logisticsId === assignedId);
        const partner = await fetchUserDoc(assignedId);
        const status = t?.status || 'accepted';
        const kg = Number(r.offeredQty ?? r.quantity) * (r.unit === 'tonnes' ? 1000 : 1);
        const reviewed = myReviews.has(reviewId(r.id, uid, assignedId));
        panel.replaceChildren(heading,
          el('div', { class: 'partner' }, [
            el('div', { class: 'partner-row' }, [partnerLabel(partner || {}), el('span', { class: 'pill pill-matched' }, TRANSPORT_LABEL[status] || status)]),
            routeLine(t?.fromDistrict || route.from, t?.toDistrict || route.to),
            transportStepper(status),
            renderRevealCard('full', partner, 'Partner'),
            route.to ? routeMap(t?.fromDistrict || route.from, t?.toDistrict || route.to, { kg, compact: true }) : null,
            status === 'completed' && !reviewed
              ? el('button', { class: 'btn btn-outline btn-sm mt-16', onclick: () => openReviewModal({ request: r, revieweeId: assignedId, kind: 'partner', label: 'transport partner', onDone: () => { myReviews.add(reviewId(r.id, uid, assignedId)); fill(); } }) }, [icon('star', 14), 'Rate partner'])
              : null
          ]));
        return;
      }

      if (r.status === 'completed') { panel.replaceChildren(heading, el('p', { class: 'text-faint' }, 'This deal is complete.')); return; }
      if (!route.to) {
        panel.replaceChildren(heading, el('p', { class: 'text-faint' }, 'The buyer has no district on their profile yet, so a route can’t be set.'));
        return;
      }

      let partners;
      try {
        partners = await getLogisticsPartners(route.from, route.to);
      } catch (err) {
        console.error(err);
        panel.replaceChildren(heading, el('p', { class: 'text-faint' }, 'Could not load transport partners.'));
        return;
      }

      const kg = Number(r.offeredQty ?? r.quantity) * (r.unit === 'tonnes' ? 1000 : 1);
      const intro = el('div', {}, [
        routeMap(route.from, route.to, { kg, compact: true }),
        el('p', { class: 'text-faint mt-8' }, partners.length
          ? `${partners.length} logistics partner${partners.length === 1 ? '' : 's'} can cover this route. Pick one — only they will see your request.`
          : 'No logistics partner covers this route yet. Check back soon.')
      ]);
      panel.replaceChildren(heading, intro, ...partners.map(p => {
        const t = mine.find(x => x.logisticsId === p.id);
        const row = el('div', { class: 'partner' });
        const head = el('div', { class: 'partner-row' }, [partnerLabel(p)]);
        if (t) {
          head.appendChild(el('span', { class: `pill pill-${transportPill(t.status)}` }, TRANSPORT_LABEL[t.status] || t.status));
        } else {
          head.appendChild(el('button', { class: 'btn btn-primary btn-sm', onclick: () => openTransportModal(r, p, route, fill) }, 'Request transport'));
        }
        row.appendChild(head);
        return row;
      }));
    }

    fill();
    return panel;
  }

  async function requestCard(r, mode) {
    const level = revealLevel(r.status);
    const otherUid = mode === 'incoming' ? r.buyerId : r.sellerId;
    const otherLabel = mode === 'incoming' ? 'Buyer' : 'Seller';
    const otherUser = level !== 'none' ? await fetchUserDoc(otherUid) : null;
    const terms = dealTerms(r);

    const chips = [];
    if (r.offeredQty || r.offerPrice) chips.push(el('span', { class: 'pill pill-neutral' }, `Offer: ${r.offeredQty ?? r.quantity} ${r.unit} @ ₹${r.offerPrice ?? r.costPerKg}/kg`));
    if (r.status === 'accepted' || r.status === 'completed') chips.push(el('span', { class: 'pill pill-matched' }, `Agreed: ${terms.qty} ${r.unit} @ ₹${terms.price}/kg`));

    const card = el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('div', {}, [
          el('strong', {}, `${r.category} · ${r.quantity} ${r.unit} · ${r.district}`),
          el('div', { class: 'text-faint' }, timeAgo(r.createdAt))
        ]),
        el('span', { class: `pill pill-${statusPill(r.status)}` }, r.status === 'completed' ? 'delivered' : r.status)
      ]),
      chips.length ? el('div', { class: 'meta-chips' }, chips) : null,
      timeline(r.status),
      el('p', { class: 'mt-16', style: 'font-style:italic;' }, `“${r.message}”`),
      el('a', { class: 'nav-link link-inline', onclick: () => navigate(`listing/${r.listingId}`) }, 'View listing →')
    ]);

    const banner = counterBanner(r, mode);
    if (banner) card.appendChild(banner);
    card.appendChild(renderRevealCard(level, otherUser, otherLabel));

    if (mode === 'incoming' && (r.status === 'pending' || r.status === 'discussing')) {
      const declineBtn = el('button', { class: 'btn btn-outline btn-sm' }, 'Decline');
      const counterBtn = el('button', { class: 'btn btn-outline btn-sm' }, [icon('chart', 14), r.counter?.status === 'open' ? 'Revise counter' : 'Counter-offer']);
      const actionBtn = r.status === 'pending'
        ? el('button', { class: 'btn btn-primary btn-sm' }, 'Discuss')
        : el('button', { class: 'btn btn-primary btn-sm' }, 'Accept');

      declineBtn.addEventListener('click', () => act(r, 'declined', [declineBtn, actionBtn, counterBtn]));
      counterBtn.addEventListener('click', () => openCounterModal(r));
      actionBtn.addEventListener('click', () => act(r, r.status === 'pending' ? 'discussing' : 'accepted', [declineBtn, actionBtn, counterBtn]));

      card.appendChild(el('div', { class: 'flex gap-8 mt-16 wrap' }, [declineBtn, counterBtn, actionBtn]));
    }

    if (r.status === 'accepted' || r.status === 'completed') {
      const tools = [el('button', { class: 'btn btn-outline btn-sm', onclick: () => navigate(`deal/${r.id}`) }, [icon('filetext', 14), 'Deal sheet'])];
      if (r.status === 'completed') {
        const reviewed = myReviews.has(reviewId(r.id, uid, otherUid));
        if (!reviewed) {
          tools.push(el('button', {
            class: 'btn btn-primary btn-sm',
            onclick: () => openReviewModal({
              request: r, revieweeId: otherUid, kind: mode === 'incoming' ? 'buyer' : 'seller', label: otherLabel.toLowerCase(),
              onDone: () => { myReviews.add(reviewId(r.id, uid, otherUid)); touched(); drawBody(); }
            })
          }, [icon('star', 14), `Rate ${otherLabel.toLowerCase()}`]));
        } else {
          tools.push(el('span', { class: 'pill pill-neutral' }, '★ You rated this deal'));
        }
      }
      card.appendChild(el('div', { class: 'flex gap-8 mt-16 wrap' }, tools));

      const sellerDoc = mode === 'incoming' ? state.userDoc : otherUser;
      const buyerDoc = mode === 'incoming' ? otherUser : state.userDoc;
      card.appendChild(partnersPanel(r, sellerDoc, buyerDoc));
    }

    return card;
  }

  async function act(r, newStatus, buttons) {
    buttons.forEach(b => { b.disabled = true; });
    try {
      await updateRequestStatus(r.id, newStatus, r.listingId);
      if (newStatus === 'accepted') celebrate('Deal accepted!', 'Now choose a transport partner on the card');
      else toast(newStatus === 'discussing' ? 'Contact details unlocked for discussion.' : 'Request declined.', 'success');
      touched();
      await drawBody(true);
    } catch (err) {
      console.error(err);
      toast('Could not update request.', 'error');
      buttons.forEach(b => { b.disabled = false; });
    }
  }

  drawTabs();
  await drawBody();
  refreshNavBadge(true);
}
