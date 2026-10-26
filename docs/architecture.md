# How the code works

A guide to the code for anyone, person or agent, about to change it.
Read [AGENTS.md](../AGENTS.md) first for the rules of the project and the commands.

## The big picture

FASTapp is a single-page React 19 app built with Vite 7, written in plain JavaScript (JSX, no TypeScript).
There is no router, no state library and no CSS framework.
All data lives in Cloud Firestore, reached through Firestore Lite: one-off reads and writes, with no live listeners.
Audio is recorded, edited and encoded in the browser; there is no server code.

```
index.html → src/main.jsx → src/App.jsx
                              ├─ Sidebar (computer) / NavBar + Menu (phone)
                              ├─ Home ─────────── StorySets' set cards
                              ├─ StorySets ────── "Record a Story": pick a set
                              ├─ RecordStory ──── useRecorder, LiveWaveform, ClipPlayer, StoryEditor
                              ├─ StoryLibrary ─── "Listen": ClipPlayer per story and per set
                              └─ EditStory ────── StoryEditor for a saved story
              src/storage.js ── groups and stories in Firestore (src/firebase.js)
              src/group.js ──── group ID rules and the default group
              src/stories.js ── the FAST rules and time formatting
              src/audioEdit.js ─ decoding, pause finding, edit plans, SoundTouch, MP3
```

## Screens and navigation (`src/App.jsx`)

- `App` holds the current screen as a plain object, for example `{ name: 'record', affect: 'happy', setNumber: 1 }`.
The screens are `home`, `sets`, `stories` (Listen), `record` and `edit`.
- Every screen change is a browser history entry (`history.pushState`), so the phone's Back button and gesture work.
`depth` counts the app's own screens behind the current one, so Back never leaves the app.
- The current group comes from `?group=<groupId>`; no parameter or an empty value means `default`.
Selecting a group on Home pushes a history entry with the new URL, so Back and Forward restore the prior group.
- `listGroups()` loads `groups/{groupId}` documents for the Home selector.
If the URL points to an unknown group, the app hides the story screens and shows a group recovery message.
- After a reload the app reopens the last screen, except that `record` and `edit` fall back to the screen they came from: a recording in progress can't survive a reload.
- `record` and `edit` are "focused": a narrower page, and on a computer the sidebar is locked so a recording isn't lost by a stray click.
- To add a screen: add its name to the `screen` handling in `App`, decide its menu section in `SECTION`, whether it's in `FOCUSED`, and give it a `NavBar` (phone) like the others.

## Data flow

- `App` loads group documents once and checks that the URL's group exists before showing story content.
The Home selector changes the group and URL together.
- `listStories(groupId)` returns only stories for the current group.
It normalizes legacy documents without `group` to `default` in memory, without migrating the stored documents.
- `RecordStory` passes the current group ID to `addStory()`, which stores it as the story's `group` field.
`replaceStoryAudio()` keeps the original group; stories without a group are treated as `default` when edited.
- `App` loads the selected group's story details and passes them down; `summarizeSets()` turns them into each set's count and total.
Changing groups clears the visible list while loading and ignores stale requests, so one group's stories cannot appear under another group's URL.
- `StoryLibrary` preloads audio only for its current story array; set and individual players use those same filtered stories.
Move, swap, delete and edit verify that the selected story belongs to the current group.
- After any change (save, move, swap, delete, edit), the screen calls back into `App`, which reloads the list before showing the result.
Totals are never computed from stale data on the same device.
- Changes made on another device appear only after the list reloads (opening the app, or making a change).
`loadStoryAudio()` reports a story deleted elsewhere instead of failing silently.
- Audio is loaded separately from the details, per story, and kept in memory by `src/audioCache.js` (up to 200 MB, least recently used dropped first).
Listen starts downloading every story's audio as soon as it opens, because phones only let audio start directly from a tap, not after a download finishes.

## Storage (`src/storage.js` and `firestore.rules`)

