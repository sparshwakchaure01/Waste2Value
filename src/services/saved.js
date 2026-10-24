import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase.js';
import { state, setState } from '../state.js';

// Saved listings live on the user's own profile doc as `savedListings: string[]`.
export function savedIds() {
  return state.userDoc?.savedListings || [];
}

export function isSaved(listingId) {
  return savedIds().includes(listingId);
}

// Returns the new saved state (true = now saved).
export async function toggleSaved(uid, listingId) {
  const on = !isSaved(listingId);
  await updateDoc(doc(db, 'users', uid), {
    savedListings: on ? arrayUnion(listingId) : arrayRemove(listingId)
  });
  const next = on ? [...savedIds(), listingId] : savedIds().filter(id => id !== listingId);
  setState({ userDoc: { ...state.userDoc, savedListings: next } });
  return on;
}
