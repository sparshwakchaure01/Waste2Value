// Minimal global store — no framework needed for an app this size.
const listeners = new Set();

export const state = {
  firebaseUser: null,   // raw Firebase Auth user
  userDoc: null,        // Firestore users/{uid} profile — includes role, companyName, phone
  loadingAuth: true
};

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isLoggedIn() {
  return !!state.firebaseUser;
}

export function hasRole() {
  return !!(state.userDoc && state.userDoc.role);
}
