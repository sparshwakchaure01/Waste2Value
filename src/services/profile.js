import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { state, setState } from '../state.js';

// Fields a user may edit on their own profile. `role` is deliberately absent — it is permanent.
const EDITABLE = [
  'name', 'companyName', 'phone', 'district', 'address', 'about', 'gstin', 'website',
  'vehicleType', 'vehicleNumber', 'capacityTonnes', 'districts', 'servesAll'
];

export async function saveProfile(uid, patch) {
  const clean = {};
  EDITABLE.forEach(k => { if (k in patch) clean[k] = patch[k]; });
  await setDoc(doc(db, 'users', uid), clean, { merge: true });
  setState({ userDoc: { ...state.userDoc, ...clean } });
  return clean;
}

// Returns { percent, missing[] } — what is still empty on the profile.
export function profileCompleteness(u) {
  if (!u) return { percent: 0, missing: [] };
  const checks = [
    ['Your name', !!u.name],
    ['Company name', !!u.companyName],
    ['Phone', !!u.phone],
    ['District', !!u.district],
    ['Address', !!u.address],
    ['About', !!u.about]
  ];
  if (u.role === 'logistics') {
    checks.push(['Vehicle type', !!u.vehicleType], ['Vehicle number', !!u.vehicleNumber],
      ['Service area', u.servesAll === true || (u.districts || []).length > 0]);
  }
  const done = checks.filter(([, ok]) => ok).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([l]) => l) };
}
