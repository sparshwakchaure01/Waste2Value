import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

// Logistics details live on the user's own profile doc (role === 'logistics').
export async function saveLogisticsProfile(uid, { vehicleType, districts, phone, companyName }) {
  await updateDoc(doc(db, 'users', uid), {
    vehicleType: vehicleType || '',
    districts: districts || [],
    phone: phone || '',
    companyName: companyName || ''
  });
}
