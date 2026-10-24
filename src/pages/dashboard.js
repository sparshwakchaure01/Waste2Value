import { el, timeAgo } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getUserListings } from '../services/listings.js';
import { getIncomingRequests, getOutgoingRequests } from '../services/requests.js';
import { getAcceptedDealsForDistricts } from '../services/requests.js';

export async function renderDashboard(container) {
  const role = state.userDoc.role;
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [
      el('h1', {}, `Welcome back, ${state.userDoc.companyName || state.userDoc.name}`),
      el('p', {}, role === 'industry' ? 'Here’s what’s happening with your listings.' : 'Here’s your service area at a glance.')
    ])
  ]));

  if (role === 'industry') {
    await renderIndustryDashboard(container);
  } else {
    await renderLogisticsDashboardHome(container);
  }
}

async function renderIndustryDashboard(container) {
  const uid = state.firebaseUser.uid;
  const [listings, incoming, outgoing] = await Promise.all([
    getUserListings(uid), getIncomingRequests(uid), getOutgoingRequests(uid)
  ]);

  const pendingIncoming = incoming.filter(r => r.status === 'pending' || r.status === 'discussing');
  const accepted = [...incoming, ...outgoing].filter(r => r.status === 'accepted');

  container.appendChild(el('div', { class: 'stat-row' }, [
    statCard(listings.length, 'My Listings'),
    statCard(pendingIncoming.length, 'Requests Needing Reply'),
    statCard(accepted.length, 'Accepted Matches'),
  ]));

  container.appendChild(el('div', { class: 'flex gap-12 mt-16', style: 'margin-bottom:28px;' }, [
    el('button', { class: 'btn btn-primary', onclick: () => navigate('create-listing') }, '+ New Listing'),
    el('button', { class: 'btn btn-outline', onclick: () => navigate('marketplace') }, 'Browse Marketplace'),
    el('button', { class: 'btn btn-outline', onclick: () => navigate('matches') }, 'View All Matches'),
  ]));

  container.appendChild(el('h3', {}, 'Recent requests on your listings'));
  if (!incoming.length) {
    container.appendChild(el('div', { class: 'empty-state' }, [
      el('div', { class: 'ic' }, '📭'),
      el('p', {}, 'No requests yet — publish a listing to get started.')
    ]));
  } else {
    incoming.slice(0, 4).forEach(r => {
      container.appendChild(el('div', { class: 'request-card' }, [
        el('div', { class: 'flex-between' }, [
          el('strong', {}, `${r.category} · ${r.quantity} ${r.unit}`),
          el('span', { class: `pill pill-${r.status === 'pending' ? 'reserved' : r.status === 'accepted' ? 'matched' : r.status === 'discussing' ? 'available' : 'declined'}` }, r.status)
        ]),
        el('div', { class: 'text-faint' }, timeAgo(r.createdAt))
      ]));
    });
  }
}

async function renderLogisticsDashboardHome(container) {
  const districts = state.userDoc.districts || [];
  const deals = await getAcceptedDealsForDistricts(districts);

  container.appendChild(el('div', { class: 'stat-row' }, [
    statCard(districts.length, 'Districts Covered'),
    statCard(deals.length, 'Deals Ready for Pickup'),
  ]));

  if (!districts.length) {
    container.appendChild(el('div', { class: 'card' }, [
      el('p', {}, 'You haven’t set your service districts yet.'),
      el('button', { class: 'btn btn-primary', onclick: () => navigate('logistics') }, 'Set Up Service Area')
    ]));
  } else {
    container.appendChild(el('button', { class: 'btn btn-primary', onclick: () => navigate('logistics') }, 'View Service Area & Deals'));
  }
}

function statCard(n, label) {
  return el('div', { class: 'stat-card' }, [
    el('div', { class: 'n' }, String(n)),
    el('div', { class: 'l' }, label)
  ]);
}
