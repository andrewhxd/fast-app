import {
  Bytes, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore/lite';
import { createAudioCache } from './audioCache.js';
import { db } from './firebase.js';
import { isValidGroupId } from './group.js';

// Stories are stored in Cloud Firestore. The project is on the free Spark plan,
// which has no Cloud Storage bucket, so the audio itself goes into Firestore too:
//
//   treatments/demo/stories/{id}            title, storyteller, relationship, affect, setNumber,
//                                           group, nameDuration, storyDuration, type, nameSize,
//                                           size, chunkCount, createdAt
//   treatments/demo/stories/{id}/chunks/{i} data: up to 1 MB of the audio (documents max out at 1 MiB)
//
// The audio is the name clip's bytes followed by the story clip's bytes; nameSize says where to split them.
// Every story sits in one collection (the "demo" treatment) and names its group (care team) in `group`.
// Only the group's members can read or change it (see firestore.rules), so every query filters by group.

const TREATMENT_ID = 'demo';
const CHUNK_SIZE = 1_000_000; // bytes per chunk document
const MAX_CHUNKS = 5; // must match firestore.rules
const MAX_SIZE = CHUNK_SIZE * MAX_CHUNKS; // 5 MB, about 10 minutes of audio at 64 kbps

const storiesRef = collection(db, 'treatments', TREATMENT_ID, 'stories');
// Stories' audio stays in memory (RAM) once loaded, up to 200 MB in total (a safe margin for
// phone browsers), so replays don't download again; past that, the least recently used is dropped.
const audioCache = createAudioCache(200 * 1024 ** 2);

// Queue a story and its audio chunks into `batch`, as a new document. Returns its ref and audio.
// `name` and `story` are the two clips: { blob, duration }, recorded in the same format.
async function queueStory(batch, details, name, story) {
  const nameBytes = new Uint8Array(await name.blob.arrayBuffer());
  const storyBytes = new Uint8Array(await story.blob.arrayBuffer());
  const size = nameBytes.length + storyBytes.length;
  if (size > MAX_SIZE) throw new Error('the recording is too large to upload (5 MB max)');

  const bytes = new Uint8Array(size);
  bytes.set(nameBytes);
  bytes.set(storyBytes, nameBytes.length);
  const chunkCount = Math.ceil(size / CHUNK_SIZE);
  const storyRef = doc(storiesRef); // new auto-generated id

  batch.set(storyRef, {
    ...details,
    nameDuration: name.duration,
    storyDuration: story.duration,
    type: name.blob.type,
    nameSize: nameBytes.length,
    size,
    chunkCount,
    createdAt: serverTimestamp(),
  });
  for (let i = 0; i < chunkCount; i++) {
    const piece = bytes.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    batch.set(doc(storyRef, 'chunks', String(i)), { data: Bytes.fromUint8Array(piece) });
  }
  return { storyRef, audio: new Blob([bytes], { type: name.blob.type }) };
}

// Queue the deletion of a story and all of its audio chunks into `batch`.
function queueDelete(batch, story) {
  const storyRef = doc(storiesRef, story.id);
  for (let i = 0; i < story.chunkCount; i++) batch.delete(doc(storyRef, 'chunks', String(i)));
  batch.delete(storyRef);
}

// Upload a story in one batch, so it saves completely or not at all. Returns the new id.
// `name` and `story` are the two recorded clips: { blob, duration }.
export async function addStory({ groupId, name, story, ...details }) {
  if (!isValidGroupId(groupId)) throw new Error('Choose a valid group before saving this story.');
  const batch = writeBatch(db);
  const { storyRef, audio } = await queueStory(batch, { ...details, group: groupId }, name, story);
  await batch.commit();
  audioCache.add(storyRef.id, audio); // no download to play it back
  return storyRef.id;
}

// A story can only be changed from its own group's screens.
function assertStoryGroup(story, groupId) {
  if (!isValidGroupId(groupId) || story.group !== groupId) {
    throw new Error('This story does not belong to the current group. Reload the story list and try again.');
  }
}

// Replace a saved story's audio with an edited version, keeping its title and other details.
// Saved stories never change, so the story is saved again under a new id and the old one deleted,
// in one batch: either both happen or neither does. Returns the new id.
export async function replaceStoryAudio(old, { name, story }, groupId) {
  assertStoryGroup(old, groupId);
  const details = {
    title: old.title,
    storyteller: old.storyteller,
    relationship: old.relationship,
    affect: old.affect,
    setNumber: old.setNumber,
    group: old.group,
  };
  const batch = writeBatch(db);
  const { storyRef, audio } = await queueStory(batch, details, name, story);
  queueDelete(batch, old);
  await batch.commit();
  audioCache.remove(old.id);
  audioCache.add(storyRef.id, audio);
  return storyRef.id;
}

// List one group's stories, oldest first (details only, no audio).
// The rules only allow a query that asks for one group's stories, so the filter is in the query.
// Sorting here, not with orderBy, saves a composite index.
export async function listStories(groupId) {
  if (!isValidGroupId(groupId)) throw new Error('Choose a valid group before loading stories.');
  const snapshot = await getDocs(query(storiesRef, where('group', '==', groupId)));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

// Download a story's audio (both clips, back to back) as one Blob, or reuse it if already loaded.
export async function loadStoryAudio(story) {
  const cached = audioCache.get(story.id);
  if (cached) return cached;
  const chunkDocs = await Promise.all(
    Array.from({ length: story.chunkCount }, (_, i) => getDoc(doc(storiesRef, story.id, 'chunks', String(i)))),
  );
  // Someone (maybe on another device) may have deleted it since the list was loaded.
  if (!chunkDocs.every((d) => d.exists())) throw new Error(`"${story.title}" was deleted`);
  const blob = new Blob(chunkDocs.map((d) => d.data().data.toUint8Array()), { type: story.type });
  audioCache.add(story.id, blob);
  return blob;
}

// A story's two clips from its audio: the name said 3 times, then the story.
// Each is a whole audio file of its own, with the duration measured when it was recorded.
export function splitClips(story, blob) {
  return [
    { blob: blob.slice(0, story.nameSize, story.type), duration: story.nameDuration },
    { blob: blob.slice(story.nameSize, story.size, story.type), duration: story.storyDuration },
  ];
}

// Move a story to the other set with the same affect (set 1 or 2).
export function moveStory(story, setNumber, groupId) {
  assertStoryGroup(story, groupId);
  return updateDoc(doc(storiesRef, story.id), { setNumber });
}

// Swap two stories between the two sets with the same affect, in one batch so both move or neither does.
export function swapStories(a, b, groupId) {
  assertStoryGroup(a, groupId);
  assertStoryGroup(b, groupId);
  const batch = writeBatch(db);
  batch.update(doc(storiesRef, a.id), { setNumber: b.setNumber });
  batch.update(doc(storiesRef, b.id), { setNumber: a.setNumber });
  return batch.commit();
}

// Delete a story and all of its audio together.
export async function deleteStory(story, groupId) {
  assertStoryGroup(story, groupId);
  const batch = writeBatch(db);
  queueDelete(batch, story);
  await batch.commit();
  audioCache.remove(story.id);
}
