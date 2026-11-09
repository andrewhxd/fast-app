// Fills the local Firestore and Auth emulators with demo accounts, care teams and sample stories, so
// every screen has something to show. `npm run dev:local` runs this after starting the emulators;
// it never touches a real Firebase project.
//
// The stories match the ones in the design canvas: Happy set 1 partway there, Happy set 2 in range,
// Challenging set 1 partway there, and Challenging set 2 empty. Two stories run close to 5:00 and
// have long pauses, so the story editor has something to shorten.
// Family A and Family B each get a separate short story to check group filtering and playback.
// Each group belongs to a demo account (see the end of this file), signed in through the Auth emulator.
//
// The audio is spoken by the computer: on a Mac, the built-in `say` voices read each story's text
// (STORY_TEXT) after the patient's name 3 times, one voice per storyteller, saved as WAV. A story
// repeats from the start to fill its length, so the set totals stay as designed. The speech is kept in
// node_modules/.cache/fast-seed-audio, so only the first run makes it. Without `say` (on Windows or
// Linux), the stories are a voice-like hum instead.
// Accounts, groups, invites and stories are written through the security rules in firestore.rules,
// the same way the app saves them, so a change the rules reject makes this script fail.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth';
import {
  Bytes, collection, connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc, updateDoc, writeBatch,
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

// What each story says, in its storyteller's words. [[slnc 2200]] is a 2.2 second pause (the editor
// shortens pauses over 1.5 seconds).
const STORY_TEXT = {
  'Bike ride': "Remember the summer you got the red bike? We rode all the way down Miller Road to the river. You were ahead the whole time, standing up on the pedals, yelling back at me to hurry up. The air smelled like cut grass and hot pavement. When we got to the bridge, we dropped the bikes in the weeds and threw rocks into the water until the sun went down. Riding home in the dark, you told me you'd never been that tired or that happy.",
  'Birthday party': "On your tenth birthday, the whole kitchen smelled like chocolate cake. Grandma came early to help with the frosting, and you kept sneaking spoonfuls when you thought nobody was looking. Your friends filled the backyard, and Dad hung paper lanterns from the oak tree. When we carried the cake out, everyone sang so loudly the neighbors joined in over the fence. You closed your eyes for a long time before you blew out the candles. You never told us what you wished for, but you smiled all night.",
  'Walk to the park': "Every Sunday morning, we walked to the park at the end of our street. You always wanted to stop and pet the neighbor's dog. We'd sit on the green bench by the pond and watch the ducks.",
  "Heather and Dave's wedding": "It's Jeff. I want to tell you about Heather and Dave's wedding. [[slnc 2200]] It was out at the lake, on a warm September afternoon. The chairs were set up on the grass, facing the water, and there were white flowers tied to every row. [[slnc 2200]] You stood next to me in that gray suit you hated, tugging at the collar the whole time. When Heather walked down the aisle, you leaned over and whispered that Dave looked like he might faint. [[slnc 2200]] He didn't, but it was close. At dinner, you gave the funniest toast of the night. You told the story about Dave getting the canoe stuck on the sandbar, and the whole tent was laughing. [[slnc 2200]] Later, the band played that old song Mom loves, and you pulled her out onto the dance floor. The lights were strung over the water and everybody was dancing.",
  'Wave hello': "Hi, sweetheart. It's Mom. I'm right here, and I love you so much.",
  'First day of school': "On your first day of school, you wore the blue backpack with the dinosaur on it. You held my hand all the way to the door, and then you let go and walked in without looking back. I stood outside for a minute, a little sad and very proud. When I picked you up, you told me all about your teacher, Miss Lopez, and the girl who shared her crayons with you. You talked the whole way home.",
  'Yellowstone trip': "Remember our trip to Yellowstone? We waited on the wooden benches for Old Faithful, and you were sure it would never go off. Then the ground hissed, and the water shot up into the sky. You grabbed my arm and laughed. That night we roasted marshmallows, and you burned every single one on purpose.",
  'Thanksgiving dinner': "It's Mia. Remember last Thanksgiving? The whole house smelled like turkey and pumpkin pie. You and Dad argued about football all afternoon, and you won, like always. After dinner we all squeezed onto the couch and fell asleep watching a movie.",
  'Snow day': "The year it snowed two feet, school was canceled for three days. We built a snow fort in the front yard, with windows and a tunnel. You threw the first snowball, of course, and it hit me right in the back of the neck.",
  "Dad's surgery": "It's Jeff. I want to talk about the day of Dad's surgery. [[slnc 2200]] We sat in the waiting room for hours. The chairs were hard and the coffee was terrible, and neither of us said much. [[slnc 2200]] You kept getting up to look out the window at the parking lot. I remember the sound of the clock on the wall, and the nurse's shoes squeaking down the hall. [[slnc 2200]] When the doctor finally came out and said it went well, you put your head in your hands. Then you laughed, just from relief. [[slnc 2200]] We went in to see him together. He was groggy, but he squeezed your hand and asked if we'd eaten anything. That was Dad.",
  'The flood': "It's Mom. Do you remember the spring the river flooded? The water came up past the mailbox in one night. We carried the photo albums and Grandma's quilt up to the attic, one armful at a time. Your father and the neighbors stacked sandbags along the driveway in the rain. It was cold and loud and scary. But when the water went down, everyone on the street came out to help clean up. You spent the whole week hauling wet carpet with the Johnsons' kids, and you never once complained.",
  'Family A picnic': "Remember our picnic by the lake? We spread the blanket under the big willow tree and ate sandwiches while the ducks watched us.",
  'Family B birthday': "Happy birthday! Remember the party in the backyard, with the balloons tied to the fence and the cake with too many candles?",
  "Grandpa's fishing trip": "It's Mom. Remember when Grandpa took you fishing at the cabin? You were up before the sun, sitting on the dock in your pajamas. You caught one tiny fish all morning, and you made Grandpa take a picture of it before you let it go.",
};

// The name the patient is called by, said 3 times at the start of each story, per group.
const CALL_NAMES = { default: 'Sam', 'family-a': 'Robin', 'family-b': 'Casey' };

// Each storyteller's Mac voice, and the pitch (Hz) of their hum where there's no `say`.
const VOICES = {
  'Jeff Smith': { voice: 'Reed (English (US))', pitch: 115 },
  'Ann Smith': { voice: 'Samantha', pitch: 205 },
  'Mia Smith': { voice: 'Shelley (English (US))', pitch: 240 },
};

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

// Speech in a Mac voice, as samples, or null where there's no `say` (or no voice for this text).
// Made once per voice and text, then kept in the cache folder.
const run = promisify(execFile);
const cacheDir = fileURLToPath(new URL('../node_modules/.cache/fast-seed-audio/', import.meta.url));
let canSpeak = process.platform === 'darwin';

async function spoken(text, voice) {
  if (!canSpeak || !text) return null;
  const file = `${cacheDir}${createHash('sha256').update(`${RATE}\n${voice}\n${text}`).digest('hex').slice(0, 20)}.wav`;
  if (!existsSync(file)) {
    mkdirSync(cacheDir, { recursive: true });
    const format = ['--file-format=WAVE', `--data-format=UI8@${RATE}`, '-o', file];
    try {
      await run('say', ['-v', voice, ...format, text]);
    } catch {
      try {
        await run('say', [...format, text]); // this Mac doesn't have the voice, so use its default one
      } catch {
        canSpeak = false;
        return null;
      }
    }
  }
  return readWav(readFileSync(file));
}

// The samples of an 8-bit mono WAV file, from -1 to 1. `say` puts other chunks before the audio.
function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 12; at + 8 <= bytes.length; at += 8 + view.getUint32(at + 4, true)) {
    if (String.fromCharCode(...bytes.subarray(at, at + 4)) === 'data') {
      return Float32Array.from(bytes.subarray(at + 8, at + 8 + view.getUint32(at + 4, true)), (b) => (b - 128) / 128);
    }
  }
  throw new Error('That WAV file has no audio');
}

