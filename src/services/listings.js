import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp
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
    photos: data.photos || [],
    photoBase64: (data.photos && data.photos[0]) || null,
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
// NOTE: where() + orderBy() on a different field needs a composite index, so
// newest-first ordering is done client-side (see newestFirst) instead.
export function newestFirst(a, b) {
  const t = x => (x.createdAt?.toMillis ? x.createdAt.toMillis() : Date.now());
  return t(b) - t(a);
}

export async function getListings({ status = 'Available' } = {}) {
  const q = query(collection(db, COL), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
}

export async function getUserListings(ownerId) {
  const q = query(collection(db, COL), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
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

export const SORT_OPTIONS = [
  ['newest', 'Newest first'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['qty-desc', 'Quantity: high to low']
];

const inKg = l => Number(l.quantity) * (l.unit === 'tonnes' ? 1000 : 1);

export function sortListings(listings, key = 'newest') {
  const out = [...listings];
  if (key === 'price-asc') return out.sort((a, b) => Number(a.costPerKg) - Number(b.costPerKg));
  if (key === 'price-desc') return out.sort((a, b) => Number(b.costPerKg) - Number(a.costPerKg));
  if (key === 'qty-desc') return out.sort((a, b) => inKg(b) - inKg(a));
  return out.sort(newestFirst);
}

// Photos are stored as base64 data URLs: `photos` (up to 4), with the first mirrored in photoBase64.
export function listingPhotos(l) {
  if (l.photos && l.photos.length) return l.photos;
  return l.photoBase64 ? [l.photoBase64] : [];
}

export async function updateListing(id, data) {
  await updateDoc(doc(db, COL, id), {
    category: data.category,
    grade: data.grade,
    quantity: Number(data.quantity),
    unit: data.unit,
    costPerKg: Number(data.costPerKg),
    availabilityFrequency: data.availabilityFrequency,
    frequencyQty: data.frequencyQty ? Number(data.frequencyQty) : null,
    description: data.description || '',
    photos: data.photos || [],
    photoBase64: (data.photos && data.photos[0]) || null,
    district: data.district,
    ...(data.status ? { status: data.status } : {})
  });
}

export async function deleteListing(id) {
  await deleteDoc(doc(db, COL, id));
}

export const totalKg = l => Number(l.quantity) * (l.unit === 'tonnes' ? 1000 : 1);
export const estimatedValue = l => totalKg(l) * Number(l.costPerKg || 0);
