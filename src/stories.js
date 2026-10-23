// Rules for personal stories and story sets, from the FAST project doc.
//
// A treatment has 4 story sets: Happy 1 and 2, Challenging 1 and 2.
// A set holds as many stories as it takes to reach about 10 minutes (9:00 to 11:00),
// and no single story can be over 5:00.
// Every story starts with the storyteller saying the patient's name 3 times (the "name" clip),
// and that clip counts toward the set's time because the patient hears it too.

export const SETS = [
  { affect: 'happy', setNumber: 1 },
  { affect: 'happy', setNumber: 2 },
  { affect: 'challenging', setNumber: 1 },
  { affect: 'challenging', setNumber: 2 },
];

export const RELATIONSHIPS = ['Mother', 'Father', 'Sister', 'Brother', 'Aunt', 'Uncle', 'Cousin', 'Friend'];

const MINUTE = 60_000; // ms
export const SET_MIN = 9 * MINUTE;
export const SET_MAX = 11 * MINUTE;
export const STORY_MAX = 5 * MINUTE; // must match firestore.rules
export const STORY_WARN = 4.5 * MINUTE; // the story timer turns yellow here
export const NAME_MAX = 1 * MINUTE; // saying a name 3 times takes seconds; must match firestore.rules

export function setKey(affect, setNumber) {
  return `${affect}-${setNumber}`;
}

// e.g. "Happy set 1"
export function setName(affect, setNumber) {
  return `${affect === 'happy' ? 'Happy' : 'Challenging'} set ${setNumber}`;
}

// The stories in one set, in the order they were saved.
export function storiesInSet(stories, affect, setNumber) {
  return stories.filter((s) => s.affect === affect && s.setNumber === setNumber);
}

// What the patient hears for one story: the name clip, then the story.
export function storyLength(story) {
  return story.nameDuration + story.storyDuration;
}

// Story count and total playing time for each set, keyed by setKey().
export function summarizeSets(stories) {
  const summary = Object.fromEntries(SETS.map((s) => [setKey(s.affect, s.setNumber), { count: 0, total: 0 }]));
  for (const story of stories) {
    const set = summary[setKey(story.affect, story.setNumber)];
    set.count += 1;
    set.total += storyLength(story);
  }
  return summary;
}

// Whether `extra` more time still keeps a set at or under 11:00.
export function fitsInSet(total, extra) {
  return total + extra <= SET_MAX;
}

// 'short' (keep recording), 'complete' (in the 9:00 to 11:00 range) or 'over' (over 11:00).
export function setStatus(total) {
  if (total > SET_MAX) return 'over';
  if (total >= SET_MIN) return 'complete';
  return 'short';
}

// A set's status in a few words: "In range", "4:48 to go" or "Over by 0:50".
export function setStatusText(total) {
  const status = setStatus(total);
  if (status === 'complete') return 'In range';
  if (status === 'over') return `Over by ${formatTime(total - SET_MAX)}`;
  return `${formatTime(SET_MIN - total)} to go`;
}

// The CSS class that colors a set: mint once complete, red if over, otherwise its affect's color.
export function tintClass(affect, total = 0) {
  const status = setStatus(total);
  if (status === 'complete') return 'tint-done';
  if (status === 'over') return 'tint-over';
  return `tint-${affect}`;
}

// Where a story's length stands: 'ok', 'warn' (from 4:30) or 'long' (over 5:00).
export function storyLevel(ms) {
  if (ms > STORY_MAX) return 'long';
  if (ms >= STORY_WARN) return 'warn';
  return 'ok';
}

// Milliseconds as "m:ss", e.g. 448000 -> "7:28". Rounds down, like a stopwatch.
export function formatTime(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
