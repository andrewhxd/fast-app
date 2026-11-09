// Tests for firestore.rules, against the Firestore emulator: `npm run test:rules`.
// Each test starts from an empty database with one group ("sam", owned by Ann) and checks what each
// person can and can't do. Jeff joined before access levels, so he can record and edit stories; Ivy is
// an administrator, Cleo a clinician and Pat can only play.

import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Bytes, Timestamp, collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const ANN = { uid: 'ann', email: 'ann@example.com', email_verified: true }; // owner of "sam"
const JEFF = { uid: 'jeff', email: 'jeff@example.com', email_verified: true }; // member of "sam"
const MIA = { uid: 'mia', email: 'Mia@Example.com', email_verified: true }; // not a member
const DAVE = { uid: 'dave', email: 'dave@example.com', email_verified: false }; // unconfirmed email
const IVY = { uid: 'ivy', email: 'ivy@example.com', email_verified: true }; // administrator of "sam"
const CLEO = { uid: 'cleo', email: 'cleo@example.com', email_verified: true }; // clinician of "sam"
const PAT = { uid: 'pat', email: 'pat@example.com', email_verified: true }; // can only play, in "sam"

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

// A member document; fields set to undefined are left out.
function member(person, extra = {}) {
  const fields = { uid: person.uid, name: person.uid, email: person.email.toLowerCase(), joinedAt: serverTimestamp(), ...extra };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'groups/sam'), { id: 'sam', name: 'Sam Smith', ownerId: 'ann', createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, 'groups/sam/members/ann'), { uid: 'ann', name: 'Ann', email: 'ann@example.com', joinedAt: new Date() });
    await setDoc(doc(db, 'groups/sam/members/jeff'), { uid: 'jeff', name: 'Jeff', email: 'jeff@example.com', joinedAt: new Date() });
    for (const [person, access] of [[IVY, 'administrator'], [CLEO, 'clinician'], [PAT, 'player']]) {
      await setDoc(doc(db, `groups/sam/members/${person.uid}`), { uid: person.uid, name: person.uid, email: person.email, joinedAt: new Date(), access });
    }
    await setDoc(doc(db, 'groups/sam/invites/inv1'), {
      email: 'mia@example.com', groupName: 'Sam Smith', invitedBy: 'ann', invitedByName: 'Ann', access: 'player', createdAt: new Date(),
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
    batch.set(doc(db, `groups/${id}/members/${person.uid}`), member(person, { access }));
    return batch.commit();
  }
  let access = 'administrator';

  test('anyone signed in can start a group, as its owner', () => assertSucceeds(start(as(MIA), MIA, 'rosa')));
  test('the owner is an administrator', async () => {
    access = 'player';
    await assertFails(start(as(MIA), MIA, 'rosa'));
    access = undefined; // an older version of the app, which leaves the level out
    await assertSucceeds(start(as(MIA), MIA, 'rosa'));
    access = 'administrator';
  });
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
    email: 'rosa@example.com', groupName: 'Sam Smith', invitedBy: 'ann', invitedByName: 'Ann', access: 'stories', createdAt: serverTimestamp(), ...fields,
  });

  test('the owner invites', () => assertSucceeds(setDoc(doc(as(ANN), 'groups/sam/invites/new'), invite())));
  test('members cannot', () => assertFails(setDoc(doc(as(JEFF), 'groups/sam/invites/new'), invite({ invitedBy: 'jeff' }))));
  test('administrators invite, list and cancel invites', async () => {
    await assertSucceeds(setDoc(doc(as(IVY), 'groups/sam/invites/new'), invite({ invitedBy: 'ivy', access: 'administrator' })));
    await assertSucceeds(getDocs(collection(as(IVY), 'groups/sam/invites')));
    await assertSucceeds(deleteDoc(doc(as(IVY), 'groups/sam/invites/inv1')));
  });
  test('clinicians and players cannot', async () => {
    await assertFails(setDoc(doc(as(CLEO), 'groups/sam/invites/new'), invite({ invitedBy: 'cleo' })));
    await assertFails(setDoc(doc(as(PAT), 'groups/sam/invites/new'), invite({ invitedBy: 'pat' })));
    await assertFails(getDocs(collection(as(CLEO), 'groups/sam/invites')));
  });
  test('an invite gives one of the 4 access levels', () =>
    assertFails(setDoc(doc(as(ANN), 'groups/sam/invites/new'), invite({ access: 'owner' }))));
  test('one without a level, from an older version of the app, gives Record and edit stories', () => {
    const { access, ...withoutAccess } = invite();
    return assertSucceeds(setDoc(doc(as(ANN), 'groups/sam/invites/new'), withoutAccess));
  });
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
    batch.set(doc(db, `groups/sam/members/${person.uid}`), member(person, { invite: inviteId, access }));
    if (useUp) batch.delete(doc(db, `groups/sam/invites/${inviteId}`));
    return batch.commit();
  }
  let access = 'player'; // inv1's level

  test("they join with the invite's access level, not another", async () => {
    access = 'administrator';
    await assertFails(join(as(MIA), MIA, 'inv1'));
    access = undefined; // leaving it out would mean Record and edit stories
    await assertFails(join(as(MIA), MIA, 'inv1'));
    access = 'player';
  });

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
    batch.set(doc(db, 'groups/sam/members/mia'), { ...member(MIA, { invite: 'inv1', access: 'player' }), email: 'ann@example.com' });
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
  test('an administrator removes a member', () => assertSucceeds(deleteDoc(doc(as(IVY), 'groups/sam/members/jeff'))));
  test('but not the owner', () => assertFails(deleteDoc(doc(as(IVY), 'groups/sam/members/ann'))));
  test('members who are not administrators cannot remove others', () =>
    assertFails(deleteDoc(doc(as(CLEO), 'groups/sam/members/jeff'))));
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
  test('a member saves new, custom and older relationships', async () => {
    for (const [index, relationship] of ['Sibling', 'Partner', 'Spouse', 'Child', 'Family friend', 'Brother', 'Sister'].entries()) {
      await assertSucceeds(saveStory(as(JEFF), `relationship${index}`, 100, { relationship }));
    }
  });
  test('a relationship must contain text and be at most 100 characters', async () => {
    for (const relationship of ['', '   ', 'x'.repeat(101), 42]) {
      await assertFails(saveStory(as(JEFF), 'invalid-relationship', 100, { relationship }));
    }
    await assertSucceeds(saveStory(as(JEFF), 'long-relationship', 100, { relationship: 'x'.repeat(100) }));
  });
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

});

