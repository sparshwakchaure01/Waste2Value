import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { state, setState } from '../state.js';
import { filterListingsClientSide } from './listings.js';

// Saved searches live on the user's profile doc as savedSearches[{id,name,filters,lastSeen}].
const MAX_SEARCHES = 10;

export const getSearches = () => state.userDoc?.savedSearches || [];

async function persist(uid, savedSearches) {
  await updateDoc(doc(db, 'users', uid), { savedSearches });
  setState({ userDoc: { ...state.userDoc, savedSearches } });
}

export async function addSearch(uid, name, filters) {
  const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const entry = { id: Date.now().toString(36), name: name.slice(0, 40), filters: active, lastSeen: Date.now() };
  await persist(uid, [...getSearches(), entry].slice(-MAX_SEARCHES));
  return entry;
}

export async function removeSearch(uid, id) {
  await persist(uid, getSearches().filter(s => s.id !== id));
}

export async function markSearchesSeen(uid) {
  if (!getSearches().length) return;
  const now = Date.now();
  await persist(uid, getSearches().map(s => ({ ...s, lastSeen: now })));
}

const createdMs = l => (l.createdAt?.toMillis ? l.createdAt.toMillis() : 0);

// Listings that match a saved search and were created since the user last looked.
export function newMatches(listings, search, uid) {
  const pool = listings.filter(l => l.ownerId !== uid && l.status === 'Available' && createdMs(l) > (search.lastSeen || 0));
  return filterListingsClientSide(pool, search.filters || {});
}
