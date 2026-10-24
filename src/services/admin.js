import {
  collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { state } from '../state.js';

const all = async (name) => (await getDocs(collection(db, name))).docs.map(d => ({ id: d.id, ...d.data() }));

export const getAllUsers = () => all('users');
export const getAllListings = () => all('listings');
export const getAllRequests = () => all('requests');
export const getAllTransports = () => all('transports');
export const getAllReviews = () => all('reviews');

const createdMs = x => (x.createdAt?.toMillis ? x.createdAt.toMillis() : 0);

// One load for the whole admin panel.
export async function loadAdminData() {
  const [users, listings, requests, transports, reviews] = await Promise.all([
    getAllUsers(), getAllListings(), getAllRequests(), getAllTransports(), getAllReviews()
  ]);
  return { users, listings, requests, transports, reviews };
}

// Platform numbers, optionally limited to records created since `sinceMs` (0 = all time).
export function computeStats({ users, listings, requests, transports }, sinceMs = 0) {
  const inRange = x => !sinceMs || createdMs(x) >= sinceMs;
  const u = users.filter(inRange), l = listings.filter(inRange), r = requests.filter(inRange), t = transports.filter(inRange);
  const accepted = r.filter(x => x.status === 'accepted' || x.status === 'completed');
  const kg = x => Number(x.quantity || 0) * (x.unit === 'tonnes' ? 1000 : 1);
  const byCategory = {};
  l.forEach(x => { byCategory[x.category] = (byCategory[x.category] || 0) + 1; });
  return {
    totalUsers: u.length,
    totalIndustry: u.filter(x => x.role === 'industry').length,
    totalLogistics: u.filter(x => x.role === 'logistics').length,
    totalListings: l.length,
    totalAvailable: l.filter(x => x.status === 'Available').length,
    totalMatched: l.filter(x => x.status === 'Matched').length,
    totalRequests: r.length,
    totalAccepted: accepted.length,
    totalDelivered: r.filter(x => x.status === 'completed').length,
    totalTransports: t.length,
    kgListed: Math.round(l.reduce((s, x) => s + kg(x), 0)),
    kgMatched: Math.round(accepted.reduce((s, x) => s + kg(x), 0)),
    byCategory
  };
}

// Daily counts for the last `days` days → [[label, count], …]
export function dailySeries(items, days) {
  const buckets = [];
  const end = new Date(); end.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(end.getDate() - i);
    buckets.push({ t: d.getTime(), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), n: 0 });
  }
  items.forEach(x => {
    const t = createdMs(x);
    if (!t) return;
    const b = buckets.findLast ? buckets.findLast(k => t >= k.t) : [...buckets].reverse().find(k => t >= k.t);
    if (b && t >= buckets[0].t) b.n += 1;
  });
  return buckets.map(b => [b.label, b.n]);
}

// ---- moderation ----
export async function logAdmin(action, target, detail = '') {
  await addDoc(collection(db, 'adminLog'), {
    adminEmail: state.firebaseUser?.email || '', action, target, detail, at: serverTimestamp()
  });
}

export async function getAdminLog(n = 100) {
  const snap = await getDocs(query(collection(db, 'adminLog'), orderBy('at', 'desc'), limit(n)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setUserFlag(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch);
}

export async function adminSetListingStatus(id, status) {
  await updateDoc(doc(db, 'listings', id), { status });
}

export async function adminDeleteListing(id) {
  await deleteDoc(doc(db, 'listings', id));
}
