import { state } from '../state.js';
import { getUserListings, getListings } from './listings.js';
import { getIncomingRequests, getOutgoingRequests } from './requests.js';
import { getTransportsForUser, getIncomingTransports } from './transports.js';
import { getReviewsBy } from './reviews.js';
import { getSearches, newMatches } from './searches.js';
import { getAnnouncement } from './announcement.js';
import { profileCompleteness } from './profile.js';
import { reviewId } from './reviews.js';

// One cached snapshot of "what's going on for me", feeding the notification centre,
// the bell badge and the dashboard "needs your attention" strip.
let cache = null;
let cachedAt = 0;
const ms = ts => (ts?.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : 0));

export async function getInsights(force = false) {
  if (!force && cache && Date.now() - cachedAt < 20000) return cache;
  const uid = state.firebaseUser.uid;
  const role = state.userDoc?.role;
  let data;
  if (role === 'industry') {
    const [listings, incoming, outgoing, transports, available, reviews, announcement] = await Promise.all([
      getUserListings(uid), getIncomingRequests(uid), getOutgoingRequests(uid), getTransportsForUser(uid),
      getListings({ status: 'Available' }), getReviewsBy(uid), getAnnouncement()
    ]);
    data = { role, uid, listings, incoming, outgoing, transports, available, reviews, announcement };
  } else {
    const [jobs, announcement] = await Promise.all([getIncomingTransports(uid), getAnnouncement()]);
    data = { role, uid, jobs, announcement };
  }
  cache = data;
  cachedAt = Date.now();
  return data;
}

export function clearInsights() { cache = null; }

// ---------------- notifications ----------------
export function buildNotifications(d) {
  const out = [];
  const push = (id, ts, tone, title, text, path) => { if (ts) out.push({ id, ts, tone, title, text, path }); };

  if (d.role === 'industry') {
    d.incoming.forEach(r => {
      push(`in-${r.id}`, ms(r.createdAt), 'ok', 'New request received', `${r.category} · ${r.quantity} ${r.unit}`, 'matches');
      if (r.counter?.status === 'accepted' || r.counter?.status === 'declined') {
        push(`cr-${r.id}`, r.counter.respondedAt, r.counter.status === 'accepted' ? 'ok' : 'warn',
          `Buyer ${r.counter.status} your counter-offer`, `${r.category} · ₹${r.counter.price}/kg`, 'matches');
      }
    });
    d.outgoing.forEach(r => {
      if (r.status !== 'pending') {
        const verb = { discussing: 'wants to discuss', accepted: 'accepted', declined: 'declined', completed: 'delivered' }[r.status];
        push(`out-${r.id}-${r.status}`, ms(r.updatedAt), r.status === 'declined' ? 'warn' : 'ok', `Seller ${verb} your request`, `${r.category} · ${r.quantity} ${r.unit}`, 'matches');
      }
      if (r.counter?.status === 'open') push(`ctr-${r.id}`, r.counter.at, 'hot', 'Counter-offer from seller', `₹${r.counter.price}/kg for ${r.counter.qty} ${r.unit}`, 'matches');
    });
    d.transports.forEach(t => {
      const map = { accepted: ['ok', 'Transport partner confirmed'], in_transit: ['ok', 'Pickup done — in transit'], completed: ['ok', 'Delivered'], declined: ['warn', 'A transport partner declined'] };
      if (map[t.status]) push(`tr-${t.id}-${t.status}`, ms(t.updatedAt), map[t.status][0], map[t.status][1], `${t.category} · ${t.fromDistrict} → ${t.toDistrict}`, 'matches');
    });
    getSearches().forEach(s => {
      const hits = newMatches(d.available, s, d.uid);
      if (hits.length) push(`ss-${s.id}-${hits.length}`, Math.max(...hits.map(l => ms(l.createdAt))), 'hot', `${hits.length} new listing${hits.length === 1 ? '' : 's'} match “${s.name}”`, 'Your saved search', 'marketplace');
    });
  } else {
    d.jobs.forEach(t => {
      const route = `${t.fromDistrict} → ${t.toDistrict}`;
      if (t.status === 'pending') push(`j-${t.id}`, ms(t.createdAt), 'hot', 'New transport request', `${t.category} · ${route}`, 'logistics');
      else if (t.status === 'accepted' || t.status === 'in_transit') push(`j-${t.id}-${t.status}`, ms(t.updatedAt), 'ok', t.status === 'accepted' ? 'Job confirmed' : 'In transit', route, 'logistics');
      else if (t.status === 'completed') push(`j-${t.id}-done`, ms(t.updatedAt), 'ok', 'Delivered', route, 'logistics');
    });
  }

  const a = d.announcement;
  if (a && a.active && a.text) push(`an-${ms(a.updatedAt)}`, ms(a.updatedAt) || Date.now(), 'warn', 'Announcement', a.text, null);
  return out.sort((x, y) => y.ts - x.ts).slice(0, 40);
}

export const unreadCount = (events, seenAt) => events.filter(e => e.ts > (seenAt || 0)).length;

// ---------------- "needs your attention" ----------------
export function buildAttention(d) {
  const items = [];
  const add = (id, tone, icon, count, title, path) => { if (count > 0) items.push({ id, tone, icon, count, title, path }); };

  if (d.role === 'industry') {
    add('reply', 'hot', 'inbox', d.incoming.filter(r => r.status === 'pending' || r.status === 'discussing').length, 'requests waiting for your reply', 'matches');
    add('counter', 'hot', 'chart', d.outgoing.filter(r => r.counter?.status === 'open').length, 'counter-offers to review', 'matches');

    const hasPartner = (r) => r.logisticsId || d.transports.some(t => t.requestId === r.id && t.status !== 'declined');
    add('partner', 'warn', 'truck', [...d.incoming, ...d.outgoing].filter(r => r.status === 'accepted' && !hasPartner(r)).length, 'accepted deals need a transport partner', 'matches');

    const mine = new Set(d.reviews.map(r => r.id));
    const toRate = [...d.incoming, ...d.outgoing].filter(r => r.status === 'completed' && !mine.has(reviewId(r.id, d.uid, r.sellerId === d.uid ? r.buyerId : r.sellerId)));
    add('rate', 'ok', 'star', toRate.length, 'delivered deals to rate', 'matches');

    const hits = getSearches().reduce((s, x) => s + newMatches(d.available, x, d.uid).length, 0);
    add('searches', 'ok', 'sliders', hits, 'new listings match your saved searches', 'marketplace');
  } else {
    add('jobs', 'hot', 'inbox', d.jobs.filter(t => t.status === 'pending').length, 'new transport requests', 'logistics');
    add('pickup', 'warn', 'truck', d.jobs.filter(t => t.status === 'accepted').length, 'confirmed jobs waiting for pickup', 'logistics');
    add('deliver', 'warn', 'route', d.jobs.filter(t => t.status === 'in_transit').length, 'jobs in transit — mark delivered', 'logistics');
    const configured = state.userDoc?.servesAll === true || (state.userDoc?.districts || []).length > 0;
    if (!configured) items.push({ id: 'area', tone: 'hot', icon: 'map', count: 1, title: 'set your service area so partners can find you', path: 'profile' });
  }
  const pc = profileCompleteness(state.userDoc);
  if (pc.percent < 80) items.push({ id: 'profile', tone: 'ok', icon: 'user', count: pc.percent, title: '% profile complete — finish it to build trust', path: 'profile', pct: true });
  return items;
}
