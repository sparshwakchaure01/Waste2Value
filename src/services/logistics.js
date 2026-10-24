import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

// Logistics details live on the user's own profile doc (role === 'logistics').
// setDoc+merge so the save works even if the doc was created by an older flow.
export async function saveLogisticsProfile(uid, { vehicleType, districts, phone, companyName }) {
  await setDoc(doc(db, 'users', uid), {
    vehicleType: vehicleType || '',
    districts: districts || [],
    phone: phone || '',
    companyName: companyName || ''
  }, { merge: true });
}
