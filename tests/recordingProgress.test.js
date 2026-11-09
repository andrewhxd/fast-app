import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordingSetProgress } from '../src/stories.js';

const minute = 60_000;

test('set progress appears at five minutes of room and marks both targets', () => {
  assert.equal(recordingSetProgress(5 * minute + 1, 0).show, false);
  assert.deepEqual(recordingSetProgress(5 * minute, 0), {
    show: true, minimum: 3 * minute, maximum: 5 * minute,
    toMinimum: 3 * minute, toMaximum: 5 * minute, overMaximum: false,
  });
  assert.equal(recordingSetProgress(5 * minute - 1, 0).show, true);
});

test('progress counts the name and unsaved story, including target boundaries', () => {
  const room = 3 * minute;
  assert.deepEqual(recordingSetProgress(room, 30_000), {
    show: true, minimum: minute, maximum: room, toMinimum: 30_000, toMaximum: 150_000, overMaximum: false,
  });
  assert.equal(recordingSetProgress(room, minute - 1).toMinimum, 1);
  assert.equal(recordingSetProgress(room, minute).toMinimum, 0);
  assert.equal(recordingSetProgress(room, room).overMaximum, false);
  assert.equal(recordingSetProgress(room, room + 1).overMaximum, true);
  assert.equal(recordingSetProgress(room, room + 1).toMaximum, 0);
  assert.equal(recordingSetProgress(room, 5_000).toMinimum, 55_000);
  assert.equal(recordingSetProgress(room, 0).toMinimum, minute);
});