The data model is in [AGENTS.md](../AGENTS.md#data-model).
The rules behind it:

- `listGroups()` reads the top-level `groups` collection.
Group documents have `id`, `name`, `createdAt` and `updatedAt`; the local seed creates `groups/default`, `groups/family-a` and `groups/family-b`, with 11 default stories and one test story in each family group.
Groups are publicly readable and valid documents may be created, with no sign-in or access control.
- New stories require a valid `group` ID that matches an existing `groups/{groupId}` document.
The public demo still has no sign-in or membership checks.
Legacy stories may omit `group`; they remain readable and movable, and audio replacement assigns them to `default`.
- **A story's audio is chunked.** Firestore documents max out at 1 MiB, so a story's audio is split into 1 MB chunk documents (at most 5, so 5 MB per story).
The name clip and story clip are stored back to back as one byte stream, and `nameSize` says where to split them (`splitClips()`).
- **Writes are atomic batches.** A story and all its chunks are written in one batch, and deleted in one batch.
The rules enforce this with `existsAfter()` and `getAfter()`, so a half-saved or half-deleted story can't exist.
- **Saved stories never change, except `setNumber`.** Moving or swapping updates only `setNumber`, and the rules reject any other update.
Editing a saved story's audio (`replaceStoryAudio()`) writes a new story and deletes the old one in a single batch.
The edited story gets a new id and a new `createdAt`, so it moves to the end of its set's list.
- **Durations are measured, not read from the file.** Some browsers (Chrome's WebM) write recordings without a readable length, so `useRecorder` times the recording itself and the durations are stored in milliseconds as integers.
Never take a length from an `<audio>` element.
- **The limits live in two places.** `src/stories.js` (`STORY_MAX`, `NAME_MAX`, `SET_MIN`, `SET_MAX`) and `firestore.rules` (the 5:00 and 1:00 limits, 5 chunks, 5 MB).
Change both together.

### Changing the data model

Firestore has no schema or migrations: the rules are the schema, and existing documents stay as they were written.
To add or change a story field:

1. Write it in `src/storage.js` (`queueStory()`, and `replaceStoryAudio()` if it should survive an edit).
2. Allow and validate it in `firestore.rules` (`isValidStory()`'s field list and checks).
3. Write it in `scripts/seed.js`, or `npm run dev:local` will fail (the seed goes through the rules).
4. Update the data model in `AGENTS.md` and the "Assumed Data Model" comment at the top of `firestore.rules`.
5. Decide what happens to stories already in the live database without the field: either the code treats it as optional, or a one-off script updates them (the rules would have to allow that update).

## Recording (`src/RecordStory.jsx`, `src/useRecorder.js`, `src/LiveWaveform.jsx`)

- `RecordStory` is a small state machine over `step`: `name` → `story` → `review`, with `tooLong` or `overSet` when the story doesn't fit, and `edit` for the editor.
The step number shown (1 to 3) is derived from it.
- `useRecorder` wraps `MediaRecorder`: start, pause, resume, stop, a 100 ms timer, and clean-up of the microphone if the screen closes mid-recording.
`stop()` resolves to `{ blob, duration }`.
- The format comes from `src/audio.js`: AAC in MP4 when the browser supports it (every iPhone and modern Chrome), otherwise WebM or Ogg with Opus, at 64 kbps.
- `wakeAudio()` (in `LiveWaveform.jsx`) creates the app's single `AudioContext`.
It must be called synchronously inside a tap handler, before any `await`, or iPhones keep audio suspended.
- The name clip must be under 1:00, and the name plus story under 5:00 and within the set's room.
Both clips of a story must be in the same format, because they're stored as one byte stream with one `type`.

## Playback (`src/ClipPlayer.jsx`)

- `ClipPlayer` plays a list of clips back to back as if they were one recording: a story is `[name, story]`, a set is every story's clips in order.
- **Pass the same `clips` array on every render** (from `useMemo` or a ref), or the player rebuilds its URLs and restarts.
`StoryLibrary` keeps its arrays in refs for this reason.
- Only one player plays at a time: a module-level `current` remembers the playing player, and starting another pauses it.
- Two looks: the full player (play button, label, progress bar) and `compact` (a story row).

## The story editor (`src/StoryEditor.jsx`, `src/audioEdit.js`)

- An edit is just a description over the original recording, in seconds: `{ trimStart, trimEnd, shortenPauses, cuts, speedups }`.
Nothing is processed until the preview plays or the story is saved, so every change is free to undo.
- `findPauses()` finds quiet stretches of 1.5 seconds or more, with a threshold computed from the recording itself.
Shortening keeps half a second of each.
- `planSegments()` turns the edit into the kept parts and their playback rates.
`plannedLength()` gives the new length instantly, without rendering.
- `render()` cuts and joins the parts with 10 ms fades and time-stretches sped-up parts with SoundTouch (`soundtouchjs`, pitch kept).
`encodeMp3()` encodes with LAME (`wasm-media-encoders`) at 64 kbps.
Both libraries load only when needed (dynamic `import()`).
- Saving re-encodes **both** clips to MP3, so the name clip and the story stay in one format.
- The editor is used in three places: during recording (`RecordStory`, step `edit`), and for saved stories (`EditStory`).
It takes `maxLength` and `limitText` so the caller decides the limit: 5:00, or less if the set has less room.
A 100 ms safety margin (`SAFETY`) covers rounding when saving.

## Styling (`src/styles.css`)

- One stylesheet.
Colors are CSS custom properties defined once on `:root`, then redefined for dark mode under `@media (prefers-color-scheme: dark)`.
Never use a literal color in a rule; add a token if one is missing.
- `.tint-happy`, `.tint-challenging`, `.tint-done` and `.tint-over` set `--tint-bg`, `--tint-fill` and `--tint-text` for a set's card, bars and text.
`tintClass()` in `src/stories.js` picks the right one.
- The computer layout is one block at the end: `@media (min-width: 60rem)` (960 px).
`.desktop-hidden` and `.desktop-only` show or hide elements per layout.
- Icons are small inline SVG components in `src/icons.jsx`, using `currentColor`.
- See [design.md](design.md) for the visual rules.

## Pitfalls

- **React StrictMode** runs effects twice in development.
Every effect must clean up after itself (the existing ones use a `cancelled` flag or return a clean-up).
- **iPhone audio**: start audio only from a tap, call `wakeAudio()` before any `await`, and preload audio before the tap that plays it.
- **The microphone needs HTTPS** on any device other than `localhost`; that's what `npm run dev:mobile` is for.
- **Batch limits**: a Firestore request is at most 10 MiB and 500 writes, which bounds what one batch can hold.
- **Rules changes** are live in the emulator as soon as you save `firestore.rules`, but reach the live database only when deployed.
- **Firestore Lite** has no `onSnapshot`; don't import from `firebase/firestore` (the full SDK) without a reason, it's much larger.

## Testing

There are no automated tests or linter yet.
Check every change by using the app with `npm run dev:local`:

- On a phone-sized window (about 390 × 844) and a computer-sized one (1280 × 900 or wider).
- In light and dark mode.
- For recording in an automated Chromium, launch it with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` so it gets a fake microphone without a permission prompt.
- When the data model or rules change, the seed is a quick check: `npm run dev:local` fails if the rules reject the sample stories.

Good first additions would be unit tests for `src/stories.js` and `src/audioEdit.js`'s planning functions (Vitest fits Vite), and rules tests against the emulator with `@firebase/rules-unit-testing`.