describe('deleting and restoring stories', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const softDelete = (person, fields = {}) =>
    updateDoc(doc(as(person), 'treatments/demo/stories/s1'), { deletedAt: serverTimestamp(), deletedBy: person.uid, ...fields });
  // A story deleted `days` ago, written directly (the rules only accept the current time).
  const deletedDaysAgo = (days) => env.withSecurityRulesDisabled((context) =>
    updateDoc(doc(context.firestore(), 'treatments/demo/stories/s1'), {
      deletedAt: Timestamp.fromMillis(Date.now() - days * DAY), deletedBy: 'jeff',
    }));
  const restore = (person, setNumber = 1) => updateDoc(doc(as(person), 'treatments/demo/stories/s1'), {
    deletedAt: deleteField(), deletedBy: deleteField(), replacedBy: deleteField(), setNumber,
  });
  function removeForGood(db) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'treatments/demo/stories/s1/chunks/0'));
    batch.delete(doc(db, 'treatments/demo/stories/s1'));
    return batch.commit();
  }

  test('a member deletes a story (it is only marked)', async () => {
    await assertSucceeds(softDelete(JEFF));
    await assertSucceeds(getDoc(doc(as(JEFF), 'treatments/demo/stories/s1/chunks/0')));
  });
  test('others cannot', () => assertFails(softDelete(MIA)));
  test('not in the name of someone else', () => assertFails(softDelete(JEFF, { deletedBy: 'ann' })));
  test('not with a made-up time', () => assertFails(softDelete(JEFF, { deletedAt: Timestamp.fromMillis(0) })));
  test('not while changing anything else', () => assertFails(softDelete(JEFF, { title: 'Renamed' })));
  test('not twice', async () => {
    await deletedDaysAgo(1);
    await assertFails(softDelete(JEFF));
  });
  test('a deleted story cannot move', async () => {
    await deletedDaysAgo(1);
    await assertFails(updateDoc(doc(as(JEFF), 'treatments/demo/stories/s1'), { setNumber: 2 }));
  });

  test('a member restores a deleted story, to either set', async () => {
    await deletedDaysAgo(29);
    await assertSucceeds(restore(ANN, 2));
  });
  test('others cannot restore it', async () => {
    await deletedDaysAgo(1);
    await assertFails(restore(MIA));
  });
  test('a restore removes every delete field', async () => {
    await deletedDaysAgo(1);
    await assertFails(updateDoc(doc(as(JEFF), 'treatments/demo/stories/s1'), { deletedAt: deleteField(), setNumber: 1 }));
  });
  test('restoring changes nothing else', async () => {
    await deletedDaysAgo(1);
    await assertFails(updateDoc(doc(as(JEFF), 'treatments/demo/stories/s1'), {
      deletedAt: deleteField(), deletedBy: deleteField(), affect: 'challenging',
    }));
  });

  test('nobody removes a story for good before 30 days', async () => {
    await deletedDaysAgo(29);
    await assertFails(removeForGood(as(ANN)));
  });
  test('nor one that was never deleted', () => assertFails(removeForGood(as(ANN))));
  test('a member removes it for good after 30 days, with its audio', async () => {
    await deletedDaysAgo(31);
    await assertSucceeds(removeForGood(as(JEFF)));
  });
  test('others cannot', async () => {
    await deletedDaysAgo(31);
    await assertFails(removeForGood(as(MIA)));
  });
  test('its audio cannot be removed on its own', async () => {
    await deletedDaysAgo(31);
    await assertFails(deleteDoc(doc(as(JEFF), 'treatments/demo/stories/s1/chunks/0')));
  });

  // Saving an edit: the edited story is new, and the earlier version is deleted in the same batch.
  function saveEdit(db, person, replacedBy = 's2') {
    const batch = writeBatch(db);
    batch.set(doc(db, 'treatments/demo/stories/s2'), story());
    batch.set(doc(db, 'treatments/demo/stories/s2/chunks/0'), { data: Bytes.fromUint8Array(new Uint8Array(10)) });
    batch.update(doc(db, 'treatments/demo/stories/s1'), { deletedAt: serverTimestamp(), deletedBy: person.uid, replacedBy });
    return batch.commit();
  }
  test('saving an edit keeps the earlier version, deleted', () => { const db = as(JEFF); return assertSucceeds(saveEdit(db, JEFF)); });
  test('replacedBy must be the story saved in the same batch', () => { const db = as(JEFF); return assertFails(saveEdit(db, JEFF, 'nope')); });
  test('replacedBy cannot name an existing story', async () => {
    await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), 'treatments/demo/stories/s3'), story({ createdAt: new Date() })));
    await assertFails(softDelete(JEFF, { replacedBy: 's3' }));
  });
});

