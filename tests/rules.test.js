// Tests for firestore.rules, against the Firestore emulator: `npm run test:rules`.
// Each test starts from an empty database with one group ("sam", owned by Ann, with Jeff as a member)
// and checks what each person can and can't do.

import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Bytes, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from 'firebase/firestore';

const ANN = { uid: 'ann', email: 'ann@example.com', email_verified: true }; // owner of "sam"
const JEFF = { uid: 'jeff', email: 'jeff@example.com', email_verified: true }; // member of "sam"
const MIA = { uid: 'mia', email: 'Mia@Example.com', email_verified: true }; // not a member
const DAVE = { uid: 'dave', email: 'dave@example.com', email_verified: false }; // unconfirmed email

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fast-app',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(() => env.cleanup());

const as = ({ uid, ...token }) => env.authenticatedContext(uid, token).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

function member(person, extra = {}) {
  return { uid: person.uid, name: person.uid, email: person.email.toLowerCase(), joinedAt: serverTimestamp(), ...extra };
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'groups/sam'), { id: 'sam', name: 'Sam Smith', ownerId: 'ann', createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, 'groups/sam/members/ann'), { uid: 'ann', name: 'Ann', email: 'ann@example.com', joinedAt: new Date() });
    await setDoc(doc(db, 'groups/sam/members/jeff'), { uid: 'jeff', name: 'Jeff', email: 'jeff@example.com', joinedAt: new Date() });
    await setDoc(doc(db, 'groups/sam/invites/inv1'), {
      email: 'mia@example.com', groupName: 'Sam Smith', invitedBy: 'ann', invitedByName: 'Ann', createdAt: new Date(),
    });
    await setDoc(doc(db, 'groups/sam/invites/inv2'), {
      email: 'dave@example.com', groupName: 'Sam Smith', invitedBy: 'ann', invitedByName: 'Ann', createdAt: new Date(),
    });
    await setDoc(doc(db, 'treatments/demo/stories/s1'), story({ group: 'sam', createdAt: new Date() }));
    await setDoc(doc(db, 'treatments/demo/stories/s1/chunks/0'), { data: Bytes.fromUint8Array(new Uint8Array(10)) });
  });
});

function story(fields = {}) {
  return {
    title: 'Bike ride', storyteller: 'Jeff Smith', relationship: 'Brother', affect: 'happy', setNumber: 1,
    group: 'sam', nameDuration: 3000, storyDuration: 60000, type: 'audio/mp4', nameSize: 4, size: 10,
    chunkCount: 1, createdAt: serverTimestamp(), ...fields,
  };
}

// A story of `size` bytes with all of its chunks, in one batch, like the app saves it.
function saveStory(db, id, size, fields = {}) {
  const batch = writeBatch(db);
  const chunkCount = Math.ceil(size / 1_000_000);
  batch.set(doc(db, `treatments/demo/stories/${id}`), story({ size, chunkCount, ...fields }));
  for (let i = 0; i < chunkCount; i++) {
    const length = Math.min(1_000_000, size - i * 1_000_000);
    batch.set(doc(db, `treatments/demo/stories/${id}/chunks/${i}`), { data: Bytes.fromUint8Array(new Uint8Array(length)) });
  }
  return batch.commit();
}

describe('starting a group', () => {
  function start(db, person, id, fields = {}) {
    const batch = writeBatch(db);
    batch.set(doc(db, `groups/${id}`), {
      id, name: 'Rosa Diaz', ownerId: person.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...fields,
    });
    batch.set(doc(db, `groups/${id}/members/${person.uid}`), member(person));
    return batch.commit();
  }

  test('anyone signed in can start a group, as its owner', () => assertSucceeds(start(as(MIA), MIA, 'rosa')));
  test('not signed out', () => assertFails(start(anonymous(), MIA, 'rosa')));
  test('not for someone else', () => assertFails(start(as(MIA), MIA, 'rosa', { ownerId: 'ann' })));
  test('not without the owner joining', () => assertFails(setDoc(doc(as(MIA), 'groups/rosa'), {
    id: 'rosa', name: 'Rosa Diaz', ownerId: 'mia', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })));
  test('not over an existing group', () => assertFails(start(as(MIA), MIA, 'sam')));
  test('nobody can join an existing group without an invite', () =>
    assertFails(setDoc(doc(as(MIA), 'groups/sam/members/mia'), member(MIA))));
  test('nobody can add someone else', () =>
    assertFails(setDoc(doc(as(ANN), 'groups/sam/members/mia'), member(MIA))));
  test('a group never changes', () => assertFails(updateDoc(doc(as(ANN), 'groups/sam'), { name: 'Sam' })));
});

