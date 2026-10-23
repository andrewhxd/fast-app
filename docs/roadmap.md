# Roadmap

What's left to build, in a sensible order, with suggested approaches.
These are suggestions, not decisions: check with the project owner before starting a big piece, and update this file when a decision is made.
[requirements.md](requirements.md) has the full requirements for each feature.

## 1. Sign-in, treatments and access

Everything else depends on this, and until it exists anyone with the link can read and delete stories.

- **Accounts**: Firebase Authentication with email and password (slide 4: email as the username, password reset).
- **Treatments**: replace the hardcoded `demo` treatment (`TREATMENT_ID` in `src/storage.js` and `isDemoTreatment()` in `firestore.rules`) with real treatment documents.
A possible model:

```
treatments/{treatmentId}                  patient's first and last name, lead caregiver uid, clinician uid,
                                          survey answers (or a summary, e.g. hearing aid), approvedAt, createdAt
treatments/{treatmentId}/members/{uid}    email, name, access: admin | clinician | record | play, joinedAt
treatments/{treatmentId}/invites/{id}     email, access, invitedBy, createdAt
treatments/{treatmentId}/stories/...      as now, plus who recorded each story
```

- **Rules**: every read and write checks membership and access with `get()` on `members/{request.auth.uid}`.
Only the lead caregiver (or an admin) changes members and access, and nobody can raise their own access.
- **Invites by email** need something to send the email.
Firebase Auth's email link sign-in can do it on the free plan; custom invite emails need Cloud Functions or the Trigger Email extension, which need the paid Blaze plan.
- **Screens**: sign in, create account, reset password, the setup screen (slide 5), and the Administration screen (slide 6).
The design canvas has a "Coming later" area for these designs.

## 2. Qualification survey

- The survey in [requirements.md](requirements.md#qualification-survey-slides-7-to-9---not-built) gates creating a treatment.
- Keep the answers on the treatment; the pre-session checklist needs to know about a hearing aid.
- Confirm the inverted-looking branch in question 2 with the client first.

## 3. Clinician comments and approval

- Comments on a story or a set, from people with clinician access (slide 19).
- The approval checklist (slide 17), which sets `approvedAt` on the treatment.
- After approval, the rules must reject every story create, update and delete, and the interface hides recording and editing.
Decide with the client whether approval can be undone.

## 4. Playing sessions

- A session record per play, for example `treatments/{id}/sessions/{id}` with the set, who played it, start and end times, and both checklists' answers.
Progress on Home (today's sessions, days completed, 168 in all) is computed from these.
- Pick the set at random from those not yet played today; shuffle the stories within it.
Decide what "today" means (the treatment's time zone) and handle a session that's started but never finished.
- Warn when starting less than 2 hours after the last session, but allow it.
- Playback must keep going for about 10 minutes with the phone locked or the screen off.
Test this early on real iPhones and Android phones; it's the biggest technical risk for a web app.
- Reminders 2 hours after a session need push notifications (Firebase Cloud Messaging plus a scheduled function, which needs Blaze).
On iPhone, web push only works for a web app added to the Home Screen.

## 5. Smaller gaps

- Instructions screens for recording and for playing (slides 11 and 23).
- Editing a saved story's title, storyteller and relationship (the rules currently allow only `setNumber` to change).
- Adding new audio into a story (slide 11, "add segments").
- Automatic regrouping into sets that fit 9:00 to 11:00 (slides 19 and 21): a small partitioning problem, best offered as a suggestion the family confirms.
- The post-treatment survey and researcher data review (slide 2), once the client describes them.
- The happy set range question (9:45 to 10:15 or 9:00 to 11:00).

## Platform and infrastructure

- **Cloud Storage for audio** once the project moves to Blaze: store each story's audio as a file, keep only its path in the story document, and stream it instead of downloading chunks.
Storage rules would mirror the Firestore membership rules.
- **iOS and Android**: the doc asks for both.
Options are an installable web app (PWA, with offline support) or wrapping the web app with Capacitor for the app stores.
The playing-with-screen-locked and reminder requirements should decide which.
- **Tests and CI**: Vitest for `src/stories.js` and the planning functions in `src/audioEdit.js`, `@firebase/rules-unit-testing` against the emulator for `firestore.rules`, and a GitHub Actions workflow that builds and runs them.
