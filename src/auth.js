import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.js';
import { setState } from './state.js';
import { toast } from './utils.js';

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    toast('Google sign-in failed — please try again.', 'error');
  }
}

export async function signOutUser() {
  await signOut(auth);
  window.location.hash = '#/';
}

export async function fetchUserDoc(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createUserProfile(uid, { role, companyName, phone, email, name, photoURL, district }) {
  const ref = doc(db, 'users', uid);
  const payload = {
    role,                 // "industry" | "logistics"
    companyName: companyName || '',
    phone: phone || '',
    email: email || '',
    name: name || '',
    photoURL: photoURL || '',
    district: district || '',
    createdAt: serverTimestamp()
  };
  await setDoc(ref, payload);
  return { id: uid, ...payload };
}

// Call once, at app bootstrap. Keeps state.firebaseUser / state.userDoc in sync.
export function listenAuthState(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setState({ firebaseUser: null, userDoc: null, loadingAuth: false });
      onReady();
      return;
    }
    let userDoc = null;
    try {
      userDoc = await fetchUserDoc(user.uid);
    } catch (err) {
      console.error('Could not load user profile', err);
      toast('Could not load your profile — check Firestore rules and connection.', 'error');
    }
    setState({ firebaseUser: user, userDoc, loadingAuth: false });
    onReady();
  });
}
