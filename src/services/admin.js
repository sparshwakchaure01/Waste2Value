import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPlatformStats() {
  const [listingsSnap, requestsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'listings')),
    getDocs(collection(db, 'requests')),
    getDocs(collection(db, 'users')),
  ]);

  const listings = listingsSnap.docs.map(d => d.data());
  const requests = requestsSnap.docs.map(d => d.data());
  const users = usersSnap.docs.map(d => d.data());

  const accepted = requests.filter(r => r.status === 'accepted' || r.status === 'completed');
  const totalQuantityMatched = accepted.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const byCategory = {};
  for (const l of listings) {
    byCategory[l.category] = (byCategory[l.category] || 0) + 1;
  }

  return {
    totalUsers: users.length,
    totalIndustry: users.filter(u => u.role === 'industry').length,
    totalLogistics: users.filter(u => u.role === 'logistics').length,
    totalListings: listings.length,
    totalAvailable: listings.filter(l => l.status === 'Available').length,
    totalMatched: listings.filter(l => l.status === 'Matched').length,
    totalRequests: requests.length,
    totalAccepted: accepted.length,
    totalQuantityMatched,
    byCategory
  };
}
