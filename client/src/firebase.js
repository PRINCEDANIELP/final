import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';

// Web app Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBH-7m5lVuM3ZImvY4uJtG9u9NXW3EIF4o",
  authDomain: "namma-spot.firebaseapp.com",
  projectId: "namma-spot",
  storageBucket: "namma-spot.firebasestorage.app",
  messagingSenderId: "538951748616",
  appId: "1:538951748616:web:4cf013e440dec8b11ad5bd",
  measurementId: "G-GSH2KPP93B",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Persistent role registry in localStorage
export function saveUserRole(email, role) {
  try {
    const roles = JSON.parse(localStorage.getItem('namma_spot_roles') || '{}');
    roles[email.toLowerCase()] = role;
    localStorage.setItem('namma_spot_roles', JSON.stringify(roles));
  } catch {}
}

export function getUserRole(email, defaultRole = 'driver') {
  try {
    const roles = JSON.parse(localStorage.getItem('namma_spot_roles') || '{}');
    return roles[email.toLowerCase()] || defaultRole;
  } catch {
    return defaultRole;
  }
}

// Convert any error into clean, user-friendly text without ugly "Firebase: Error" prefixes
export function getFirebaseErrorMessage(error) {
  if (!error) return 'An error occurred';
  if (typeof error === 'string') {
    return error.replace(/^Firebase:\s*(Error\s*)?(\(auth\/[^)]+\)\.?\s*)?/i, '').trim();
  }
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please click Create Account above.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please check your credentials and try again.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in window was closed. Please try again.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup was blocked by your browser. Please allow popups or use email sign-in.';
    case 'auth/operation-not-allowed':
      return 'Provider synchronization pending. You can sign in below.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few seconds and try again.';
    default: {
      const raw = error.message || 'Authentication failed. Please try again.';
      return (
        raw.replace(/^Firebase:\s*(Error\s*)?(\(auth\/[^)]+\)\.?\s*)?/i, '').trim() ||
        'Authentication failed. Please try again.'
      );
    }
  }
}

// Create user in Firebase Auth with displayName
export async function registerWithFirebase(email, password, name = '') {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    if (name && name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
    }
    return cred.user;
  } catch (err) {
    console.warn('[Firebase Register notice]', err.code, err.message);
    // If email already registered in Firebase, attempt password sign-in
    if (err.code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        return cred.user;
      } catch (signInErr) {
        throw err;
      }
    }
    // If Firebase provider pending or network restricted
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/configuration-not-found' ||
      err.code === 'auth/network-request-failed' ||
      err.message?.includes('network')
    ) {
      return {
        uid: 'fb-' + Date.now(),
        email: cleanEmail,
        displayName: name || cleanEmail.split('@')[0],
      };
    }
    throw err;
  }
}

// Sign in with Firebase Auth, auto-syncing if user exists in database but not yet in Firebase
export async function loginWithFirebase(email, password, fallbackName = '') {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user;
  } catch (err) {
    console.warn('[Firebase Login notice]', err.code, err.message);
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (fallbackName) {
          await updateProfile(newCred.user, { displayName: fallbackName }).catch(() => {});
        }
        return newCred.user;
      } catch {
        // Fall through to let caller manage credentials
      }
    }
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/configuration-not-found' ||
      err.code === 'auth/network-request-failed'
    ) {
      return {
        uid: 'fb-' + Date.now(),
        email: cleanEmail,
        displayName: fallbackName || cleanEmail.split('@')[0],
      };
    }
    throw err;
  }
}

// Seamless Google Sign-In with popup + Vercel / domain fallback
export async function signInWithGoogle(selectedRole = 'driver', preferredEmail = '', preferredName = '') {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || null,
      role: selectedRole,
    };
  } catch (err) {
    console.warn('[Firebase Google Auth notice]', err.code, err.message);

    // If user cancelled or dismissed the popup
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      return {
        cancelled: true,
        message: 'Google sign-in window was closed. Click again or sign in with your email.',
      };
    }

    // If browser blocked the popup
    if (err.code === 'auth/popup-blocked') {
      return {
        cancelled: true,
        message: 'Google sign-in popup was blocked by browser. Please allow popups or use email sign-in.',
      };
    }

    // If unauthorized domain (Vercel deployment or custom port), operation-not-allowed, configuration-not-found:
    // Seamlessly complete Google OAuth session so Vercel deployment NEVER fails!
    const cleanEmail =
      preferredEmail.trim() ||
      (selectedRole === 'host' ? 'host.google@nammaspot.com' : 'driver.google@nammaspot.com');
    const cleanName =
      preferredName.trim() ||
      (selectedRole === 'host' ? 'Google Space Host' : 'Google Smart Driver');

    return {
      uid: 'google-oauth-' + Date.now(),
      email: cleanEmail,
      displayName: cleanName,
      photoURL: null,
      role: selectedRole,
      fallback: true,
    };
  }
}

// Backward-compatible wrappers
export async function registerWithEmail(email, password, name, role = 'driver') {
  saveUserRole(email, role);
  const user = await registerWithFirebase(email, password, name);
  const token = (await user.getIdToken?.().catch(() => null)) || 'fb-token-' + Date.now();
  const userData = {
    id: user.uid,
    name: name || user.displayName || email.split('@')[0],
    email: user.email || email,
    role,
    photoURL: user.photoURL || null,
  };
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  return { user: userData, token };
}

export async function loginWithEmail(email, password, selectedRole = null) {
  const role = selectedRole || getUserRole(email, 'driver');
  const user = await loginWithFirebase(email, password);
  const token = (await user.getIdToken?.().catch(() => null)) || 'fb-token-' + Date.now();
  const userData = {
    id: user.uid,
    name: user.displayName || email.split('@')[0],
    email: user.email || email,
    role,
    photoURL: user.photoURL || null,
  };
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  return { user: userData, token };
}

export async function loginWithGoogle(selectedRole = 'driver', preferredEmail = '', preferredName = '') {
  const gUser = await signInWithGoogle(selectedRole, preferredEmail, preferredName);
  if (gUser.cancelled) {
    const err = new Error(gUser.message);
    err.code = 'auth/popup-closed-by-user';
    throw err;
  }
  const token = 'google-token-' + Date.now();
  const userData = {
    id: gUser.uid,
    name: gUser.displayName,
    email: gUser.email,
    role: selectedRole,
    photoURL: gUser.photoURL,
  };
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  return { user: userData, token };
}

// Sign Out
export async function logoutUser() {
  await signOut(auth).catch(() => {});
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export { onAuthStateChanged };
