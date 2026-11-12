import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore/lite';
import { auth, db } from './firebase.js';
import { isValidGroupId } from './group.js';

// Saving each time a story set is played to the patient (a "session").
//
//   groups/{groupId}/sessions/{sessionId}
//     playedBy, affect, setNumber, day, startedAt   saved when playing starts
//     before: { done: [...], awake: [...] }         ids from checklists.js
//     endedAt                                       added when the set stops playing
//     after: { changes: { id: 'more' | 'same' | 'less' }, agitated: true/false }   added after
//
// Every write is checked by the rules for groups/{groupId}/sessions in firestore.rules.

const sessionsRef = (groupId) => collection(db, 'groups', groupId, 'sessions');

// The day a session counts toward, as "YYYY-MM-DD" on this device's calendar.
export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Save a new session, played by the signed-in person, as the set starts playing.
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

// Mark the session as stopped playing (it ended, or was stopped early), now.
export function endSession(groupId, sessionId) {
  return updateDoc(doc(sessionsRef(groupId), sessionId), { endedAt: serverTimestamp() });
}

// Save the after-playing answers. `changes` maps each AFTER_BEHAVIORS id to
// 'more', 'same' or 'less'.
export function saveAfter(groupId, sessionId, { changes, agitated }) {
  return updateDoc(doc(sessionsRef(groupId), sessionId), { after: { changes, agitated } });
}