describe('reading groups and members', () => {
  test('members read their group', () => assertSucceeds(getDoc(doc(as(JEFF), 'groups/sam'))));
  test('others cannot', () => assertFails(getDoc(doc(as(MIA), 'groups/sam'))));
  test('members see each other', () => assertSucceeds(getDocs(collection(as(JEFF), 'groups/sam/members'))));
  test('others cannot list members', () => assertFails(getDocs(collection(as(MIA), 'groups/sam/members'))));
  test('everyone finds their own memberships', () =>
    assertSucceeds(getDocs(query(collectionGroup(as(JEFF), 'members'), where('uid', '==', 'jeff')))));
  test("nobody finds someone else's memberships", () =>
    assertFails(getDocs(query(collectionGroup(as(MIA), 'members'), where('uid', '==', 'jeff')))));
});

describe('invites', () => {
  const invite = (fields = {}) => ({
    email: 'rosa@example.com', groupName: 'Sam Smith', invitedBy: 'ann', invitedByName: 'Ann', createdAt: serverTimestamp(), ...fields,
  });

  test('the owner invites', () => assertSucceeds(setDoc(doc(as(ANN), 'groups/sam/invites/new'), invite())));
  test('members cannot', () => assertFails(setDoc(doc(as(JEFF), 'groups/sam/invites/new'), invite({ invitedBy: 'jeff' }))));
  test('the email address must be lowercase', () =>
    assertFails(setDoc(doc(as(ANN), 'groups/sam/invites/new'), invite({ email: 'Rosa@example.com' }))));
  test('the group name must match', () =>
    assertFails(setDoc(doc(as(ANN), 'groups/sam/invites/new'), invite({ groupName: 'Someone else' }))));
  test('the owner lists invites', () => assertSucceeds(getDocs(collection(as(ANN), 'groups/sam/invites'))));
  test('members cannot list invites', () => assertFails(getDocs(collection(as(JEFF), 'groups/sam/invites'))));
  test('the person invited reads it, whatever the case of their email', () =>
    assertSucceeds(getDoc(doc(as(MIA), 'groups/sam/invites/inv1'))));
  test('nobody else reads it', () => assertFails(getDoc(doc(as(JEFF), 'groups/sam/invites/inv1'))));
  test('the owner cancels it', () => assertSucceeds(deleteDoc(doc(as(ANN), 'groups/sam/invites/inv1'))));
  test('members cannot cancel it', () => assertFails(deleteDoc(doc(as(JEFF), 'groups/sam/invites/inv1'))));
});

