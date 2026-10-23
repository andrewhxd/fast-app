# FASTapp

A prototype of the Familiar Auditory Sensory Training (FAST) app.
Family members record personal stories for a loved one with a disorder of consciousness, in 4 story sets of about 10 minutes each (2 happy, 2 challenging), which are later played to the patient.

- **Live app:** https://fast-app-cs499.web.app
- **Design canvas** (every screen on phone and computer, the design decisions, and space for the account and admin designs to come): https://claude.ai/artifact/CquXcpcqKMESpw2XEK8N9W
- **UI guide** (an annotated walkthrough of each screen): https://claude.ai/artifact/PTAsrDbXoU1zTCmvN1wXZq

## What works

- Record a story in 3 steps: the patient's name said 3 times, the story (up to 5:00, counting the name), then its details.
- Track each set toward its 9:00 to 11:00 target.
- Fix a story that runs long with a simple editor: trim the ends, shorten long pauses, or speed up or cut a part.
- Listen to whole sets or single stories, and move or swap stories between sets of the same kind.
- Works on phones and on computers (with a sidebar layout at 960 px and wider), in light and dark mode.

Sign-in, admin accounts, clinician approval and playing sessions to the patient are not built yet.
Until sign-in exists, anyone with the link can see and delete stories, so don't record real patient names or real family stories.

## Run it

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev:local   # then open http://localhost:5173
```

`npm run dev:local` runs the app against a Firestore emulator on your computer, filled with sample stories, so you can record, edit, move and delete freely.
It needs Java 21 or newer.
The local data resets each time you stop it (Ctrl+C), and the emulator's own UI at http://127.0.0.1:4000 shows what's in the database.

`npm run dev` runs the app against the shared live database instead, the one https://fast-app-cs499.web.app uses.
To try it on a phone, run `npm run dev:mobile` and open the `Network: https://...` address it prints (phones only allow the microphone over HTTPS); this also uses the live database.

## Use your own Firebase project

To run a fork on your own Firebase project:

1. Create a project in the [Firebase console](https://console.firebase.google.com), add a web app to it, and create a Cloud Firestore database (Standard edition).
2. Copy `.env` to `.env.local` and fill in your web app's config.
`.env.local` isn't committed and overrides `.env`.
3. Deploy the security rules and the app:

```bash
npx firebase login
npm run build
npx firebase deploy --only firestore,hosting --project your-project-id
```

The free Spark plan is enough.

## Built with

React, Vite and Firebase (Cloud Firestore and Hosting).
The story editor uses [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) (LGPL-2.1) and [wasm-media-encoders](https://github.com/arseneyr/wasm-media-encoders) (MIT, with the LGPL LAME encoder).

## For contributors and coding agents

Project details (rules, data model, security rules, code map, deploy steps and working conventions) are in [AGENTS.md](AGENTS.md).
`CLAUDE.md` is a symlink to the same file.
