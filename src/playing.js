// Picking what to play to the patient (doc slides 22 and 23): one set at random, with its
// stories in random order.
// Until clinician approval is built, any set with stories can be played, so testers can try it.
// TODO: once sessions are saved, leave out the sets already played today.

import { SETS, storiesInSet } from './stories.js';

// A random set that has stories, with its story ids shuffled, or null if no set has any.
export function pickSet(stories) {
  const sets = SETS.filter(({ affect, setNumber }) => storiesInSet(stories, affect, setNumber).length > 0);
  if (!sets.length) return null;
  const { affect, setNumber } = sets[Math.floor(Math.random() * sets.length)];
  const order = shuffled(storiesInSet(stories, affect, setNumber).map((s) => s.id));
  return { affect, setNumber, order };
}

// A copy of `list` in random order (Fisher-Yates).
function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
