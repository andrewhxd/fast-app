import { addDoc, collection, serverTimestamp } from 'firebase/firestore/lite';
import { auth, db } from './firebase.js';
import { isValidGroupId } from './group.js';

// Saving each time a story set is played to the patient (a "session").
//
//   groups/{groupId}/sessions/{sessionId}
//     playedBy, affect, setNumber, day, startedAt   saved when playing starts (Patch 1)
//     before: { done: [...], awake: [...] }         ids from checklists.js (Patch 1)
//     endedAt                                       added when the set finishes (Patch 2)
//     after: { changes: { id: 'more' | 'same' | 'less' }, agitated: true/false }   (Patch 2)
//
// Every write is checked by the rules for groups/{groupId}/sessions in firestore.rules.

const sessionsRef = (groupId) => collection(db, 'groups', groupId, 'sessions');

// The day a session counts toward, as "YYYY-MM-DD" on this device's calendar.
export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Patch 1: save a new session, played by the signed-in person, as the set starts playing.
// `before` is what the checklist before playing handed over. Returns the session id.
export async function startSession(groupId, { affect, setNumber, before }) {
  if (!isValidGroupId(groupId)) throw new Error('Choose a valid care team first.');
  const sessionRef = await addDoc(sessionsRef(groupId), {
    playedBy: auth.currentUser.uid,
    affect,
    setNumber,
    day: localDay(),
    startedAt: serverTimestamp(),
    before,
  });
  return sessionRef.id;
}

// Patch 2: mark the session as played to the end.
export async function endSession(groupId, sessionId) {
  console.log('TODO endSession', { groupId, sessionId });
}

// Patch 2: save the after-playing answers.
export async function saveAfter(groupId, sessionId, { changes, agitated }) {
  console.log('TODO saveAfter', { groupId, sessionId, changes, agitated });
}
