# FAST requirements

This is a summary of the class project doc, "Familiar Auditory Sensory Training (FAST), App development project" (July 2026, 27 slides).
The PDF itself isn't in this repo, so this file is the reference for what the app has to do.
Slide numbers point to the PDF for anyone who has it.

Status markers: **Built**, **Partly built**, **Not built**.

## Goal and people (slides 1 and 2)

FAST is a sound-based therapy for people with a disorder of consciousness (for example after a brain injury).
Family members record personal stories, which are played to the patient through earbuds several times a day.
The app should run on iOS and Android and give clinicians, rehab specialists and family caregivers one tool to manage the therapy and track progress.

| Person | What they do in the app |
| --- | --- |
| Lead caregiver | Sets up the treatment, invites people, manages access. |
| Family members / caregivers | Record, listen to and edit stories; play story sets to the patient. |
| Clinician / rehab specialist | Assesses whether the patient qualifies, reviews and approves stories. |
| Researcher (optional) | Reviews the collected data. |
| Patient | Listens. Never uses the app. |

A "treatment" is one patient's whole course of therapy: its people, its 4 story sets and its playing sessions.

## Setup and administration (slides 3 to 6) - Partly built

Built: sign-in with Google or email and password (with password reset), starting a care team (a "group" in the code), invite links tied to an email address, the list of people and pending invites, and removing people.
There are only two roles so far: the lead caregiver, who owns the group, and members, who can do everything else.
Not built: the other access levels, the clinician questions, handing over the lead, and emailing invites from the app.

- The lead caregiver starts a treatment and enters their name, email, the patient's first and last name, and their relationship to the patient (caregiver or clinician).
- A caregiver is asked whether a clinician will take part.
If yes, they enter the clinician's name and email, and the clinician is emailed to create a login, complete the assessment survey and create the treatment.
If no, the lead caregiver completes the assessment survey and plays the clinician's role.
- The lead caregiver invites family members by email and grants each one an access level:
  - Administrator: the administration duties, plus record, listen, edit and play.
  - Clinician: the clinician duties, plus record, view, listen, edit and play.
  - Record, view, listen and edit stories.
  - Play stories.
- The lead caregiver sees who was invited, who has created an account, and what access each person has, and can change or remove access.
- Invited people accept the invite, create an account with their email as the username and a password, and can reset the password.
- The lead caregiver can hand the lead role to someone else and can change the clinician.
- Slide 6 sketches the Administration screen: the lead caregiver, the clinician and the caregivers, each with Edit, pending invites marked "Pending", and an Add/edit user form (email, first name, last name, access).

## Qualification survey (slides 7 to 9) - Not built

The clinician (or the lead caregiver if there is no clinician) answers a survey before any recording starts.
If the patient doesn't qualify, no treatment can be created.

1. Hearing impairment before the injury?
   - If yes: which ears (both, left or right), and did they wear a hearing aid?
   With a hearing aid, add a reminder to the pre-session checklist to put it in.
   Not eligible if they couldn't hear people speaking (with the aid, or without one if they had none).
2. Any hearing test after the injury (for example ABR/BAEP Wave I, cortical AEP/N100, MMN, P300)?
   - If tested: did it show a hearing impairment?
   The doc's branches here read "Yes: continue" and "No: not eligible", which looks inverted; confirm with the client before building it.
   - If not tested: they must show at least one of: startle to loud noise, move toward sound or voice, open eyes to sound, observable response to at least one auditory stimulus.
   Otherwise not eligible.
3. Signs of conscious awareness: can the patient consistently answer questions about the room, or show how to use a familiar object (a comb, a toothbrush, kicking a ball)?
   If yes to either, the patient seems aware, and FAST is meant for patients with less awareness.
   They may proceed, but the app recommends discussing other treatments with the care provider.
4. When awake, which of these does the patient do (check all that apply)?
   - Opens eyes spontaneously.
   - Opens eyes to arousal stimulation (shaking, calling their name).
   - Does something they were told to do with their body.
   - Makes an intentional movement (scratching, moving clothing, adjusting position).
   - Turns head or body toward a sound or voice.
   - Makes sounds on their own or in response.
   - Moves more, shows more facial activity or voice when touched or talked to.

   At least one: create the treatment.
   None: recommend starting when the patient wakes up, and re-checking in 3 to 7 days.

## Recording personal stories (slides 10 to 17) - Built, except approval

Scenario (slide 10):
- The clinician helps pick storytellers who saw the patient routinely for at least a year before the injury, and events the patient found meaningful, balanced between happy and challenging (or neutral).
Photos of the events help but aren't required.
- Each storyteller drafts stories from their own point of view, with descriptive language (sights, smells, sounds, touch), and practices telling them in their natural voice in a quiet room.
- Each story starts with the storyteller calling the patient's name 3 times, using the name the patient knew them by.
- The target is **2 sets of happy stories and 2 sets of challenging stories, each about 10 minutes, and no story over 5 minutes**.
- After recording, the storyteller adds a title, their name and their relationship to the patient.
- The clinician reviews the stories and may ask for edits or re-recordings.
Once the clinician approves them, the sets are locked and ready to play.

