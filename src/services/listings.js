import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase.js';

const COL = 'listings';

export async function createListing(ownerId, data) {
  const ref = await addDoc(collection(db, COL), {
    ownerId,
    category: data.category,
    grade: data.grade,
    quantity: Number(data.quantity),
    unit: data.unit,
    costPerKg: Number(data.costPerKg),
    availabilityFrequency: data.availabilityFrequency,
    frequencyQty: data.frequencyQty ? Number(data.frequencyQty) : null,
    status: 'Available',
    description: data.description || '',
    photoBase64: data.photoBase64 || null,
    district: data.district,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function getListingById(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Fetch by status (single Firestore `where`, avoids needing composite indexes),
// then apply the rest of the filters client-side. Fine at hackathon/MVP scale.
export async function getListings({ status = 'Available' } = {}) {
  const q = query(collection(db, COL), where('status', '==', status), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUserListings(ownerId) {
  const q = query(collection(db, COL), where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateListingStatus(id, status) {
  await updateDoc(doc(db, COL, id), { status });
}

export function filterListingsClientSide(listings, { category, grade, district, maxPrice, frequency, search } = {}) {
  return listings.filter(l => {
    if (category && l.category !== category) return false;
    if (grade && l.grade !== grade) return false;
    if (district && l.district !== district) return false;
    if (frequency && l.availabilityFrequency !== frequency) return false;
    if (maxPrice && Number(l.costPerKg) > Number(maxPrice)) return false;
    if (search) {
      const hay = `${l.category} ${l.description}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}
