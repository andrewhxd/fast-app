# FASTapp: notes for coding agents

This is the single source of project instructions for coding agents (Codex, OpenCode, Claude Code and others).
`CLAUDE.md` is a symlink to this file, so edit only `AGENTS.md`.

FASTapp is a prototype of the Familiar Auditory Sensory Training (FAST) app described in the class project doc.
Families record personal stories, grouped into 4 story sets, that are later played to a patient with a disorder of consciousness.
It is a React 19 + Vite 7 web app built for phones, with a simple layout for computers, and it stores everything in Firebase (Cloud Firestore).

- **Live:** https://fast-app-cs499.web.app
- **Design canvas** (every screen, design decisions, and space for future designs): https://claude.ai/artifact/CquXcpcqKMESpw2XEK8N9W
- **UI guide** (annotated walkthrough of the screens): https://claude.ai/artifact/PTAsrDbXoU1zTCmvN1wXZq

The two claude.ai links may not open for every agent; everything they contain that matters for the code is written down in `docs/`.

## Start here

This file has the rules of the project and the facts you need for most changes.
For more depth, read the doc that fits the task:

| Doc | Read it when |
| --- | --- |
| [docs/requirements.md](docs/requirements.md) | You need to know what the app must do. It summarizes the class project doc (the PDF isn't in this repo), with what's built and what isn't. |
| [docs/architecture.md](docs/architecture.md) | You're changing code: navigation, data flow, storage, recording, playback, the editor, styling, pitfalls, how to change the data model, and how to test. |
| [docs/design.md](docs/design.md) | You're changing anything people see: the look, colors, layout, wording, and the reasons behind each design decision. |
| [docs/roadmap.md](docs/roadmap.md) | You're building something new: what's left, in order, with suggested approaches. |

### How to work on a task

1. Read the relevant docs above and the code you'll touch.
2. Run `npm install`, then `npm run dev:local` to work against a local emulator with sample stories.
3. Make the change in the style of the code around it.
4. Check it in the browser at phone width and at 1280 px, in light and dark mode (see [Testing](docs/architecture.md#testing)).
5. Run `npm run build` to be sure it builds.
6. Update the docs the change affects: this file, `docs/`, `README.md`, and the comment at the top of `firestore.rules` if the data model changed.
7. Stop any dev server you started.
Deploy only when asked, following the safety rules below.

## Working rules

These apply to every change.

### Writing style

- Never use em dashes, in code, comments, UI copy or docs.
Use plain dashes, commas or separate sentences instead.
- In long Markdown files, put each full sentence on its own line.
Keep normal Markdown structure (lists, headings, code blocks).
- Write code that reads like the code around it: match its comment density, naming and idioms.

### Git

- Never add an AI co-author or attribution to commits (no `Co-Authored-By: Claude ...` or similar lines).
Commits are authored by the repository owner only.
- Never edit `CHANGELOG.md` or any file marked as auto-generated.

### Engineering

- Prefer quality, simplicity, robustness and long-term maintainability over saving development time.
- Fix bugs by first reproducing them end to end, the way a user would hit them, so the fix addresses the real problem.
- When testing the UI, be picky: check phone width, a computer window (960 px and wider), and dark mode, and fix anything that clearly looks off.
- Kill any dev server or background process you started (for example `npm run dev`) before you finish.

### Data and Firebase safety

- The app has two Firebase projects: `fast-app-cs499` (live) and `fast-app-cs499-dev` (dev, for testing branches; alias `dev`).
They share nothing: each has its own database, accounts and site.
Never deploy rules, hosting or anything else to `fast-audio-playback-demo`, which is a separate audio recorder demo that this app grew out of.
- Every deploy names its project (`--project fast-app-cs499` or `--project dev`); never run a bare `firebase deploy`.
Try changes on the dev project (`npm run deploy:branch` or `npm run deploy:dev`) before the live one, and deploy to the live project only when asked.
Before a live deploy, confirm the target really is `fast-app-cs499`.
With the Firebase MCP server, change the project directory and the active project in two separate calls, then check `firebase_get_environment` again: setting both in one call once deployed this app's rules to the wrong project.
- Test with `npm run dev:local`, which uses a local Firestore emulator with sample stories and can't reach live data.
`npm run dev` and `npm run dev:mobile` use the live database, so deleting a story there deletes it for everyone.
The live project still runs the version from before sign-in (its rules, its data, and no sign-in providers), so this code only works there once it's moved over (see [docs/roadmap.md](docs/roadmap.md)); until then use `npm run dev:local` or `npm run dev:remote`.
When cleaning up test data on the live database, delete only stories titled `... (delete me)`.
Keep the owner's own test story "Hello Hi Test".

## The FAST rules

These come from the project doc ([docs/requirements.md](docs/requirements.md)) and were confirmed by the project owner, so don't change them without asking.

- There are exactly **4 story sets**: Happy set 1, Happy set 2, Challenging set 1 and Challenging set 2 (doc slides 10, 11 and 21).
- A story can be any length up to **5:00, counting the patient's name** said 3 times at its start.
- A set holds any number of stories that add up to **9:00 to 11:00**.
- Stories move only between sets with the same affect (happy or challenging).
- Randomness belongs to playback, which is not built yet: 4 sessions a day, at least 2 hours apart, each playing a random set not yet played that day, with the stories in a set in random order, for 168 sessions in all (slides 22 and 23).
- Open question: the slide 10 scenario gives happy sets 9:45 to 10:15, while the user stories (slides 11 and 19) say 9:00 to 11:00.
The app uses 9:00 to 11:00 for all 4 sets until the client says otherwise.

The limits live in `src/stories.js` (`STORY_MAX`, `SET_MIN`, `SET_MAX`, `NAME_MAX`) and are mirrored in `firestore.rules`.
Change both together.

## Commands

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev:local    # http://localhost:5173, against local Firestore and Auth emulators with demo accounts and stories
npm run dev          # http://localhost:5173, against the live database
npm run dev:mobile   # HTTPS on the local network, for testing on a phone (live database)
npm run dev:remote   # http://localhost:5173, against the dev Firebase project
npm run build        # production build into dist/, for the live project
npm run deploy:dev   # build for the dev project and deploy it to https://fast-app-cs499-dev.web.app
npm run deploy:branch # build for the dev project and deploy it to a 7-day preview address named after the branch
npm run test:rules   # the security rules tests (tests/rules.test.js), against the Firestore emulator
```

`npm run dev:local` starts the Firestore and Auth emulators (project `demo-fast-app`, with the real `firestore.rules`), runs `scripts/seed.js`, then starts Vite in `emulator` mode.
It needs Java 21 or newer.
Ctrl+C stops all of it, and the local data resets on the next start.
The Emulator UI at http://127.0.0.1:4000 shows the local database and accounts, and the links in emails Firebase would have sent.
The seed writes through the security rules, the way the app does, so a data model change the rules reject makes it fail.

Phones only allow the microphone over HTTPS.
`npm run dev:mobile` prints a `Network: https://...` address for a phone on the same Wi-Fi; its certificate is self-signed, so tap through the warning the first time.

The security rules have tests (`npm run test:rules`); there is no other test suite or linter yet.
Check changes by running the app with `npm run dev:local` and using it.

### Deploy

Only people added to the Firebase project can deploy.
The Firebase CLI is a dev dependency, so `npx firebase` uses the version in `package-lock.json`.

Try changes on the **dev project** first (`fast-app-cs499-dev`, https://fast-app-cs499-dev.web.app).
It has its own database, accounts and site, so nothing there touches the live app:

```bash
npm run deploy:dev
```

For a branch, `npm run deploy:branch` gives it a temporary address of its own on the dev project (a preview channel named after the branch, for 7 days), without replacing the dev site.
Put that address in the pull request.
A preview channel shares the dev project's database and rules, so a branch that changes `firestore.rules` or `firestore.indexes.json` needs `npm run deploy:dev` too, which changes them for everyone using the dev project.

The **live project**, only when asked:

```bash
npm run build
npx firebase deploy --only firestore,hosting --project fast-app-cs499
```

`npm run build` must be the last build before a live deploy: `dist/` from `npm run build:dev` points at the dev project.

## What the app does

- **Sign in**: "Continue with Google", or "Continue with email" (sign in, create an account, or reset the password).
A new email account gets an email to confirm its address, which it needs before joining a care team.
- **Care teams** (a "group" in the code, a "treatment" in the project doc): one patient's care team.
Someone with no care team starts one by entering their loved one's name, and becomes its **lead caregiver** (the group's owner).
Everyone else is a **member**, who can record, listen to, edit and move the team's stories, and leave the team.
For now there are only these two roles; the doc's administrator, clinician, storyteller and player levels aren't built.
- **Care team screen**: the lead caregiver, the family and friends, and (for the lead caregiver) invites not yet accepted.
The lead caregiver invites someone by email address, gets a link to send from their own phone (Share or Copy), and can copy an invite's link again, cancel it, or remove a member.
- **Invite links** (`?group=<groupId>&invite=<inviteId>`) open a join screen after signing in: who invited you to whose care team, and **Join**.
Only someone signed in with the invited email address, confirmed, can use it, and joining uses it up.
- **Your care teams**: switch between the care teams you're on, or start another.
The current one is in the URL as `?group=<groupId>`; without it the app opens the one used last on that device.
- **Home**: whose care team it is, how many of the 4 sets are ready, a bar per set in its color, and what to do next (e.g. "Happy set 2 needs about 3 more minutes").
Set totals and the Listen screen include only the current care team's stories.
On a phone, **Menu** (top right) shows your account and opens Home, Record a Story, Listen to Stories, Care team, Your care teams and Sign out.
- **Record a story**: pick a set; each shows its stories, total and time left to go, with a bar from 0:00 to 11:00 and the 9:00 to 11:00 target shaded.
A set in range shows "Ready" and can't take more stories.
- **Recording a story**, in 3 steps (shown under the set's name at the top):
  1. Record the storyteller saying the patient's name 3 times.
  2. Record the story.
The timer continues from the name clip, so it shows the whole story's length toward 5:00, and turns yellow at 4:30.
When the set has less than 5:00 of room left, the bar marks where the set is full and says how long until then.
Finish waits a second after starting, so a double tap can't end the recording.
  3. Listen back, enter the title, storyteller, relationship and affect, then **Add story** or **Delete recording**.
An **Edit** button opens the story editor.
- **Too long, or doesn't fit**: a story over 5:00, or one that would take its set over 11:00, offers **Edit to fit** (recommended) or **Record it again** (keeping the name clip).
- **Story editor**, from "Edit to fit", the Edit button on the details step, or a saved story's ⋯ → Edit:
  - A readout shows the length with the name before and after ("5:21 → 4:58") and whether it fits.
  - **Trim** the start and end by dragging the purple handles on the waveform (or with the arrow keys).
  - **Shorten long pauses**: one switch shortens every silence over 1½ seconds to half a second.
  - **Speed up or cut a part**: drag across part of the waveform, then play it at 1.1× or 1.2× (the voice keeps its natural pitch) or cut it.
  - **Play** the edited story before saving; **Undo all changes** starts over.
  - Saving processes the audio in the browser and stores the story as MP3.
An edited saved story replaces the old one in one step, so it's never half saved.
- **Listen**: every set under Happy events and Challenging events, each with a whole-set player, its target status, and its stories.
Each story's **⋯** opens **Edit**, **Move** and **Delete** (asks first).
**Rearrange** (top right) or **Move**: tap a story, then a story in the other set with the same affect to swap them, or **Move here**.
A move or swap is only offered when both sets stay at or under 11:00.
Only one player plays at a time, and every story's audio downloads in the background when the screen opens, so play starts right away.
- The phone's back button moves between screens.

### On a computer

In a window at least 960 px wide (`@media (min-width: 60rem)` in `src/styles.css`), a sidebar on the left replaces the Menu and Back buttons.
Home also shows the 4 sets, each with its own Record button, and the sets sit in two columns, happy beside challenging.
Recording and editing use a narrower, focused page (42rem), and the sidebar is locked until the story is finished or canceled.

### Design

"Soft Modern": flat pastel cards with soft shadows, pill buttons, plenty of space, and the Figtree typeface (bundled with the app, so it works offline).
The colors carry meaning: peach for happy stories, sky blue for challenging stories, mint for a set in range, indigo for actions, and red for recording and deleting.
It follows the system's light or dark setting, with both palettes defined once at the top of `src/styles.css`.
Buttons are at least 44 px tall.
The design canvas linked above has every screen on phone and computer, the reasoning behind each decision, and the accounts screens as built (sign-in, care teams and invites).
[docs/design.md](docs/design.md) has the same decisions in writing, plus the color meanings and wording rules.

## Not built yet

[docs/roadmap.md](docs/roadmap.md) has suggested approaches for each of these.

- Access levels beyond lead caregiver and member: administrator, clinician, storyteller (editing only their own stories) and player (doc slides 4 and 6), handing over the lead, renaming or deleting a care team, and invites that expire.
- The setup questions about a clinician (slide 3).
- The eligibility survey.
- Editing a story's title, storyteller or relationship after it's saved.
- Clinician comments and approval, and automatically regrouping stories to fit the targets.
- Playing story sets to the patient, the checklists, progress tracking and reminders.

## Firebase

- **Project:** `fast-app-cs499` ("FAST app"), on the free Spark plan.
- **Web app:** "FASTapp".
Its config is in `.env`; it identifies the project and is not a secret.
- **Authentication:** Firebase Authentication with the Google and Email/Password providers (both free on Spark).
They must be turned on in the Firebase console before the sign-in screen works on the live site.
- **Database:** Cloud Firestore, Standard edition, location `nam5`, used through Firestore Lite (one-off reads and writes, no live listeners).
- **Hosting:** https://fast-app-cs499.web.app (serves the `dist` build).
- **Dev project:** `fast-app-cs499-dev` ("FAST app dev", alias `dev` in `.firebaserc`), at https://fast-app-cs499-dev.web.app, with the same rules, indexes and sign-in providers, and its own data.

### Configuration

`src/firebase.js` reads the Firebase config from Vite environment variables (`VITE_FIREBASE_*`).
- `.env` (committed): the shared `fast-app-cs499` project, used by `npm run dev`, `npm run dev:mobile` and `npm run build`.
- `.env.dev` (committed): the dev project, for `npm run build:dev`, `npm run deploy:dev` and `npm run dev:remote` (Vite's `dev` mode).
- `.env.local` (not committed): a fork's own project, overriding `.env`.
- `.env.emulator` (committed): `npm run dev:local`, with project `demo-fast-app` and `VITE_FIRESTORE_EMULATOR` and `VITE_AUTH_EMULATOR` set, which connect to the emulators and add "(local)" to the page title.
It takes priority over `.env.local`, so local runs never reach a real project.

The emulators' ports are in `firebase.json`.
The seed's demo accounts (`ann@`, `jeff@` and `mia@example.com`, password `password`) are listed in the README.
The README explains how to run a fork on its own Firebase project.

### Data model

```
groups/{groupId}                         id, name (the patient's), ownerId (the lead caregiver), createdAt, updatedAt
groups/{groupId}/members/{uid}           uid, name, email, joinedAt, invite (the invite accepted, if any)
groups/{groupId}/invites/{inviteId}      email, groupName, invitedBy, invitedByName, createdAt
treatments/demo/stories/{id}             title, storyteller, relationship, affect, setNumber,
                                         group, nameDuration, storyDuration, type, nameSize, size,
                                         chunkCount, createdAt
treatments/demo/stories/{id}/chunks/{i}  data: up to 1 MB of audio
```

A group is one patient's care team.
Group IDs use lowercase letters, numbers and hyphens; the app makes 20 random ones, and the seed uses `default`, `family-a` and `family-b`.
A group and its owner's member document are created in one batch, and joining writes the member document and deletes the invite in one batch.
Each person finds their groups with a collection group query on `members` by `uid`, which needs the index in `firestore.indexes.json` (the emulator doesn't, so only a real project shows it missing).
Every story names its group in `group`, and `listStories(groupId)` queries `where('group', '==', groupId)`.
Stories saved before groups existed (on the live database) have no `group` and can't be read until a one-off update gives them one.

Cloud Storage needs the paid Blaze plan, so the audio is stored in Firestore, split into 1 MB chunk documents.
The name clip and the story clip are stored back to back, and `nameSize` says where to split them.
Durations are in milliseconds and are measured while recording, because some browsers save recordings without a readable length.
Every time shown for a story or a set includes the story's name clip, since the patient hears it too, and the 5:00 limit counts it as well.

Audio is recorded at 64 kbps, so a 5 minute story is about 2.4 MB (the limit per story is 5 MB).
A full treatment (4 sets of about 10 minutes) is roughly 20 MB, so the free 1 GiB holds dozens of treatments.

### Security rules

Every request must be signed in.
Only a group's members can read the group, its members and its stories, and save, move or delete its stories.
Only the owner creates, lists and cancels invites, and removes members; the owner can't leave or be removed.
Nobody can add themselves to a group except by starting it or accepting an invite for their own confirmed email address.
Stories keep the earlier checks: every field with the right type and limits (including the 5:00 story limit, counting the name clip), saved and deleted only together with all of their audio, and the only edit is moving a story (`setNumber` between 1 and 2).
Everything else is denied.
`npm run test:rules` checks all of this; add a test with every rules change.

## Code map

[docs/architecture.md](docs/architecture.md) explains how these fit together.

- `src/App.jsx`: the menu, and moving between screens (each screen is a browser history entry).
- `src/NavBar.jsx`: the top bar with its text buttons.
- `src/Sidebar.jsx`: the sidebar shown on a computer.
- `src/Home.jsx`: the home screen.
- `src/StorySets.jsx`: the Record a story screen, the set cards (also on Home on a computer), and the set progress bar.
- `src/RecordStory.jsx`: the recording steps and the too-long screens.
- `src/useRecorder.js`: records one clip from the microphone, with pause and a timer.
- `src/LiveWaveform.jsx`: the live volume bars shown while recording.
- `src/StoryEditor.jsx`: the story editor screen; `src/EditStory.jsx` opens a saved story in it.
- `src/audioEdit.js`: the editing engine: decoding, finding pauses, the edit plan, time-stretching (SoundTouch) and MP3 encoding (LAME).
- `src/StoryLibrary.jsx`: the Listen screen: play, rearrange, move and delete stories.
- `src/ClipPlayer.jsx`: plays several clips back to back as one, as a full player or a compact row.
- `src/audioCache.js`: keeps loaded audio in memory so replays don't download again.
- `src/stories.js`: the FAST rules (9:00 to 11:00 per set, 5:00 per story, relationships) and time formatting.
- `src/auth.js`: signing in and out (Google, email and password), the `useUser()` hook, and friendly sign-in error messages.
- `src/group.js`: care teams in Firestore: listing yours, starting one, members, invites, joining, removing and leaving.
- `src/SignIn.jsx`: the sign-in screen (with its welcome panel on a computer).
- `src/JoinGroup.jsx`: the screen an invite link opens.
- `src/CareTeam.jsx`: the Care team screen and the Invite someone screen.
- `src/CareTeams.jsx`: the Your care teams and Start a care team screens.
- `src/storage.js`: saves, lists, loads, moves, swaps, replaces (after an edit) and deletes stories in Firestore.
- `src/firebase.js`: connects to Firebase with the config from the `.env` files, or to the emulator.
- `src/audio.js`: picks a recording format the browser supports.
- `src/icons.jsx`: the small inline icons.
- `src/styles.css`: the stylesheet, with light and dark colors defined once at the top and the computer layout at the end.
- `scripts/seed.js`: fills the local emulators with demo accounts, care teams, invites and sample stories (the ones in the design canvas), with generated voice-like WAV audio.
- `firestore.rules`: the security rules, which are also the data model's schema.
- `tests/rules.test.js`: the security rules tests.
- `docs/`: onboarding docs (requirements, architecture, design, roadmap).

## Third-party audio code

The story editor uses [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) (LGPL-2.1) to speed up speech without changing its pitch, and [wasm-media-encoders](https://github.com/arseneyr/wasm-media-encoders) (MIT, containing the LGPL LAME encoder) to save MP3.
Both load only when the editor is used.
