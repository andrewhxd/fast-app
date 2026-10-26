# FASTapp

A prototype of the Familiar Auditory Sensory Training (FAST) app.
Family members record personal stories for a loved one with a disorder of consciousness, in 4 story sets of about 10 minutes each (2 happy, 2 challenging), which are later played to the patient.

- **Live app:** https://fast-app-cs499.web.app
- **Dev app** (its own database and accounts, for trying changes): https://fast-app-cs499-dev.web.app
- **Design canvas** (every screen on phone and computer, the design decisions, and the sign-in and care team screens): https://claude.ai/artifact/CquXcpcqKMESpw2XEK8N9W
- **UI guide** (an annotated walkthrough of each screen): https://claude.ai/artifact/PTAsrDbXoU1zTCmvN1wXZq

## What works

- Sign in with Google, or with an email address and a password (with password reset and email confirmation).
- Start a care team for a patient, invite family and friends with a link, and switch between care teams.
The lead caregiver who started the team invites and removes people; everyone else can record, listen, edit and leave.
Only a care team's members can see or change its stories, which the database's security rules enforce.
- Record a story in 3 steps: the patient's name said 3 times, the story (up to 5:00, counting the name), then its details.
- Track each set toward its 9:00 to 11:00 target.
- Fix a story that runs long with a simple editor: trim the ends, shorten long pauses, or speed up or cut a part.
- Listen to whole sets or single stories, and move or swap stories between sets of the same kind.
- Works on phones and on computers (with a sidebar layout at 960 px and wider), in light and dark mode.

Separate access levels (administrator, clinician, storyteller, player), the eligibility survey, clinician approval and playing sessions to the patient are not built yet.

## Run it

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev:local   # then open http://localhost:5173
```

`npm run dev:local` runs the app against Firestore and Auth emulators on your computer, filled with demo accounts and sample stories, so you can sign in, record, edit, move, delete and invite freely.
It needs Java 21 or newer.
The local data resets each time you stop it (Ctrl+C), and the emulators' own UI at http://127.0.0.1:4000 shows the database and the accounts.

The demo accounts all use the password `password`:

| Account | Care teams |
| --- | --- |
| `ann@example.com` | Leads Sam Smith's care team (11 sample stories), with Jeff as a member and invites waiting for Mia and dave@example.com |
| `jeff@example.com` | A member of Sam Smith's care team, and leads Family A (1 story) |
| `mia@example.com` | Leads Family B (1 story); the seed prints the link to her invite to Sam Smith's care team |

"Continue with Google" opens the Auth emulator's page, where you can add any made-up Google account.
Emails (confirming an address, resetting a password) aren't sent: the links appear in the Auth tab of the Emulator UI.

`npm run test:rules` runs the security rules tests in `tests/` against the Firestore emulator.

## Test a branch online

Besides the live project, there's a **dev Firebase project**, `fast-app-cs499-dev`, at https://fast-app-cs499-dev.web.app.
It has no connection to the live one: its own database (so its own stories and audio), its own accounts and its own site.
It starts with no data; sign in with Google or make an email account, and start a care team.
Its addresses are public, so record only test stories there, never real patient or family stories.

```bash
npm run dev:remote      # run the app on your computer, against the dev project
npm run deploy:branch   # deploy your branch to its own address on the dev project, for 7 days
npm run deploy:dev      # replace https://fast-app-cs499-dev.web.app, with the rules and indexes
```

`npm run deploy:branch` names the address after your git branch and prints it; put it in your pull request so others can try the change.
Branch addresses share the dev project's database and rules.
If your branch changes `firestore.rules` or `firestore.indexes.json`, deploy them with `npm run deploy:dev`, which changes them for everyone using the dev project.

To deploy, you need to be a member of the dev project: ask the repository owner to add your Google account in the Firebase console (Project settings, Users and permissions).
Run `npx firebase login` once first.

`npm run dev` and `npm run dev:mobile` use the live project instead.
The live project still runs the version from before sign-in, so use `npm run dev:local` or the dev project until it's moved over.

## Use your own Firebase project

To run a fork on your own Firebase project:

1. Create a project in the [Firebase console](https://console.firebase.google.com), add a web app to it, and create a Cloud Firestore database (Standard edition).
In Authentication, turn on the Google and Email/Password sign-in providers.
2. Copy `.env` to `.env.local` and fill in your web app's config.
`.env.local` isn't committed and overrides `.env`.
3. Deploy the security rules, indexes and the app:

```bash
npx firebase login
npm run build
npx firebase deploy --only firestore,hosting --project your-project-id
```

The free Spark plan is enough.

## Built with

React, Vite and Firebase (Authentication, Cloud Firestore and Hosting).
The story editor uses [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) (LGPL-2.1) and [wasm-media-encoders](https://github.com/arseneyr/wasm-media-encoders) (MIT, with the LGPL LAME encoder).

## For contributors and coding agents

Start with [AGENTS.md](AGENTS.md): the project's rules, data model, commands, deploy steps and working conventions.
`CLAUDE.md` is a symlink to the same file.

More depth is in `docs/`:
- [Requirements](docs/requirements.md): what the FAST app must do, summarized from the project doc, with what's built so far.
- [Architecture](docs/architecture.md): how the code works, its pitfalls, and how to test changes.
- [Design](docs/design.md): the look, the wording, and the reasons behind the design decisions.
- [Roadmap](docs/roadmap.md): what's left to build, with suggested approaches.
