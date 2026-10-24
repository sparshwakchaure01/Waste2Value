import {
  collection, doc, getDocs, setDoc, writeBatch, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { revealLevel } from './requests.js';
import { newestFirst } from './listings.js';

// A transport request asks one logistics partner to move an ACCEPTED deal.
// Doc id is deterministic (requestId_logisticsId) so the same partner can't be asked twice
// and the security rules can look the document up directly.
const COL = 'transports';

export const transportId = (requestId, logisticsId) => `${requestId}_${logisticsId}`;

// Same blind-reveal rule as deals: contact details open only once the partner accepts.
export function transportRevealLevel(status) {
  if (status === 'accepted' || status === 'completed') return revealLevel('accepted');
  return revealLevel(status === 'declined' ? 'declined' : 'pending');
}

// Partners who serve the deal's district.
export async function getLogisticsPartners(district) {
  const q = query(collection(db, 'users'), where('districts', 'array-contains', district));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.role === 'logistics');
}

export async function sendTransportRequest({ request, partner, requesterId }) {
  await setDoc(doc(db, COL, transportId(request.id, partner.id)), {
    requestId: request.id,
    listingId: request.listingId,
    logisticsId: partner.id,
    requesterId,
    sellerId: request.sellerId,
    buyerId: request.buyerId,
    district: request.district,
    category: request.category,
    quantity: request.quantity,
    unit: request.unit,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// Transport requests on deals where this user is the seller or the buyer.
export async function getTransportsForUser(uid) {
  const [asSeller, asBuyer] = await Promise.all([
    getDocs(query(collection(db, COL), where('sellerId', '==', uid))),
    getDocs(query(collection(db, COL), where('buyerId', '==', uid)))
  ]);
  const byId = new Map();
  [...asSeller.docs, ...asBuyer.docs].forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));
  return Array.from(byId.values()).sort(newestFirst);
}

export async function getIncomingTransports(logisticsId) {
  const snap = await getDocs(query(collection(db, COL), where('logisticsId', '==', logisticsId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
}

export async function updateTransportStatus(id, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, id), { status, updatedAt: serverTimestamp() });
  await batch.commit();
}

// Pickup done: mark the transport and the underlying deal completed in one atomic write.
export async function completePickup(transport) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', transport.requestId), { status: 'completed', updatedAt: serverTimestamp() });
  batch.update(doc(db, COL, transport.id), { status: 'completed', updatedAt: serverTimestamp() });
  await batch.commit();
}
