import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore/lite';
import { DEFAULT_ACCESS } from './access.js';
import { displayName } from './auth.js';
import { db } from './firebase.js';

// A group is one patient's care team (the interface says "care team"; the project doc says "treatment"):
//
//   groups/{groupId}                   id, name (the patient's name), ownerId, createdAt, updatedAt,
//                                      and hearingAid once someone has answered it
//   groups/{groupId}/members/{uid}     uid, name, email, joinedAt, access, and invite (the invite they accepted)
//   groups/{groupId}/invites/{id}      email, groupName, invitedBy, invitedByName, access, createdAt
//   groups/{groupId}/sessions/{id}     each time a set was played (see sessions.js)
//
// The owner is the lead caregiver: they start the group, and invite, remove and set the access of
// everyone else. Each member has an access level (see access.js); administrators manage people too.
// An invite is a link for one email address and one access level; only someone signed in with that
// address can use it, and they join with that level.

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

// The groups the signed-in person belongs to, by name, each with their `access` in it: 'lead' for
// the lead caregiver, otherwise their access level.
export async function listMyGroups(uid) {
  const memberships = (await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', uid)))).docs
    .filter((d) => d.ref.parent.parent?.parent.id === 'groups');
  const groups = await Promise.all(memberships.map((m) => getDoc(m.ref.parent.parent)));
  return groups
    .map((d, i) => d.exists() && {
      id: d.id,
      name: d.data().name,
      ownerId: d.data().ownerId,
      hearingAid: d.data().hearingAid,
      access: d.data().ownerId === uid ? 'lead' : memberships[i].data().access ?? DEFAULT_ACCESS,
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Whether the patient uses a hearing aid (or another hearing accommodation), asked the first time
// someone plays a set. It's answered once per care team; the eligibility survey will ask it later.
export function setHearingAid(groupId, hearingAid) {
  return updateDoc(groupRef(groupId), { hearingAid });
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
  batch.set(doc(membersRef(id), user.uid), memberFor(user, 'administrator'));
  await batch.commit();
  return id;
}

function memberFor(user, access) {
  return { uid: user.uid, name: displayName(user), email: normalizeEmail(user.email), joinedAt: serverTimestamp(), access };
}

// Everyone in the group: the owner first, then by name, each with their access level.
export async function listMembers(group) {
  const snapshot = await getDocs(membersRef(group.id));
  return snapshot.docs
    .map((d) => ({ ...d.data(), access: d.data().access ?? DEFAULT_ACCESS }))
    .sort((a, b) => (b.uid === group.ownerId) - (a.uid === group.ownerId) || a.name.localeCompare(b.name));
}

// Invites nobody has accepted yet, oldest first. Only the owner and administrators can read them.
export async function listInvites(groupId) {
  const snapshot = await getDocs(invitesRef(groupId));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data(), access: d.data().access ?? DEFAULT_ACCESS }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

// Invite an email address to the group with an access level. Returns the invite's ID, which is the
// secret part of its link.
export async function createInvite(group, user, email, access) {
  const inviteRef = doc(invitesRef(group.id));
  await setDoc(inviteRef, {
    email: normalizeEmail(email),
    groupName: group.name,
    invitedBy: user.uid,
    invitedByName: displayName(user),
    access,
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
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data(), access: snapshot.data().access ?? DEFAULT_ACCESS } : null;
  } catch (err) {
    if (err.code === 'permission-denied') return null;
    throw err;
  }
}

// Join the group with the invite's access level: become a member and use up the invite, in one batch.
export async function acceptInvite(invite, groupId, user) {
  const batch = writeBatch(db);
  batch.set(doc(membersRef(groupId), user.uid), { ...memberFor(user, invite.access), invite: invite.id });
  batch.delete(doc(invitesRef(groupId), invite.id));
  await batch.commit();
}

// Change someone's access level. Only the owner and administrators can, and not their own or the owner's.
export function setMemberAccess(groupId, uid, access) {
  return updateDoc(doc(membersRef(groupId), uid), { access });
}

// The owner or an administrator removes someone, or a member leaves.
export function removeMember(groupId, uid) {
  return deleteDoc(doc(membersRef(groupId), uid));
}
