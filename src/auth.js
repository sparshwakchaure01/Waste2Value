import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.js';
import { setState } from './state.js';
import { toast } from './utils.js';
import { navigate } from './router.js';
import { ADMIN_EMAILS } from './data/categories.js';

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// One Google popup, three entry points:
//   'signin' — returning user; refused if no account exists yet
//   'signup' — new user; goes on to role selection (onboarding)
//   'admin'  — /admin login; only the ADMIN_EMAILS accounts get through
export async function signInWithGoogle(intent = 'signin') {
  let user;
  try {
    ({ user } = await signInWithPopup(auth, googleProvider));
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    console.error(err);
    toast(err.code === 'auth/unauthorized-domain'
      ? 'This domain is not authorized in Firebase (Authentication → Settings → Authorized domains).'
      : 'Google sign-in failed — please try again.', 'error');
    return;
  }

  if (intent === 'admin') {
    if (!isAdminEmail(user.email)) {
      await signOut(auth);
      toast('This Google account is not authorized for admin access.', 'error');
      return;
    }
    setState({ firebaseUser: user });
    navigate('admin');
    return;
  }

  let userDoc = null;
  try {
    userDoc = await fetchUserDoc(user.uid);
  } catch (err) {
    console.error(err);
    toast('Could not reach the database — check your connection and Firestore rules.', 'error');
    await signOut(auth);
    return;
  }

  if (intent === 'signin' && !userDoc) {
    await signOut(auth);
    toast('No account found for this Google account — please create one first.', 'error');
    return;
  }

  setState({ firebaseUser: user, userDoc });
  if (userDoc) {
    toast(intent === 'signup' ? 'You already have an account — signed you in.' : 'Welcome back!', 'success');
    navigate('dashboard');
  } else {
    navigate('onboarding');
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
