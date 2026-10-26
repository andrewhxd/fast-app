import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore/lite';
import { displayName } from './auth.js';
import { db } from './firebase.js';

// A group is one patient's care team (the interface says "care team"; the project doc says "treatment"):
//
//   groups/{groupId}                   id, name (the patient's name), ownerId, createdAt, updatedAt
//   groups/{groupId}/members/{uid}     uid, name, email, joinedAt, and invite (the invite they accepted)
//   groups/{groupId}/invites/{id}      email, groupName, invitedBy, invitedByName, createdAt
//
// The owner is the lead caregiver: they start the group, invite people and remove them.
// Every other member can record, listen to, edit and move the group's stories.
// An invite is a link for one email address; only someone signed in with that address can use it.

// Group IDs appear in URLs and are Firestore document IDs.
export function isValidGroupId(groupId) {
  return typeof groupId === 'string'
    && groupId.length <= 1500
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(groupId);
}

// A new random group ID: 20 lowercase letters and digits (about 103 bits), so they can't be guessed.
function newGroupId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(20)), (n) => chars[n % chars.length]).join('');
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

const groupRef = (groupId) => doc(db, 'groups', groupId);
const membersRef = (groupId) => collection(db, 'groups', groupId, 'members');
const invitesRef = (groupId) => collection(db, 'groups', groupId, 'invites');

// The groups the signed-in person belongs to, by name.
export async function listMyGroups(uid) {
  const memberships = await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', uid)));
  const groupIds = memberships.docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'groups')
    .map((d) => d.ref.parent.parent.id);
  const groups = await Promise.all(groupIds.map((id) => getDoc(groupRef(id))));
  return groups
    .filter((d) => d.exists())
    .map((d) => ({ id: d.id, name: d.data().name, ownerId: d.data().ownerId }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Start a group with the signed-in person as its owner and first member, in one batch.
// Returns the new group's ID.
export async function createGroup(user, patientName) {
  const id = newGroupId();
  const batch = writeBatch(db);
  batch.set(groupRef(id), {
    id,
    name: patientName.trim(),
    ownerId: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(membersRef(id), user.uid), memberFor(user));
  await batch.commit();
  return id;
}

function memberFor(user) {
  return { uid: user.uid, name: displayName(user), email: normalizeEmail(user.email), joinedAt: serverTimestamp() };
}

// Everyone in the group: the owner first, then by name.
export async function listMembers(group) {
  const snapshot = await getDocs(membersRef(group.id));
  return snapshot.docs
    .map((d) => d.data())
    .sort((a, b) => (b.uid === group.ownerId) - (a.uid === group.ownerId) || a.name.localeCompare(b.name));
}

// Invites nobody has accepted yet, oldest first. Only the owner can read them.
export async function listInvites(groupId) {
  const snapshot = await getDocs(invitesRef(groupId));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

// Invite an email address to the group. Returns the invite's ID, which is the secret part of its link.
export async function createInvite(group, user, email) {
  const inviteRef = doc(invitesRef(group.id));
  await setDoc(inviteRef, {
    email: normalizeEmail(email),
    groupName: group.name,
    invitedBy: user.uid,
    invitedByName: displayName(user),
    createdAt: serverTimestamp(),
  });
  return inviteRef.id;
}

export function cancelInvite(groupId, inviteId) {
  return deleteDoc(doc(invitesRef(groupId), inviteId));
}

export function inviteLink(groupId, inviteId) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('group', groupId);
  url.searchParams.set('invite', inviteId);
  return url.href;
}

// An invite, if it's still there and it's for the signed-in person's email address; otherwise null.
// The rules don't let anyone else read it, so "not for you" and "canceled" look the same.
export async function getInvite(groupId, inviteId) {
  try {
    const snapshot = await getDoc(doc(invitesRef(groupId), inviteId));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (err) {
    if (err.code === 'permission-denied') return null;
    throw err;
  }
}

// Join the group: become a member and use up the invite, in one batch.
export async function acceptInvite(groupId, inviteId, user) {
  const batch = writeBatch(db);
  batch.set(doc(membersRef(groupId), user.uid), { ...memberFor(user), invite: inviteId });
  batch.delete(doc(invitesRef(groupId), inviteId));
  await batch.commit();
}

// The owner removes someone, or a member leaves.
export function removeMember(groupId, uid) {
  return deleteDoc(doc(membersRef(groupId), uid));
}
