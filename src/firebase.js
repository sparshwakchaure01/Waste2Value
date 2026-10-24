import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration (client-safe values)
const firebaseConfig = {
  apiKey: "AIzaSyAEliqIC5pvoENxpBpSjzaOcFgne-oUZZQ",
  authDomain: "waste2value-6eb7a.firebaseapp.com",
  projectId: "waste2value-6eb7a",
  storageBucket: "waste2value-6eb7a.firebasestorage.app",
  messagingSenderId: "964614791616",
  appId: "1:964614791616:web:397906146fe131d2bfa825"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
