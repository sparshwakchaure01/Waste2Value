import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

// One platform-wide banner, edited by admins. Stored at config/announcement.
const REF = () => doc(db, 'config', 'announcement');
let cache;
let cachedAt = 0;

export async function getAnnouncement(force = false) {
  if (!force && cache !== undefined && Date.now() - cachedAt < 60000) return cache;
  try {
    const snap = await getDoc(REF());
    cache = snap.exists() ? snap.data() : null;
  } catch {
    cache = null;
  }
  cachedAt = Date.now();
  return cache;
}

export async function setAnnouncement({ text, tone, active }) {
  await setDoc(REF(), { text: text.slice(0, 240), tone, active, updatedAt: serverTimestamp() });
  cache = { text, tone, active };
  cachedAt = Date.now();
}
