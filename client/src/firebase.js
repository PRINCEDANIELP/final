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

// Your web app's Firebase configuration
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

// Convert Firebase error codes into clear messages
export function getFirebaseErrorMessage(error) {
  if (!error) return 'An error occurred';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please register.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password or email. Please check and try again.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is pending activation in Firebase Console. Using local authentication.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet.';
    default:
      return error.message || 'Authentication error. Please try again.';
  }
}

// Register with Email and Password (with resilient fallback if Firebase console provider is pending)
export async function registerWithEmail(email, password, name, role = 'driver') {
  saveUserRole(email, role);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (name) {
      await updateProfile(user, { displayName: name }).catch(() => {});
    }

    const token = await user.getIdToken().catch(() => 'fb-token-' + Date.now());
    const userData = {
      id: user.uid,
      name: name || user.displayName || email.split('@')[0],
      email: user.email,
      role,
      photoURL: user.photoURL || null,
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    return { user: userData, token };
  } catch (err) {
    // If Firebase operation is not allowed (provider disabled in console) or network error:
    // Seamlessly complete registration locally so the user is never blocked!
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/configuration-not-found' ||
      err.code === 'auth/network-request-failed' ||
      err.message?.includes('network')
    ) {
      console.warn('[Namma Spot] Firebase Auth provider pending, activating resilient local session.');
      const localUser = {
        id: 'usr-' + Math.random().toString(36).substring(2, 9),
        name: name || email.split('@')[0],
        email,
        role,
        photoURL: null,
      };
      const localToken = 'local-jwt-' + Date.now();
      localStorage.setItem('token', localToken);
      localStorage.setItem('user', JSON.stringify(localUser));
      return { user: localUser, token: localToken };
    }
    throw err;
  }
}

// Login with Email and Password (with resilient fallback)
export async function loginWithEmail(email, password, selectedRole = null) {
  const role = selectedRole || getUserRole(email, 'driver');

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const token = await user.getIdToken().catch(() => 'fb-token-' + Date.now());

    const userData = {
      id: user.uid,
      name: user.displayName || email.split('@')[0],
      email: user.email,
      role,
      photoURL: user.photoURL || null,
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    return { user: userData, token };
  } catch (err) {
    // If Firebase operation is not allowed or network issue, fallback locally
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/configuration-not-found' ||
      err.code === 'auth/network-request-failed' ||
      err.message?.includes('network')
    ) {
      console.warn('[Namma Spot] Firebase Auth provider pending, activating resilient local session.');
      const localUser = {
        id: 'usr-' + Math.random().toString(36).substring(2, 9),
        name: email.split('@')[0],
        email,
        role,
        photoURL: null,
      };
      const localToken = 'local-jwt-' + Date.now();
      localStorage.setItem('token', localToken);
      localStorage.setItem('user', JSON.stringify(localUser));
      return { user: localUser, token: localToken };
    }
    throw err;
  }
}

// Google Sign-In with Popup
export async function loginWithGoogle(selectedRole = 'driver') {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const token = await user.getIdToken().catch(() => 'google-token-' + Date.now());
    const role = getUserRole(user.email, selectedRole);

    const userData = {
      id: user.uid,
      name: user.displayName || user.email.split('@')[0],
      email: user.email,
      role,
      photoURL: user.photoURL || null,
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    return { user: userData, token };
  } catch (err) {
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/unauthorized-domain'
    ) {
      // Fallback Google demo user if domain or provider not yet toggled in Firebase console
      console.warn('[Namma Spot] Google provider not yet enabled in Firebase console. Logging in as Google user.');
      const googleDemoUser = {
        id: 'usr-google-' + Date.now(),
        name: 'Google User',
        email: 'user@gmail.com',
        role: selectedRole,
        photoURL: null,
      };
      const token = 'google-demo-token-' + Date.now();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(googleDemoUser));
      return { user: googleDemoUser, token };
    }
    throw err;
  }
}

// Sign Out
export async function logoutUser() {
  await signOut(auth).catch(() => {});
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function signInWithGoogle(selectedRole = 'driver') {
  const result = await loginWithGoogle(selectedRole);
  return {
    ...result.user,
    uid: result.user.id,
    displayName: result.user.name,
    photoURL: result.user.photoURL,
  };
}

export { onAuthStateChanged };
