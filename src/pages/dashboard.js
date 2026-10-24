import { el, timeAgo, counter, skeletonStats } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getUserListings, totalKg } from '../services/listings.js';
import { getIncomingRequests, getOutgoingRequests } from '../services/requests.js';
import { getIncomingTransports } from '../services/transports.js';
import { barChart } from '../components/charts.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';
import { getInsights, buildAttention } from '../services/insights.js';
import { startTour } from '../components/tour.js';

// "Needs your attention" — actionable items pulled from deals, transport, saved searches and profile.
async function fillAttention(host) {
  let items;
  try { items = buildAttention(await getInsights()); } catch { return; }
  if (!items.length) {
    host.replaceChildren(el('div', { class: 'attn-clear' }, [icon('check', 20), 'You’re all caught up — nothing needs your attention.']));
    return;
  }
  host.replaceChildren(el('div', { class: 'attention' }, items.map((it, i) => el('button', {
    class: `attn ${it.tone}`, style: `animation-delay:${i * 60}ms`, onclick: () => navigate(it.path)
  }, [icon(it.icon, 20), el('div', {}, [
    el('b', {}, it.pct ? `${it.count}%` : String(it.count)),
    el('span', { class: 't' }, it.pct ? it.title.replace(/^% /, '') : it.title)
  ])]))));
}

export async function renderDashboard(container) {
  const role = state.userDoc.role;
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [
      el('h1', {}, `Welcome back, ${state.userDoc.companyName || state.userDoc.name}`),
      el('p', {}, role === 'industry' ? 'Here’s what’s happening with your listings.' : 'Here’s your service area at a glance.')
    ])
  ]));

  const attention = el('div', {});
  container.appendChild(attention);
  fillAttention(attention);

  try {
    if (role === 'industry') await renderIndustryDashboard(container);
    else await renderLogisticsDashboardHome(container);
  } catch (err) {
    console.error(err);
    container.appendChild(emptyState('search', 'Could not load your dashboard — check your connection and Firestore rules.'));
  }
  setTimeout(() => startTour(), 900);
}

function quickAction(iconName, label, path, primary = false) {
  return el('button', { class: `qa ${primary ? 'primary' : ''}`, onclick: () => navigate(path) }, [icon(iconName, 20), label]);
}

const ms = ts => (ts?.toMillis ? ts.toMillis() : Date.now());

// Recent events derived from the user's listings and requests (both directions).
function buildActivity(listings, incoming, outgoing) {
  const events = [];
  listings.forEach(l => events.push({ ts: l.createdAt, tone: '', text: `You listed ${l.quantity} ${l.unit} of ${l.category}` }));
  incoming.forEach(r => {
    events.push({ ts: r.createdAt, tone: '', text: `New request on your ${r.category} listing` });
    if (r.status !== 'pending') {
      const verb = { discussing: 'opened a discussion on', accepted: 'accepted', declined: 'declined', completed: 'completed pickup of' }[r.status];
      events.push({ ts: r.updatedAt, tone: r.status === 'declined' ? 'bad' : '', text: `You ${verb} a request for ${r.category}` });
    }
  });
  outgoing.forEach(r => {
    events.push({ ts: r.createdAt, tone: 'warn', text: `You requested ${r.quantity} ${r.unit} of ${r.category}` });
    if (r.status !== 'pending') {
      const verb = { discussing: 'wants to discuss', accepted: 'accepted', declined: 'declined', completed: 'completed pickup of' }[r.status];
      events.push({ ts: r.updatedAt, tone: r.status === 'declined' ? 'bad' : '', text: `Seller ${verb} your ${r.category} request` });
    }
  });
  return events.sort((a, b) => ms(b.ts) - ms(a.ts)).slice(0, 7);
}