// A quarter second of quiet before the voice starts, and the same after, like a real recording.
// It's rounded up to a whole millisecond, since durations are saved in whole milliseconds.
function withLeadIn(samples) {
  const gap = Math.round(0.25 * RATE);
  const out = new Float32Array(Math.ceil((samples.length + 2 * gap) / SAMPLES_PER_MS) * SAMPLES_PER_MS);
  out.set(samples, gap);
  return normalize(out);
}

// `ms` of a story: its speech, repeated from the start until the time is up. The last repeat stops
// at the last pause that fits, and quiet fills the rest, so no word is cut off.
function filled(samples, ms) {
  const out = new Float32Array(ms * SAMPLES_PER_MS);
  const gap = Math.round(1.2 * RATE); // between one telling and the next
  let at = Math.round(0.25 * RATE);
  while (at < out.length) {
    const room = out.length - at;
    if (samples.length <= room) {
      out.set(samples, at);
      at += samples.length + gap;
    } else {
      out.set(samples.subarray(0, lastPause(samples, room)), at);
      break;
    }
  }
  return normalize(out);
}

// Where the last pause of at least 0.3 seconds starts, before sample `limit`.
function lastPause(samples, limit) {
  const quietFor = Math.round(0.3 * RATE);
  let quiet = 0;
  let found = 0;
  for (let i = 0; i < limit; i++) {
    quiet = Math.abs(samples[i]) < 0.02 ? quiet + 1 : 0;
    if (quiet === quietFor) found = i - quietFor + 1;
  }
  return found;
}

