import { el, timeAgo, toast } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getIncomingRequests, getOutgoingRequests, updateRequestStatus, revealLevel } from '../services/requests.js';
import { fetchUserDoc } from '../auth.js';
import { renderRevealCard } from '../components/blindReveal.js';

export async function renderMatches(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Matches'), el('p', {}, 'Requests you’ve received and sent — one message, then Decline, Discuss, or Accept.')])
  ]));

  const tabBar = el('div', { class: 'tab-bar' });
  const body = el('div', { class: 'mt-16' });
  container.append(tabBar, body);

  const tabs = [
    { key: 'incoming', label: 'Received' },
    { key: 'outgoing', label: 'Sent' }
  ];
  let active = 'incoming';

  function drawTabs() {
    tabBar.innerHTML = '';
    tabs.forEach(t => {
      tabBar.appendChild(el('button', {
        class: `tab-btn ${active === t.key ? 'active' : ''}`,
        onclick: () => { active = t.key; drawTabs(); drawBody(); }
      }, t.label));
    });
  }

  async function drawBody() {
    body.innerHTML = '<div class="empty-state"><p>Loading…</p></div>';
    const uid = state.firebaseUser.uid;
    const list = active === 'incoming' ? await getIncomingRequests(uid) : await getOutgoingRequests(uid);
    body.innerHTML = '';

    if (!list.length) {
      body.appendChild(el('div', { class: 'empty-state' }, [
        el('div', { class: 'ic' }, '📭'),
        el('p', {}, active === 'incoming' ? 'No requests received yet.' : 'You haven’t sent any requests yet.')
      ]));
      return;
    }

    for (const r of list) {
      body.appendChild(await requestCard(r, active));
    }
  }

  async function requestCard(r, mode) {
    const level = revealLevel(r.status);
    const otherUid = mode === 'incoming' ? r.buyerId : r.sellerId;
    const otherLabel = mode === 'incoming' ? 'Buyer' : 'Seller';
    const otherUser = level !== 'none' ? await fetchUserDoc(otherUid) : null;

    const statusPillClass = r.status === 'pending' ? 'reserved' : r.status === 'accepted' ? 'matched' : r.status === 'discussing' ? 'available' : 'declined';

    const card = el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('div', {}, [
          el('strong', {}, `${r.category} · ${r.quantity} ${r.unit} · ${r.district}`),
          el('div', { class: 'text-faint' }, timeAgo(r.createdAt))
        ]),
        el('span', { class: `pill pill-${statusPillClass}` }, r.status)
      ]),
      el('p', { class: 'mt-16', style: 'font-style:italic;' }, `“${r.message}”`),
      el('a', { class: 'nav-link', style: 'cursor:pointer;', onclick: () => navigate(`listing/${r.listingId}`) }, 'View listing →')
    ]);

    if (level !== 'none') {
      card.appendChild(renderRevealCard(level, otherUser, otherLabel));
    }

    if (mode === 'incoming' && (r.status === 'pending' || r.status === 'discussing')) {
      const declineBtn = el('button', { class: 'btn btn-outline btn-sm' }, 'Decline');
      const actionBtn = r.status === 'pending'
        ? el('button', { class: 'btn btn-primary btn-sm' }, 'Discuss')
        : el('button', { class: 'btn btn-primary btn-sm' }, 'Accept');

      declineBtn.addEventListener('click', () => act(r, 'declined', card));
      actionBtn.addEventListener('click', () => act(r, r.status === 'pending' ? 'discussing' : 'accepted', card));

      card.appendChild(el('div', { class: 'flex gap-12 mt-16' }, [declineBtn, actionBtn]));
    }

    return card;
  }

  async function act(r, newStatus, card) {
    try {
      await updateRequestStatus(r.id, newStatus, r.listingId);
      toast(newStatus === 'accepted' ? 'Deal accepted!' : newStatus === 'discussing' ? 'Contact details unlocked for discussion.' : 'Request declined.', 'success');
      drawBody();
    } catch (err) {
      console.error(err);
      toast('Could not update request.', 'error');
    }
  }

  drawTabs();
  await drawBody();
}
