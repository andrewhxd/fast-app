import {
  addDoc, collection, getDocs, query, serverTimestamp, where,
} from 'firebase/firestore/lite';
import { auth, db } from './firebase.js';
import { isValidGroupId } from './group.js';

// Each time a set is played to the patient, it's saved as a session under the care team:
//
//   groups/{groupId}/sessions/{id}   playedBy, affect, setNumber, day, startedAt, prepared, awake
//
// `day` is the date it counts toward ("YYYY-MM-DD", from localDay()), so a set isn't played
// twice in one day. `prepared` lists the checklist items ticked (PREPARE in playing.js) and
// `awake` the signs of being awake (AWAKE). A session is saved once, when the set starts playing,
// and never changes.

const sessionsRef = (groupId) => collection(db, 'groups', groupId, 'sessions');

// The sessions played on `day`, oldest first.
export async function listSessionsOn(groupId, day) {
  if (!isValidGroupId(groupId)) throw new Error('Choose a valid care team first.');
  const snapshot = await getDocs(query(sessionsRef(groupId), where('day', '==', day)));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
}

// Save a session as played by the signed-in person, now.
export async function saveSession(groupId, { affect, setNumber, day, prepared, awake }) {
  if (!isValidGroupId(groupId)) throw new Error('Choose a valid care team first.');
  await addDoc(sessionsRef(groupId), {
    playedBy: auth.currentUser.uid,
    affect,
    setNumber,
    day,
    startedAt: serverTimestamp(),
    prepared,
    awake,
  });
}