describe('joining with an invite', () => {
  function join(db, person, inviteId, { useUp = true } = {}) {
    const batch = writeBatch(db);
    batch.set(doc(db, `groups/sam/members/${person.uid}`), member(person, { invite: inviteId }));
    if (useUp) batch.delete(doc(db, `groups/sam/invites/${inviteId}`));
    return batch.commit();
  }

  test('the person invited joins, using it up', async () => {
    await assertSucceeds(join(as(MIA), MIA, 'inv1'));
    await assertSucceeds(getDocs(query(collection(as(MIA), 'treatments/demo/stories'), where('group', '==', 'sam'))));
  });
  test('not without using it up', () => assertFails(join(as(MIA), MIA, 'inv1', { useUp: false })));
  test('not with an invite for someone else', () => assertFails(join(as(MIA), MIA, 'inv2')));
  test('not with an unconfirmed email address', () => assertFails(join(as(DAVE), DAVE, 'inv2')));
  test('not with an invite that does not exist', () => assertFails(join(as(MIA), MIA, 'nope')));
  test('not twice with the same invite', async () => {
    await assertSucceeds(join(as(MIA), MIA, 'inv1'));
    await assertSucceeds(deleteDoc(doc(as(MIA), 'groups/sam/members/mia')));
    await assertFails(join(as(MIA), MIA, 'inv1'));
  });
  test('not with a made-up email address in the member document', () => {
    const db = as(MIA);
    const batch = writeBatch(db);
    batch.set(doc(db, 'groups/sam/members/mia'), { ...member(MIA, { invite: 'inv1' }), email: 'ann@example.com' });
    batch.delete(doc(db, 'groups/sam/invites/inv1'));
    return assertFails(batch.commit());
  });
});

describe('removing and leaving', () => {
  test('the owner removes a member', () => assertSucceeds(deleteDoc(doc(as(ANN), 'groups/sam/members/jeff'))));
  test('a member leaves', () => assertSucceeds(deleteDoc(doc(as(JEFF), 'groups/sam/members/jeff'))));
  test('a member cannot remove the owner', () => assertFails(deleteDoc(doc(as(JEFF), 'groups/sam/members/ann'))));
  test('the owner cannot leave', () => assertFails(deleteDoc(doc(as(ANN), 'groups/sam/members/ann'))));
  test('outsiders cannot remove anyone', () => assertFails(deleteDoc(doc(as(MIA), 'groups/sam/members/jeff'))));
  test('a removed member loses access', async () => {
    await assertSucceeds(deleteDoc(doc(as(ANN), 'groups/sam/members/jeff')));
    await assertFails(getDoc(doc(as(JEFF), 'treatments/demo/stories/s1')));
  });
});

describe('stories', () => {
  const samStories = (db) => getDocs(query(collection(db, 'treatments/demo/stories'), where('group', '==', 'sam')));

  test("members list their group's stories", () => assertSucceeds(samStories(as(JEFF))));
  test('others cannot', () => assertFails(samStories(as(MIA))));
  test('signed out, nobody can', () => assertFails(samStories(anonymous())));
  test('nobody lists every story', () => assertFails(getDocs(collection(as(ANN), 'treatments/demo/stories'))));
  test('members play the audio', () => assertSucceeds(getDoc(doc(as(JEFF), 'treatments/demo/stories/s1/chunks/0'))));
  test('others cannot', () => assertFails(getDoc(doc(as(MIA), 'treatments/demo/stories/s1/chunks/0'))));

  test('a member saves a story with the most audio allowed (5 chunks)', () =>
    assertSucceeds(saveStory(as(JEFF), 's2', 5_000_000)));
  test('others cannot save into the group', () => assertFails(saveStory(as(MIA), 's2', 100)));
  test('nobody saves into a group they are not in', async () => {
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'groups/rosa'), { id: 'rosa', name: 'Rosa', ownerId: 'mia', createdAt: new Date(), updatedAt: new Date() }));
    await assertFails(saveStory(as(JEFF), 's2', 100, { group: 'rosa' }));
  });
  test('a member moves a story', () => assertSucceeds(updateDoc(doc(as(JEFF), 'treatments/demo/stories/s1'), { setNumber: 2 })));
  test('but not to another group', () =>
    assertFails(updateDoc(doc(as(ANN), 'treatments/demo/stories/s1'), { group: 'rosa' })));
  test('others cannot move it', () => assertFails(updateDoc(doc(as(MIA), 'treatments/demo/stories/s1'), { setNumber: 2 })));

  function remove(db) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'treatments/demo/stories/s1/chunks/0'));
    batch.delete(doc(db, 'treatments/demo/stories/s1'));
    return batch.commit();
  }
  test('a member deletes a story with its audio', () => assertSucceeds(remove(as(JEFF))));
  test('others cannot', () => assertFails(remove(as(MIA))));
});
