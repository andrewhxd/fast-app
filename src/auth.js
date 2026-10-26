import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onIdTokenChanged, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase.js';

// Sign-in goes through Firebase Authentication: Google accounts, or an email address and a password.
// Firebase keeps the account and the password; the app only sees the person's uid, name and email.

// The signed-in person: undefined while Firebase checks, then null (signed out) or a Firebase User.
// The state is a new object on every change, so a refreshed token (for example after the email
// address is confirmed) re-renders even though Firebase keeps the same User object.
export function useUser() {
  const [state, setState] = useState({ user: auth.currentUser ?? undefined });
  useEffect(() => onIdTokenChanged(auth, (user) => setState({ user })), []);
  return state.user;
}

// A popup works in every browser, phones included, as long as it opens straight from a tap.
// The redirect flow would need the app's own domain as authDomain to work in Safari and Chrome.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export async function signInWithEmail(email, password) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

// A new account with an email address and a password. Firebase emails a link to confirm the address,
// which is needed before joining a care team, since invites are tied to an email address.
export async function createAccount(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(user, { displayName: name.trim() });
  await sendEmailVerification(user);
  await user.getIdToken(true); // re-renders with the name
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim());
}

export function sendVerificationEmail() {
  return sendEmailVerification(auth.currentUser);
}

// After the person follows the link in the email: fetch the account again, and a new token,
// so both the app and the security rules see the confirmed address.
export async function checkEmailVerified() {
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser.emailVerified;
}

export function signOut() {
  return firebaseSignOut(auth);
}

// The name to show for a person: their own name, or the start of their email address.
export function displayName(user) {
  return user.displayName?.trim() || user.email.split('@')[0];
}

// What went wrong, in words a family member can act on. Null when there's nothing to say,
// for example when the person closed the Google window themselves.
export function authErrorMessage(err) {
  switch (err.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match. Try again, or reset your password.";
    case 'auth/email-already-in-use':
      return 'There is already an account with this email address. Sign in instead.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Check the email address and try again.';
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return "The app can't reach the internet. Check the connection and try again.";
    default:
      return `Something went wrong (${err.code ?? err.message}). Please try again.`;
  }
}