// "m:ss" -> ms
function toMs(time) {
  const [minutes, seconds] = time.split(':').map(Number);
  return (minutes * 60 + seconds) * 1000;
}

// Saves a story and its audio chunks in one batch, like queueStory() in src/storage.js.
async function saveStory(db, [title, storyteller, relationship, affect, setNumber, length, longPauses = false], groupId = 'default') {
  const { voice, pitch } = VOICES[storyteller];
  const callName = CALL_NAMES[groupId];
  const spokenName = await spoken(`${callName}. [[slnc 500]] ${callName}. [[slnc 500]] ${callName}.`, voice);
  const nameSamples = spokenName ? withLeadIn(spokenName) : nameClip(pitch);
  const nameDuration = nameSamples.length / SAMPLES_PER_MS;
  const storyDuration = toMs(length) - nameDuration;
  const spokenStory = await spoken(STORY_TEXT[title], voice);
  const nameBytes = wav(nameSamples);
  const storyBytes = wav(spokenStory ? filled(spokenStory, storyDuration) : speech(storyDuration, pitch, random(title), longPauses));

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
  return storyRef;
}

// Signs in as a demo account, creating it first with a confirmed email address.
async function signInAs({ name, email }) {
  if (auth.currentUser) await signOut(auth);
  const { user } = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  await updateProfile(user, { displayName: name });
  // The Auth emulator lets the "owner" token change any account, here to confirm the email address.
  const response = await fetch(`http://${authEmulator}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: user.uid, emailVerified: true }),
  });
  if (!response.ok) throw new Error(`Could not confirm ${email}: ${await response.text()}`);
  await user.reload();
  await user.getIdToken(true);
  return user;
}

// Starts a group owned by the signed-in account, like createGroup() in src/group.js.
async function startGroup(user, id, name) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'groups', id), { id, name, ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, 'groups', id, 'members', user.uid), memberFor(user, 'administrator'));
  await batch.commit();
}

function memberFor(user, access) {
  return { uid: user.uid, name: user.displayName, email: user.email, joinedAt: serverTimestamp(), access };
}

// Invites an email address to a group the signed-in account owns, with an access level, like
// createInvite(). Returns its ID.
async function invite(user, groupId, groupName, email, access) {
  const inviteRef = doc(collection(db, 'groups', groupId, 'invites'));
  await setDoc(inviteRef, {
    email, groupName, invitedBy: user.uid, invitedByName: user.displayName, access, createdAt: serverTimestamp(),
  });
  return inviteRef.id;
}

// Accepts an invite as the signed-in account, with its access level, like acceptInvite().
async function join(user, groupId, inviteId, access) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'groups', groupId, 'members', user.uid), { ...memberFor(user, access), invite: inviteId });
  batch.delete(doc(db, 'groups', groupId, 'invites', inviteId));
  await batch.commit();
}

const env = loadEnv('emulator', fileURLToPath(new URL('..', import.meta.url)), 'VITE_');
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const emulator = env.VITE_FIRESTORE_EMULATOR;
const authEmulator = env.VITE_AUTH_EMULATOR;
// Only ever write to the emulators, and only to a "demo-" project, which can't exist outside them.
if (!emulator || !authEmulator || !projectId?.startsWith('demo-')) {
  throw new Error('.env.emulator must set VITE_FIRESTORE_EMULATOR, VITE_AUTH_EMULATOR and a "demo-" VITE_FIREBASE_PROJECT_ID');
}

const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, projectId });
const db = getFirestore(app);
const [host, port] = emulator.split(':');
connectFirestoreEmulator(db, host, Number(port));
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });

// The demo accounts all share one password. Ann leads Sam Smith's care team, with Jeff as a member who
// records and edits (Mia is invited to play, Dave as a clinician);
// Jeff and Mia each lead a small group of their own, so the groups' stories can be told apart.
const ANN = { name: 'Ann Smith', email: 'ann@example.com' };
const JEFF = { name: 'Jeff Smith', email: 'jeff@example.com' };
const MIA = { name: 'Mia Smith', email: 'mia@example.com' };
const PASSWORD = 'password';

// The emulators start empty each time, but they could be left running between seeds.
const existing = await signInWithEmailAndPassword(auth, ANN.email, PASSWORD).then(() => true, () => false);
if (existing) {
  console.log('The local database already has the demo accounts, so nothing was added.');
  process.exit(0);
}

const jeff = await signInAs(JEFF);
await startGroup(jeff, 'family-a', 'Family A');
for (const { story } of GROUP_STORIES.filter((g) => g.groupId === 'family-a')) await saveStory(db, story, 'family-a');

const mia = await signInAs(MIA);
await startGroup(mia, 'family-b', 'Family B');
for (const { story } of GROUP_STORIES.filter((g) => g.groupId === 'family-b')) await saveStory(db, story, 'family-b');

const ann = await signInAs(ANN);
await startGroup(ann, 'default', 'Sam Smith');
for (const story of STORIES) await saveStory(db, story, 'default');
// A deleted story, so Listen's Recently deleted has something to restore.
const deleted = await saveStory(db, ['Grandpa\'s fishing trip', 'Ann Smith', 'Mother', 'happy', 1, '1:05'], 'default');
await updateDoc(deleted, { deletedAt: serverTimestamp(), deletedBy: ann.uid });
const jeffInvite = await invite(ann, 'default', 'Sam Smith', JEFF.email, 'stories');
await invite(ann, 'default', 'Sam Smith', 'dave@example.com', 'clinician'); // left pending
const miaInvite = await invite(ann, 'default', 'Sam Smith', MIA.email, 'player'); // left pending, to try joining

await signOut(auth);
await signInWithEmailAndPassword(auth, JEFF.email, PASSWORD);
await join(auth.currentUser, 'default', jeffInvite, 'stories');
await signOut(auth);

console.log(`Added ${STORIES.length + GROUP_STORIES.length} sample stories in 3 groups (and 1 deleted one), and these accounts (password "${PASSWORD}"):`);
console.log(`  ${ANN.email}   leads Sam Smith's care team (Jeff records and edits; Mia is invited to play, dave@example.com as clinician)`);
console.log(`  ${JEFF.email}  records and edits in Sam Smith's care team, leads Family A`);
console.log(`  ${MIA.email}   leads Family B. Her invite to play for Sam Smith: http://localhost:5173/?group=default&invite=${miaInvite}`);
