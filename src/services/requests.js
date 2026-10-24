import {
  collection, addDoc, doc, getDocs, updateDoc, query, where, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { updateListingStatus, newestFirst } from './listings.js';

const COL = 'requests';

// status: 'pending' -> 'declined' | 'discussing' -> 'accepted' | 'declined' -> (logistics) 'completed'

export async function sendRequest({ listing, buyerId, message, offeredQty = null, offerPrice = null }) {
  const ref = await addDoc(collection(db, COL), {
    listingId: listing.id,
    sellerId: listing.ownerId,
    buyerId,
    message,
    offeredQty: offeredQty ? Number(offeredQty) : null,
    offerPrice: offerPrice ? Number(offerPrice) : null,
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
  const q = query(collection(db, COL), where('sellerId', '==', sellerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
}

export async function getOutgoingRequests(buyerId) {
  const q = query(collection(db, COL), where('buyerId', '==', buyerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
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

// ---- counter-offers: the seller proposes price/quantity; the buyer accepts or declines ----
export async function sendCounter(requestId, { price, qty, note }) {
  await updateDoc(doc(db, COL, requestId), {
    counter: { price: Number(price), qty: Number(qty), note: (note || '').slice(0, 200), status: 'open', by: 'seller', at: Date.now() },
    updatedAt: serverTimestamp()
  });
}

export async function respondCounter(requestId, counter, accept) {
  await updateDoc(doc(db, COL, requestId), {
    counter: { ...counter, status: accept ? 'accepted' : 'declined', respondedAt: Date.now() },
    updatedAt: serverTimestamp()
  });
}

// The terms both sides are working to: an accepted counter wins, then the buyer's offer, then the listing.
export function dealTerms(r) {
  if (r.counter && r.counter.status === 'accepted') return { price: r.counter.price, qty: r.counter.qty, source: 'counter-offer' };
  return {
    price: r.offerPrice ?? r.costPerKg,
    qty: r.offeredQty ?? r.quantity,
    source: r.offerPrice || r.offeredQty ? 'buyer offer' : 'listing'
  };
}