describe('hearing aid', () => {
  const answer = (person, fields) => updateDoc(doc(as(person), 'groups/sam'), fields);

  test('a member who plays answers it', () => assertSucceeds(answer(PAT, { hearingAid: true })));
  test('others cannot', () => assertFails(answer(MIA, { hearingAid: true })));
  test('not someone who only records', () => assertFails(answer(JEFF, { hearingAid: true })));
  test('it must be yes or no', () => assertFails(answer(PAT, { hearingAid: 'yes' })));
  test('nothing else changes with it', () => assertFails(answer(PAT, { hearingAid: false, name: 'Sam' })));
  test('once answered, it cannot change', async () => {
    await assertSucceeds(answer(PAT, { hearingAid: false }));
    await assertFails(answer(ANN, { hearingAid: true }));
  });
});

describe('playing sessions', () => {
  const session = (fields = {}) => ({
    playedBy: 'pat', affect: 'happy', setNumber: 2, day: '2026-11-09', startedAt: serverTimestamp(),
    prepared: ['soundCheck', 'told', 'earbuds', 'quiet', 'outOfView'], awake: ['eyesOpen', 'turnsToSound'], ...fields,
  });
  const save = (person, fields) => setDoc(doc(as(person), 'groups/sam/sessions/new'), session(fields));
  const saved = () => env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), 'groups/sam/sessions/old'), session({ startedAt: new Date() })));

  test('a member who plays saves one they played', () => assertSucceeds(save(PAT)));
  test('with the hearing aid checked, for a patient who uses one', () =>
    assertSucceeds(save(PAT, { prepared: ['hearingAid', 'soundCheck', 'told', 'earbuds', 'quiet', 'outOfView'] })));
  test('with no signs of being awake', () => assertSucceeds(save(PAT, { awake: [] })));
  test('others cannot', () => assertFails(save(MIA, { playedBy: 'mia' })));
  test('the owner, administrators and clinicians play too', async () => {
    await assertSucceeds(setDoc(doc(as(ANN), 'groups/sam/sessions/a'), session({ playedBy: 'ann' })));
    await assertSucceeds(setDoc(doc(as(IVY), 'groups/sam/sessions/b'), session({ playedBy: 'ivy' })));
    await assertSucceeds(setDoc(doc(as(CLEO), 'groups/sam/sessions/c'), session({ playedBy: 'cleo' })));
  });
  test('not someone who only records', () => assertFails(save(JEFF, { playedBy: 'jeff' })));
  test('not for someone else', () => assertFails(save(PAT, { playedBy: 'ann' })));
  test('every checklist item must be ticked', () =>
    assertFails(save(PAT, { prepared: ['soundCheck', 'told', 'earbuds', 'quiet'] })));
  test('no unknown checklist items', () =>
    assertFails(save(PAT, { prepared: ['soundCheck', 'told', 'earbuds', 'quiet', 'outOfView', 'other'] })));
  test('no unknown signs of being awake', () => assertFails(save(PAT, { awake: ['eyesOpen', 'smiles'] })));
  test('the day must be a date', () => assertFails(save(PAT, { day: 'today' })));
  test('it starts now', () => assertFails(save(PAT, { startedAt: new Date('2026-01-01') })));
  test('the set must be one of the 4', async () => {
    await assertFails(save(PAT, { affect: 'calm' }));
    await assertFails(save(PAT, { setNumber: 3 }));
  });
  test('no other fields', () => assertFails(save(PAT, { note: 'hi' })));
  test("members read a day's sessions", async () => {
    await saved();
    await assertSucceeds(getDocs(query(collection(as(ANN), 'groups/sam/sessions'), where('day', '==', '2026-11-09'))));
  });
  test('others cannot', async () => {
    await saved();
    await assertFails(getDocs(query(collection(as(MIA), 'groups/sam/sessions'), where('day', '==', '2026-11-09'))));
  });
  test('nothing else about a session changes, and nobody deletes one', async () => {
    await saved();
    await assertFails(updateDoc(doc(as(PAT), 'groups/sam/sessions/old'), { awake: [] }));
    await assertFails(updateDoc(doc(as(PAT), 'groups/sam/sessions/old'), { endedAt: serverTimestamp(), awake: [] }));
    await assertFails(deleteDoc(doc(as(PAT), 'groups/sam/sessions/old')));
  });
  test('the player marks it played to the end, once', async () => {
    await saved();
    await assertSucceeds(updateDoc(doc(as(PAT), 'groups/sam/sessions/old'), { endedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(PAT), 'groups/sam/sessions/old'), { endedAt: serverTimestamp() }));
  });
  test('only the player marks it ended', async () => {
    await saved();
    await assertFails(updateDoc(doc(as(ANN), 'groups/sam/sessions/old'), { endedAt: serverTimestamp() }));
  });
  test('it ends now', async () => {
    await saved();
    await assertFails(updateDoc(doc(as(PAT), 'groups/sam/sessions/old'), { endedAt: new Date('2026-01-01') }));
  });
  test('a new session has not ended yet', () => assertFails(save(PAT, { endedAt: serverTimestamp() })));
});

