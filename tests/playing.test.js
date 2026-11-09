// Tests for picking what to play (src/playing.js): which sets can play today, the random pick and
// the shuffled story order. `npm run test:unit`.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  localDay, pickSet, playableSets, prepareItems, shuffled,
} from '../src/playing.js';

const story = (affect, setNumber, id) => ({ id, affect, setNumber });
const stories = [story('happy', 1, 'a'), story('happy', 2, 'b'), story('challenging', 1, 'c'), story('happy', 1, 'd')];
const keys = (sets) => sets.map((s) => `${s.affect}-${s.setNumber}`);

describe('which sets can play', () => {
  test('every set with stories, in order', () => {
    assert.deepEqual(keys(playableSets(stories, [])), ['happy-1', 'happy-2', 'challenging-1']);
  });

  test('not the ones already played today', () => {
    assert.deepEqual(keys(playableSets(stories, ['happy-2', 'challenging-1'])), ['happy-1']);
  });

  test('none once every set with stories has played', () => {
    assert.deepEqual(playableSets(stories, ['happy-1', 'happy-2', 'challenging-1']), []);
  });

  test('none with no stories', () => {
    assert.deepEqual(playableSets([], []), []);
  });
});

describe('the random pick', () => {
  const sets = playableSets(stories, []);

  test('covers every set', () => {
    assert.equal(pickSet(sets, () => 0), sets[0]);
    assert.equal(pickSet(sets, () => 0.5), sets[1]);
    assert.equal(pickSet(sets, () => 0.999), sets[2]);
  });

  test('is null with nothing to pick', () => {
    assert.equal(pickSet([], () => 0), null);
  });

  test('a day plays each set once: 3, then 2, then 1, then none', () => {
    const played = [];
    for (const left of [3, 2, 1]) {
      const playable = playableSets(stories, played);
      assert.equal(playable.length, left);
      played.push(keys([pickSet(playable)])[0]);
    }
    assert.equal(pickSet(playableSets(stories, played)), null);
    assert.equal(new Set(played).size, 3);
  });
});

describe('the story order', () => {
  test('keeps every story once', () => {
    const order = shuffled(stories);
    assert.equal(order.length, stories.length);
    assert.deepEqual([...order].sort((x, y) => x.id.localeCompare(y.id)), stories);
  });

  test("doesn't change the list it's given", () => {
    const copy = [...stories];
    shuffled(stories, () => 0);
    assert.deepEqual(stories, copy);
  });

  test('follows the random numbers', () => {
    assert.deepEqual(shuffled([1, 2, 3], () => 0), [2, 3, 1]);
    assert.deepEqual(shuffled([1, 2, 3], () => 0.999), [1, 2, 3]);
  });
});

describe('the checklist and the day', () => {
  test('the hearing aid item only for a patient who uses one', () => {
    assert.ok(prepareItems(true).some((item) => item.key === 'hearingAid'));
    assert.ok(!prepareItems(false).some((item) => item.key === 'hearingAid'));
    assert.equal(prepareItems(false).length, 5);
  });

  test('the day on this device', () => {
    assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });
});
