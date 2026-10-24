import {
  collection, addDoc, doc, getDocs, updateDoc, query, where, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { updateListingStatus } from './listings.js';

const COL = 'requests';

// status: 'pending' -> 'declined' | 'discussing' -> 'accepted' | 'declined' -> (logistics) 'completed'

export async function sendRequest({ listing, buyerId, message }) {
  const ref = await addDoc(collection(db, COL), {
    listingId: listing.id,
    sellerId: listing.ownerId,
    buyerId,
    message,
    status: 'pending',
    // denormalized snapshot so the logistics dashboard & lists don't need extra reads
    category: listing.category,
    quantity: listing.quantity,
    unit: listing.unit,
    district: listing.district,
    costPerKg: listing.costPerKg,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getIncomingRequests(sellerId) {
  const q = query(collection(db, COL), where('sellerId', '==', sellerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getOutgoingRequests(buyerId) {
  const q = query(collection(db, COL), where('buyerId', '==', buyerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateRequestStatus(requestId, status, listingId) {
  await updateDoc(doc(db, COL, requestId), { status, updatedAt: serverTimestamp() });
  if (status === 'accepted' && listingId) {
    await updateListingStatus(listingId, 'Matched');
  }
}

export async function getRequestById(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// What contact info this request's status allows showing, to BOTH sides.
export function revealLevel(status) {
  if (status === 'accepted' || status === 'completed') return 'full';   // name, phone, email, address
  if (status === 'discussing') return 'phone';                          // phone only, per the Discuss flow
  return 'none';
}

// Deals ready for a logistics operator to pick up — accepted requests whose
// listing district matches one of the operator's selected districts.
export async function getAcceptedDealsForDistricts(districts) {
  if (!districts || !districts.length) return [];
  const q = query(collection(db, COL), where('status', '==', 'accepted'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return all.filter(r => districts.includes(r.district));
}