User stories (slide 11), all built unless marked:
- Read instructions on how to record. **Partly built** (short hints on each screen; no instructions screen).
- Record the patient's name 3 times before each story.
- Record stories into 2 happy sets and 2 challenging sets of 9:00 to 11:00 each.
- See each set's progress toward 9:00 to 11:00.
- Be told when a story is over 5 minutes, and choose to delete and re-record or edit it.
- Play back what was just recorded.
- Delete and add segments to a recording. **Partly built**: the editor cuts and speeds up parts but can't add new audio into a story.
- Add a title, storyteller name, relationship (Mother, Father, Sister, Brother, Aunt, Uncle, Cousin or Friend) and affect (happy, or challenging/neutral).
- If a story would take its set over 11:00, choose to re-record or edit it, after seeing the time left in the set and the story's length.
- Once all 4 sets are complete, a clinician does a final review and approves them, after which nothing can be edited. **Not built.**

Screens (slides 12 to 17):
- The recording timer bar is green until 4:30, yellow from 4:30, and red at 5:00 (slide 14).
- The editing reference is the iPhone Voice Memos editor (slides 15 and 16).
The app deliberately has a simpler editor; see [design.md](design.md).
- Slide 17's approval checklist, shown only to people with clinician authority:
  - Stories are about events that include the storyteller and the patient.
  - Storytellers interacted with the patient regularly for a year before the injury.
  - The language matches the language used during the event.
  - One storyteller per story.
  - Stories are told from the storyteller's perspective.
  - Stories use very descriptive and simple language.
  - Approving locks the stories; they play as recorded.

## Viewing, listening and editing (slides 18 to 21) - Built, except comments and auto-regroup

- See the stories in each set, and where each set stands against 9:00 to 11:00.
- Listen to a whole set or one story.
- Edit or delete a story.
If an edit makes a set too long, go to its list of stories to pick one to edit; if too short, go back to recording.
- Move stories between sets with the same affect.
- The clinician can review stories and give comments. **Not built.**
- "Regroup stories by affect", where the system builds sets that fit the target automatically. **Not built.**

## Playing story sets to the patient (slides 22 to 27) - Not built

Scenario (slide 22):
- Playing unlocks once all 4 sets are complete and approved.
- Before each session, out of the patient's hearing, the caregiver completes a pre-session checklist, including a comfortable volume.
They tell the patient stories are coming, put sound-dampening earbuds in, close the door, make the room quiet, step out of the patient's view and make sure the patient's eyes are open.
- One set plays, chosen at random, and playback stops by itself at the end.
Then the earbuds come out and the caregiver completes a post-session checklist.
- **4 sessions a day, at least 2 hours apart, never repeating a set in a day.**

User stories (slides 23 and 24):
- See instructions for playing (room, where to stand, and so on).
- See how many of the 4 sets were played today, how many sessions in total, and how many days all 4 were played.
- Pre-session checklist before every session:
  - If the survey recorded a hearing aid: "Is the hearing aid or accommodation in place?" (must be yes to continue).
  - Which awake behaviors the patient shows (the 7 behaviors from survey question 4).
  If none, suggest coming back in an hour or trying to wake them, but still allow continuing.
  - A sound check.
  - The room is quiet (door closed) and nobody is in view.
- Stories within a set play in random order.
Sessions repeat daily until **168 sessions** (4 a day for 42 days).
The first session of a day picks 1 of the 4 sets at random, the second 1 of the remaining 3, the third 1 of the remaining 2, and the fourth plays the last one.
- Post-session checklist after every session: compared to before, does the patient show More, Less or the Same of each of 9 behaviors (the 7 from question 4, plus answering questions about the room and showing how to use an object)?
Then "Did your loved one become agitated?"
If yes, prompt them to consider stopping and to re-assess weekly.
- A reminder to play the next set 2 hours after the previous one finished.
- Starting a session less than 2 hours after the last one shows a warning, but they may proceed rather than miss it.
- See how long the playing set has left, or that it's done.
- Record who played each set, the date and time, and which set.

Screens (slides 25 to 27):
- Home shows "0 of 168 complete", "N days - 4 stories played" and "N of 4 today", with the play options disabled until the sets are approved.
- The pre-session checklist has two screens: the checklist items (sound test completed, room prepared, patient told, earbuds in) with the Play button greyed out until all are checked, then the awake behaviors.
- While playing: "Playing Happy story set 1" with a progress bar and time.
- The post-session checklist: each behavior with More, Less or Same.

## Post-treatment survey and research data (slide 2) - Not built

Slide 2 lists "Complete post treatment survey" and "Review data" (researcher) as use cases, with no further detail in the doc.

## Open questions for the client

- **Happy set range.** Slide 10 says happy sets should be 9:45 to 10:15, while slides 11 and 19 say 9:00 to 11:00.
The app uses 9:00 to 11:00 for all 4 sets (`SET_MIN` and `SET_MAX` in `src/stories.js`).
- **Survey question 2 branches** look inverted (see above).
- **Post-treatment survey** and **researcher data review** have no details yet.
- **Platform.** The doc asks for iOS and Android; the prototype is a web app that works in phone browsers.