async function renderIndustryDashboard(container) {
  const uid = state.firebaseUser.uid;
  const skeleton = skeletonStats(5);
  container.appendChild(skeleton);
  const [listings, incoming, outgoing] = await Promise.all([
    getUserListings(uid), getIncomingRequests(uid), getOutgoingRequests(uid)
  ]);
  skeleton.remove();

  const needingReply = incoming.filter(r => r.status === 'pending' || r.status === 'discussing');
  const accepted = [...incoming, ...outgoing].filter(r => r.status === 'accepted' || r.status === 'completed');
  const kgListed = Math.round(listings.reduce((s, l) => s + totalKg(l), 0));
  const kgMatched = Math.round(listings.filter(l => l.status === 'Matched').reduce((s, l) => s + totalKg(l), 0));

  container.appendChild(el('div', { class: 'stat-row' }, [
    statCard(listings.length, 'My Listings'),
    statCard(needingReply.length, 'Requests Needing Reply'),
    statCard(accepted.length, 'Accepted Matches'),
    statCard(kgListed, 'kg Listed'),
    statCard(kgMatched, 'kg Matched'),
  ]));

  container.appendChild(el('div', { class: 'qa-grid' }, [
    quickAction('plus', 'New Listing', 'create-listing', true),
    quickAction('boxes', 'My Listings', 'my-listings'),
    quickAction('grid', 'Marketplace', 'marketplace'),
    quickAction('inbox', 'My Matches', 'matches'),
  ]));

  const byCategory = {};
  listings.forEach(l => { byCategory[l.category] = (byCategory[l.category] || 0) + 1; });
  const chartEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const activity = buildActivity(listings, incoming, outgoing);

  container.appendChild(el('div', { class: 'section-head' }, [el('h3', {}, 'Overview')]));
  container.appendChild(el('div', { class: 'dash-grid' }, [
    el('div', { class: 'card' }, [
      el('h3', {}, 'Listings by category'),
      chartEntries.length ? barChart(chartEntries) : emptyState('listings', 'Publish a listing to see your mix.')
    ]),
    el('div', { class: 'card' }, [
      el('h3', {}, 'Recent activity'),
      activity.length
        ? el('div', { class: 'feed' }, activity.map(a => el('div', { class: 'feed-item' }, [
            el('span', { class: `feed-dot ${a.tone}` }),
            el('span', {}, a.text),
            el('span', { class: 'feed-time' }, timeAgo(a.ts))
          ])))
        : emptyState('requests', 'Nothing yet — activity shows up here.')
    ])
  ]));
}

async function renderLogisticsDashboardHome(container) {
  const me = state.userDoc;
  const districts = me.districts || [];
  const configured = me.servesAll === true || districts.length > 0;
  const skeleton = skeletonStats(4);
  container.appendChild(skeleton);
  const jobs = await getIncomingTransports(state.firebaseUser.uid);
  skeleton.remove();

  container.appendChild(el('div', { class: 'stat-row' }, [
    statCard(me.servesAll ? 36 : districts.length, me.servesAll ? 'Districts (any)' : 'Districts Covered'),
    statCard(jobs.filter(t => t.status === 'pending').length, 'New Requests'),
    statCard(jobs.filter(t => t.status === 'accepted' || t.status === 'in_transit').length, 'Active Jobs'),
    statCard(jobs.filter(t => t.status === 'completed').length, 'Delivered'),
  ]));

  if (!configured) {
    container.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Set your service area'),
      el('p', {}, 'Add the districts you cover so buyers and sellers can find and request you.'),
      el('button', { class: 'btn btn-primary', onclick: () => navigate('profile') }, 'Open My Profile')
    ]));
  }
  container.appendChild(el('div', { class: 'qa-grid' }, [
    quickAction('truck', 'Transport Jobs', 'logistics', true),
    quickAction('boxes', 'My Profile', 'profile'),
  ]));
}

function statCard(n, label) {
  return el('div', { class: 'stat-card' }, [
    counter(n),
    el('div', { class: 'l' }, label)
  ]);
}
