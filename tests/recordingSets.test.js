import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bestRecordingSet, SET_MAX, SET_MIN, summarizeSets } from '../src/stories.js';

const minute = 60_000;
function summary(first, second) {
  const result = summarizeSets([]);
  result['challenging-1'].total = first;
  result['challenging-2'].total = second;
  return result;
}

describe('choosing a set for a new recording', () => {
  it('chooses the only set that can fit the recording', () => {
    assert.equal(bestRecordingSet(summary(8 * minute, 7 * minute), 'challenging', 3 * minute + 1), 2);
  });
  it('chooses the set with the most room and set 1 for a tie', () => {
    assert.equal(bestRecordingSet(summary(6 * minute, 3 * minute), 'challenging', minute), 2);
    assert.equal(bestRecordingSet(summary(3 * minute, 3 * minute), 'challenging', minute), 1);
  });
  it('returns no set when neither can fit, then finds one after shortening', () => {
    const sets = summary(8 * minute, 8 * minute + 1);
    assert.equal(bestRecordingSet(sets, 'challenging', 3 * minute + 1), null);
    assert.equal(bestRecordingSet(sets, 'challenging', 3 * minute), 1);
  });
  it('does not add stories to a ready or overfull set', () => {
    assert.equal(bestRecordingSet(summary(SET_MIN, 8 * minute), 'challenging', minute), 2);
    assert.equal(bestRecordingSet(summary(SET_MIN, SET_MAX + 1), 'challenging', 1), null);
  });
});
