// Rules for playing story sets to the patient, from the FAST project doc (slides 22 to 26).
//
// Each session plays one set, picked at random from the sets not yet played that day, with its
// stories in random order. Before it plays, the caregiver goes through a checklist (PREPARE) and
// says which signs of being awake the patient shows (AWAKE).
// Until clinician approval is built, any set with stories can be played, so testers can try it.

import { SETS, setKey, storiesInSet } from './stories.js';

// The checklist before every session (slide 26). The hearing aid item only shows, and is only
// needed, for a patient who uses one. Must match firestore.rules.
export const PREPARE = [
  { key: 'hearingAid', label: (name) => `${name}'s hearing aid or other accommodation is in place` },
  { key: 'soundCheck', label: () => 'The sound check plays at a comfortable volume' },
  { key: 'told', label: (name) => `${name} has been told the stories are coming` },
  { key: 'earbuds', label: (name) => `The earbuds are in ${name}'s ears` },
  { key: 'quiet', label: () => 'The door is closed and the room is quiet' },
  { key: 'outOfView', label: (name) => `You're out of ${name}'s view, and nobody else is in the room` },
];

// Signs that the patient is awake (slide 8, question 4, and slide 24). Must match firestore.rules.
export const AWAKE = [
  { key: 'eyesOpen', label: 'Opens their eyes on their own' },
  { key: 'eyesToArousal', label: 'Opens their eyes when you call their name or gently shake them' },
  { key: 'followsInstruction', label: 'Does something you asked them to do with their body' },
  { key: 'intentionalMovement', label: 'Moves on purpose, like scratching, moving their clothes or shifting position' },
  { key: 'turnsToSound', label: 'Turns their head or body toward a sound or voice' },
  { key: 'makesSounds', label: 'Makes sounds on their own or in response to something you do' },
  { key: 'respondsToTouch', label: 'Moves more, or shows more facial expression or voice, when you touch or talk to them' },
];

// The checklist items a patient needs: all of them, or all but the hearing aid.
export function prepareItems(hearingAid) {
  return PREPARE.filter((item) => hearingAid || item.key !== 'hearingAid');
}

// The day a session counts toward, as "YYYY-MM-DD" on this device's calendar.
export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The sets that can play now: those with stories, minus the ones already played today
// (`playedKeys`, setKey()s).
export function playableSets(stories, playedKeys) {
  return SETS.filter(({ affect, setNumber }) => storiesInSet(stories, affect, setNumber).length > 0
    && !playedKeys.includes(setKey(affect, setNumber)));
}

// One of `sets` at random, or null if there are none. `random` returns a number in [0, 1).
export function pickSet(sets, random = Math.random) {
  return sets.length ? sets[Math.floor(random() * sets.length)] : null;
}

// A copy of `list` in random order (Fisher-Yates).
export function shuffled(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