describe('access levels', () => {
  const setAccess = (person, uid, access, extra = {}) => updateDoc(doc(as(person), `groups/sam/members/${uid}`), { access, ...extra });

  test("the owner changes someone's access", () => assertSucceeds(setAccess(ANN, 'jeff', 'player')));
  test("an administrator changes someone's access", () => assertSucceeds(setAccess(IVY, 'pat', 'clinician')));
  test('an administrator can make someone else an administrator', () => assertSucceeds(setAccess(IVY, 'jeff', 'administrator')));
  test('nobody changes their own access', async () => {
    await assertFails(setAccess(IVY, 'ivy', 'clinician'));
    await assertFails(setAccess(PAT, 'pat', 'administrator'));
  });
  test("nobody changes the owner's", () => assertFails(setAccess(IVY, 'ann', 'player')));
  test('members who are not administrators cannot change anyone', async () => {
    await assertFails(setAccess(CLEO, 'pat', 'administrator'));
    await assertFails(setAccess(JEFF, 'pat', 'stories'));
  });
  test('only to one of the 4 levels', () => assertFails(setAccess(ANN, 'jeff', 'owner')));
  test('nothing else changes with it', () => assertFails(setAccess(ANN, 'jeff', 'player', { name: 'Jeffrey' })));

  test('players listen to the stories', async () => {
    await assertSucceeds(getDocs(query(collection(as(PAT), 'treatments/demo/stories'), where('group', '==', 'sam'))));
    await assertSucceeds(getDoc(doc(as(PAT), 'treatments/demo/stories/s1/chunks/0')));
  });
  test('but cannot record, move or delete them', async () => {
    await assertFails(saveStory(as(PAT), 's2', 100));
    await assertFails(updateDoc(doc(as(PAT), 'treatments/demo/stories/s1'), { setNumber: 2 }));
    await assertFails(updateDoc(doc(as(PAT), 'treatments/demo/stories/s1'), { deletedAt: serverTimestamp(), deletedBy: 'pat' }));
  });
  test('clinicians and administrators record', async () => {
    await assertSucceeds(saveStory(as(CLEO), 's2', 100));
    await assertSucceeds(saveStory(as(IVY), 's3', 100));
  });
  test('a change of access applies straight away', async () => {
    await assertSucceeds(setAccess(ANN, 'jeff', 'player'));
    await assertFails(saveStory(as(JEFF), 's2', 100));
  });
});
