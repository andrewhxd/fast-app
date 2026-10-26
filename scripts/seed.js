// Fills the local Firestore emulator with sample stories, so every screen has something to show.
// `npm run dev:local` runs this after starting the emulator; it never touches a real Firebase project.
// `npm run seed:preview` uses the same data in the isolated fast-app-2026 test project.
//
// The stories match the ones in the design canvas: Happy set 1 partway there, Happy set 2 in range,
// Challenging set 1 partway there, and Challenging set 2 empty. Two stories run close to 5:00 and
// have long pauses, so the story editor has something to shorten.
// Family A and Family B each get a separate short story to check group filtering and playback.
//
// The audio is generated: a voice-like hum in syllables, words and phrases (there is no real speech),
// saved as WAV. Stories are written through the security rules in firestore.rules, the same way the
// app saves them, so a change to the data model that the rules reject makes this script fail.

import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  Bytes, collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, query, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore/lite';
import { loadEnv } from 'vite';

const STORIES = [
  // title, storyteller, relationship, affect, setNumber, length with the name clip, long pauses
  ['Bike ride', 'Jeff Smith', 'Brother', 'happy', 1, '1:18'],
  ['Birthday party', 'Ann Smith', 'Mother', 'happy', 1, '2:19'],
  ['Walk to the park', 'Jeff Smith', 'Brother', 'happy', 1, '0:35'],
  ["Heather and Dave's wedding", 'Jeff Smith', 'Brother', 'happy', 2, '4:58', true],
  ['Wave hello', 'Ann Smith', 'Mother', 'happy', 2, '0:20'],
  ['First day of school', 'Ann Smith', 'Mother', 'happy', 2, '1:40'],
  ['Yellowstone trip', 'Ann Smith', 'Mother', 'happy', 2, '1:12'],
  ['Thanksgiving dinner', 'Mia Smith', 'Sister', 'happy', 2, '1:05'],
  ['Snow day', 'Jeff Smith', 'Brother', 'happy', 2, '0:50'],
  ["Dad's surgery", 'Jeff Smith', 'Brother', 'challenging', 1, '4:47', true],
  ['The flood', 'Ann Smith', 'Mother', 'challenging', 1, '1:53'],
];

// A small story in each non-default group makes group filtering and playback easy to check.
const GROUP_STORIES = [
  { groupId: 'family-a', story: ['Family A picnic', 'Jeff Smith', 'Brother', 'happy', 1, '0:45'] },
  { groupId: 'family-b', story: ['Family B birthday', 'Ann Smith', 'Mother', 'happy', 1, '0:50'] },
];

// Each storyteller's speaking pitch (Hz).
const VOICES = { 'Jeff Smith': 115, 'Ann Smith': 205, 'Mia Smith': 240 };

// Same layout as src/storage.js.
const TREATMENT_ID = 'demo';
const CHUNK_SIZE = 1_000_000;

// 8,000 samples a second, 8 bits each: 2.4 MB for a 5:00 story, under the 5 MB limit per story.
const RATE = 8000;
const SAMPLES_PER_MS = RATE / 1000;

// Vowel sounds as their two main resonances (formants), in Hz.
const VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [660, 1720], [490, 1350]];

// A small seeded random number generator, so every run makes the same audio.
function random(seedText) {
  let seed = [...seedText].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mixes one syllable into `out`: a hum at pitch `f0` (gliding to f0 * glide), shaped like `vowel`.
function addSyllable(out, start, length, f0, glide, vowel, gain) {
  const [f1, f2] = vowel;
  const harmonics = [];
  for (let k = 1; k * f0 * Math.max(1, glide) < RATE * 0.45; k++) {
    const f = k * f0;
    const shape = Math.exp(-(((f - f1) / 110) ** 2)) + 0.6 * Math.exp(-(((f - f2) / 160) ** 2)) + 0.12;
    harmonics.push((gain * shape) / Math.sqrt(k));
  }
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    phase += (2 * Math.PI * f0 * (1 + (glide - 1) * progress)) / RATE;
    let sample = 0;
    for (let k = 0; k < harmonics.length; k++) sample += harmonics[k] * Math.sin((k + 1) * phase);
    out[start + i] += sample * Math.sin(Math.PI * progress) ** 0.6;
  }
}

// `ms` of speech-like sound: syllables, words, and phrases separated by pauses.
// With `longPauses`, some pauses last 1.8 to 3 seconds (the editor shortens pauses over 1.5 seconds).
function speech(ms, pitch, rand, longPauses) {
  const out = new Float32Array(ms * SAMPLES_PER_MS);
  const end = out.length - 0.4 * RATE;
  let t = Math.round(0.25 * RATE);
  while (t < end) {
    const words = 3 + Math.floor(rand() * 7);
    const loudness = 0.4 + rand() * 0.6; // some phrases are said more quietly than others
    for (let w = 0; w < words && t < end; w++) {
      const syllables = 1 + Math.floor(rand() * 3);
      for (let s = 0; s < syllables && t < end; s++) {
        const length = Math.min(Math.round((0.11 + rand() * 0.15) * RATE), end - t);
        if (length < 0.04 * RATE) break;
        // The pitch falls a little toward the end of each phrase, as it does in speech.
        const f0 = pitch * (1.08 - (0.16 * w) / words) * (0.94 + rand() * 0.12);
        const vowel = VOWELS[Math.floor(rand() * VOWELS.length)];
        addSyllable(out, t, length, f0, 0.92 + rand() * 0.16, vowel, loudness * (0.7 + rand() * 0.3));
        t += length + Math.round(rand() * 0.03 * RATE);
      }
      t += Math.round((0.06 + rand() * 0.12) * RATE);
    }
    const pause = longPauses && rand() < 0.18 ? 1.8 + rand() * 1.2 : 0.3 + rand() * 0.45;
    t += Math.round(pause * RATE);
  }
  return normalize(out);
}

