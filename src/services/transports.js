import {
  collection, doc, getDocs, setDoc, writeBatch, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { revealLevel } from './requests.js';
import { newestFirst } from './listings.js';

// A transport request is sent by the buyer or seller of an ACCEPTED deal to ONE logistics partner.
// Only that partner can see it. Doc id is deterministic (requestId_logisticsId) so the same partner
// can't be asked twice and the security rules can look the document up directly.
//
// status: pending → accepted → in_transit → completed   (or pending → declined)
// When a partner accepts, the deal itself records `logisticsId`, which closes it to other partners.
const COL = 'transports';

export const transportId = (requestId, logisticsId) => `${requestId}_${logisticsId}`;

export const TRANSPORT_LABEL = {
  pending: 'requested',
  accepted: 'confirmed',
  in_transit: 'in transit',
  completed: 'delivered',
  declined: 'declined'
};

// Same blind-reveal rule as deals: contact details open only once the partner accepts.
export function transportRevealLevel(status) {
  if (status === 'accepted' || status === 'in_transit' || status === 'completed') return revealLevel('accepted');
  return revealLevel(status === 'declined' ? 'declined' : 'pending');
}

export const servesDistrict = (partner, district) =>
  !!partner && (partner.servesAll === true || (partner.districts || []).includes(district));

// Partners who can cover the route: operate in any district, or in the pickup / drop district.
export async function getLogisticsPartners(fromDistrict, toDistrict) {
  const users = collection(db, 'users');
  const queries = [
    getDocs(query(users, where('servesAll', '==', true))),
    getDocs(query(users, where('districts', 'array-contains', fromDistrict)))
  ];
  if (toDistrict && toDistrict !== fromDistrict) {
    queries.push(getDocs(query(users, where('districts', 'array-contains', toDistrict))));
  }
  const snaps = await Promise.all(queries);
  const byId = new Map();
  snaps.forEach(s => s.docs.forEach(d => byId.set(d.id, { id: d.id, ...d.data() })));
  return Array.from(byId.values())
    .filter(u => u.role === 'logistics')
    .map(u => ({ ...u, coversFrom: servesDistrict(u, fromDistrict), coversTo: servesDistrict(u, toDistrict) }))
    .sort((a, b) => (Number(b.coversFrom) + Number(b.coversTo)) - (Number(a.coversFrom) + Number(a.coversTo)));
}

export async function sendTransportRequest({
  request, partner, requesterId, fromDistrict, toDistrict, fromAddress = '', toAddress = '', pickupDate = '', note = ''
}) {
  await setDoc(doc(db, COL, transportId(request.id, partner.id)), {
    requestId: request.id,
    listingId: request.listingId,
    logisticsId: partner.id,
    requesterId,
    sellerId: request.sellerId,
    buyerId: request.buyerId,
    fromDistrict,
    toDistrict,
    fromAddress,
    toAddress,
    pickupDate: pickupDate || null,
    note: note || '',
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

// Only requests addressed to this partner.
export async function getIncomingTransports(logisticsId) {
  const snap = await getDocs(query(collection(db, COL), where('logisticsId', '==', logisticsId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
}

export async function declineTransport(id) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, id), { status: 'declined', updatedAt: serverTimestamp() });
  await batch.commit();
}

// Accepting assigns the partner to the deal (atomically), so nobody else can take it.
export async function acceptTransport(t) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, t.id), { status: 'accepted', updatedAt: serverTimestamp() });
  batch.update(doc(db, 'requests', t.requestId), { logisticsId: t.logisticsId, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function markInTransit(id) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, id), { status: 'in_transit', updatedAt: serverTimestamp() });
  await batch.commit();
}

// Delivered: the transport and the underlying deal are completed together.
export async function markDelivered(t) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'requests', t.requestId), { status: 'completed', updatedAt: serverTimestamp() });
  batch.update(doc(db, COL, t.id), { status: 'completed', updatedAt: serverTimestamp() });
  await batch.commit();
}
