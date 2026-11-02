// Tests for the story editor's plan (src/audioEdit.js): which parts play, in what order, and for how long.
// `npm run test:unit`.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_RATE, noEdits, planSegments, plannedLength, withCut, withInsert, withoutInsert,
} from '../src/audioEdit.js';

// A new recording `seconds` long.
const recording = (seconds) => new Float32Array(Math.round(seconds * SAMPLE_RATE));

// The plan as text: original parts as "start-end", added recordings as "+length".
function plan(edits) {
  return planSegments(edits, [])
    .map((s) => (s.insert ? `+${s.end}` : `${s.start}-${s.end}`))
    .join(' ');
}

describe('adding and recording over parts', () => {
  const story = noEdits(10);

  test('with no edits, the whole recording plays', () => {
    assert.equal(plan(story), '0-10');
  });

  test('a new part goes in at its spot', () => {
    const edits = withInsert(story, 4, recording(2));
    assert.equal(plan(edits), '0-4 +2 4-10');
    assert.equal(plannedLength(planSegments(edits, [])), 12);
  });

  test('recording over a part replaces it', () => {
    const edits = withInsert(story, 3, recording(1), 6);
    assert.equal(plan(edits), '0-3 +1 6-10');
    assert.equal(plannedLength(planSegments(edits, [])), 8);
  });

  test('removing a recording brings back the part it recorded over', () => {
    const edits = withInsert(story, 3, recording(1), 6);
    assert.equal(plan(withoutInsert(edits, edits.inserts[0])), '0-10');
  });

  test('a part added outside the trimmed ends goes at that end', () => {
    const trimmed = { ...story, trimStart: 1, trimEnd: 9 };
    assert.equal(plan(withInsert(trimmed, 0, recording(1))), '+1 1-9');
    assert.equal(plan(withInsert(trimmed, 10, recording(1))), '1-9 +1');
  });

  test('a part added at a cut goes where the cut was', () => {
    assert.equal(plan(withInsert(withCut(story, 2, 5), 2, recording(1))), '0-2 +1 5-10');
  });

  test('several parts go in order, whatever order they were added in', () => {
    const edits = withInsert(withInsert(story, 10, recording(1)), 5, recording(0.5));
    assert.equal(plan(edits), '0-5 +0.5 5-10 +1');
  });
});