// The patient's name said 3 times: the same two syllables, with a pause between each time.
function nameClip(pitch) {
  const syllables = [[220, VOWELS[3], 1.04], [300, VOWELS[0], 0.88]]; // ms, vowel, pitch glide
  const ms = 300 + 3 * (220 + 40 + 300) + 2 * 550 + 400;
  const out = new Float32Array(ms * SAMPLES_PER_MS);
  let t = 300;
  for (let time = 0; time < 3; time++) {
    for (const [length, vowel, glide] of syllables) {
      addSyllable(out, t * SAMPLES_PER_MS, length * SAMPLES_PER_MS, pitch, glide, vowel, 1);
      t += length + 40;
    }
    t += 550 - 40;
  }
  return normalize(out);
}

function normalize(samples) {
  const peak = samples.reduce((max, x) => Math.max(max, Math.abs(x)), 0) || 1;
  return samples.map((x) => (x / peak) * 0.8);
}

// 8-bit mono WAV file bytes.
function wav(samples) {
  const bytes = new Uint8Array(44 + samples.length);
  const view = new DataView(bytes.buffer);
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // format chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE, true); // bytes per second
  view.setUint16(32, 1, true); // bytes per sample
  view.setUint16(34, 8, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, samples.length, true);
  samples.forEach((x, i) => { bytes[44 + i] = Math.round(128 + 127 * x); });
  return bytes;
}

// "m:ss" -> ms
function toMs(time) {
  const [minutes, seconds] = time.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

// Saves a story and its audio chunks in one batch, like queueStory() in src/storage.js.
async function saveStory(db, [title, storyteller, relationship, affect, setNumber, length, longPauses = false], groupId = 'default') {
  const pitch = VOICES[storyteller];
  const nameSamples = nameClip(pitch);
  const nameDuration = nameSamples.length / SAMPLES_PER_MS;
  const storyDuration = toMs(length) - nameDuration;
  const nameBytes = wav(nameSamples);
  const storyBytes = wav(speech(storyDuration, pitch, random(title), longPauses));

  const bytes = new Uint8Array(nameBytes.length + storyBytes.length);
  bytes.set(nameBytes);
  bytes.set(storyBytes, nameBytes.length);
  const chunkCount = Math.ceil(bytes.length / CHUNK_SIZE);

  const batch = writeBatch(db);
  const storyRef = doc(collection(db, 'treatments', TREATMENT_ID, 'stories'));
  batch.set(storyRef, {
    title,
    storyteller,
    relationship,
    affect,
    setNumber,
    group: groupId,
    nameDuration,
    storyDuration,
    type: 'audio/wav',
    nameSize: nameBytes.length,
    size: bytes.length,
    chunkCount,
    createdAt: serverTimestamp(),
  });
  for (let i = 0; i < chunkCount; i++) {
    const piece = bytes.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    batch.set(doc(storyRef, 'chunks', String(i)), { data: Bytes.fromUint8Array(piece) });
  }
  await batch.commit();
}

const target = process.argv[2] === '--preview' ? 'preview' : 'emulator';
if (process.argv.length > 2 && process.argv[2] !== '--preview') {
  throw new Error('Usage: node scripts/seed.js [--preview]');
}

const env = loadEnv(target, fileURLToPath(new URL('..', import.meta.url)), 'VITE_');
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const emulator = env.VITE_FIRESTORE_EMULATOR;
// Local seeding can only target an emulator and a "demo-" project.
if (target === 'emulator' && (!emulator || !projectId?.startsWith('demo-'))) {
  throw new Error('.env.emulator must set VITE_FIRESTORE_EMULATOR and a "demo-" VITE_FIREBASE_PROJECT_ID');
}
// Cloud writes are limited to the explicitly configured test project.
if (target === 'preview' && (emulator || projectId !== 'fast-app-2026')) {
  throw new Error('Preview seeding is allowed only for fast-app-2026, with no Firestore emulator configured.');
}

const db = getFirestore(initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, projectId }));
if (target === 'emulator') {
  const [host, port] = emulator.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}

for (const group of [
  { id: 'default', name: 'Default group' },
  { id: 'family-a', name: 'Family A' },
  { id: 'family-b', name: 'Family B' },
]) {
  const groupRef = doc(db, 'groups', group.id);
  if (!(await getDoc(groupRef)).exists()) {
    await setDoc(groupRef, {
      ...group,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

const existing = await getDocs(query(collection(db, 'treatments', TREATMENT_ID, 'stories'), limit(1)));
if (!existing.empty) {
  console.log(`The ${target} database already has stories, so no sample stories were added.`);
} else {
  for (const story of STORIES) await saveStory(db, story, 'default');
  for (const { groupId, story } of GROUP_STORIES) await saveStory(db, story, groupId);
  console.log(`Added ${STORIES.length + GROUP_STORIES.length} sample stories to the ${target} database.`);
}
