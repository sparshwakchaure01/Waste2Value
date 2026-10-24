import { el, timeAgo, toast, skeletonRows } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getIncomingRequests, getOutgoingRequests, updateRequestStatus, revealLevel } from '../services/requests.js';
import { fetchUserDoc } from '../auth.js';
import { renderRevealCard } from '../components/blindReveal.js';
import { refreshNavBadge } from '../components/nav.js';

const STATUS_FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['discussing', 'Discussing'],
  ['accepted', 'Accepted'],
  ['completed', 'Picked up'],
  ['declined', 'Declined']
];

const statusPill = s =>
  s === 'pending' ? 'reserved' : s === 'accepted' || s === 'completed' ? 'matched' : s === 'discussing' ? 'available' : 'declined';

// Status timeline: Sent → Discussing → Accepted → Picked up (or Sent → Declined).
function timeline(status) {
  const declined = status === 'declined';
  const steps = declined ? ['Sent', 'Declined'] : ['Sent', 'Discussing', 'Accepted', 'Picked up'];
  const current = declined ? 1 : { pending: 0, discussing: 1, accepted: 2, completed: 3 }[status] ?? 0;
  return el('div', { class: 'timeline' }, steps.map((label, i) =>
    el('div', {
      class: `tl-step ${i < current ? 'done' : ''} ${i === current ? (declined ? 'declined' : 'current') : ''}`
    }, [el('span', { class: 'tl-dot' }, i < current || (i === current && status === 'completed') ? '✓' : ''), el('span', { class: 'tl-label' }, label)])
  ));
}

export async function renderMatches(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Matches'), el('p', {}, 'Requests you’ve received and sent — one message, then Decline, Discuss, or Accept.')])
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
    const uid = state.firebaseUser.uid;
    try {
      if (force || !cache[active]) {
        cache[active] = active === 'incoming' ? await getIncomingRequests(uid) : await getOutgoingRequests(uid);
      }
    } catch (err) {
      console.error(err);
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'empty-state' }, [el('div', { class: 'ic' }, '⚠️'), el('p', {}, 'Could not load requests.')]));
      return;
    }
    drawSeg(cache[active]);
    await drawList(cache[active]);
  }

  async function drawList(list) {
    const shown = filter === 'all' ? list : list.filter(r => r.status === filter);
    const frag = [];
    if (!shown.length) {
      frag.push(el('div', { class: 'empty-state' }, [
        el('div', { class: 'ic' }, '📭'),
        el('p', {}, list.length
          ? 'No requests with this status.'
          : (active === 'incoming' ? 'No requests received yet.' : 'You haven’t sent any requests yet.'))
      ]));
    } else {
      for (const r of shown) frag.push(await requestCard(r, active));
    }
    body.replaceChildren(...frag);
  }

  async function requestCard(r, mode) {
    const level = revealLevel(r.status);
    const otherUid = mode === 'incoming' ? r.buyerId : r.sellerId;
    const otherLabel = mode === 'incoming' ? 'Buyer' : 'Seller';
    const otherUser = level !== 'none' ? await fetchUserDoc(otherUid) : null;

    const card = el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('div', {}, [
          el('strong', {}, `${r.category} · ${r.quantity} ${r.unit} · ${r.district}`),
          el('div', { class: 'text-faint' }, timeAgo(r.createdAt))
        ]),
        el('span', { class: `pill pill-${statusPill(r.status)}` }, r.status === 'completed' ? 'picked up' : r.status)
      ]),
      timeline(r.status),
      el('p', { class: 'mt-16', style: 'font-style:italic;' }, `“${r.message}”`),
      el('a', { class: 'nav-link link-inline', onclick: () => navigate(`listing/${r.listingId}`) }, 'View listing →')
    ]);

    card.appendChild(renderRevealCard(level, otherUser, otherLabel));

    if (mode === 'incoming' && (r.status === 'pending' || r.status === 'discussing')) {
      const declineBtn = el('button', { class: 'btn btn-outline btn-sm' }, 'Decline');
      const actionBtn = r.status === 'pending'
        ? el('button', { class: 'btn btn-primary btn-sm' }, 'Discuss')
        : el('button', { class: 'btn btn-primary btn-sm' }, 'Accept');

      declineBtn.addEventListener('click', () => act(r, 'declined', [declineBtn, actionBtn]));
      actionBtn.addEventListener('click', () => act(r, r.status === 'pending' ? 'discussing' : 'accepted', [declineBtn, actionBtn]));

      card.appendChild(el('div', { class: 'flex gap-12 mt-16' }, [declineBtn, actionBtn]));
    }

    return card;
  }

  async function act(r, newStatus, buttons) {
    buttons.forEach(b => { b.disabled = true; });
    try {
      await updateRequestStatus(r.id, newStatus, r.listingId);
      toast(newStatus === 'accepted' ? 'Deal accepted!' : newStatus === 'discussing' ? 'Contact details unlocked for discussion.' : 'Request declined.', 'success');
      await drawBody(true);
      refreshNavBadge(true);
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
