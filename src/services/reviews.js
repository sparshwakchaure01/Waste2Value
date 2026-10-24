import { collection, doc, getDocs, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

// Reviews are written once, after a deal is delivered, and never edited.
// Doc id = requestId_reviewerId_revieweeId so each person can review each counterpart once per deal.
const COL = 'reviews';

export const reviewId = (requestId, reviewerId, revieweeId) => `${requestId}_${reviewerId}_${revieweeId}`;

export async function submitReview({ request, reviewerId, revieweeId, kind, rating, text }) {
  await setDoc(doc(db, COL, reviewId(request.id, reviewerId, revieweeId)), {
    requestId: request.id,
    reviewerId,
    revieweeId,
    kind,                       // 'seller' | 'buyer' | 'partner' — who is being reviewed
    rating: Number(rating),
    text: (text || '').slice(0, 200),
    category: request.category,
    createdAt: serverTimestamp()
  });
}

export async function getReviewsBy(uid) {
  const snap = await getDocs(query(collection(db, COL), where('reviewerId', '==', uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getReviewsFor(uid) {
  const snap = await getDocs(query(collection(db, COL), where('revieweeId', '==', uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getRatingSummary(uid) {
  const reviews = await getReviewsFor(uid);
  if (!reviews.length) return { avg: 0, count: 0 };
  const sum = reviews.reduce((s, r) => s + Number(r.rating || 0), 0);
  return { avg: sum / reviews.length, count: reviews.length };
}
