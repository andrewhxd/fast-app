# Design

The look, the words and the decisions behind the screens.
The design canvas (https://claude.ai/artifact/CquXcpcqKMESpw2XEK8N9W) shows every screen on a phone and a computer, with these decisions as notes; this file is the written version, for anyone who can't open it.

## Who it's for

The people recording are family members of a patient with a severe brain injury.
Many aren't comfortable with technology, are tired and upset, and use the app on a phone, often in a hospital.
So every screen should be calm, obvious and forgiving:

- One main thing to do per screen, with the main button easy to find.
- Plain words, and no medical or technical terms.
- Nothing irreversible without a clear warning, and nothing lost by a stray tap.

## Look: "Soft Modern"

Chosen from three rounds of options on the canvas (E+, made simpler and more modern).

- Flat pastel cards on a pale lilac-grey background, with soft shadows.
- Pill-shaped buttons, plenty of space, and generous rounded corners (cards about 24 px, rows about 18 px).
- **Figtree** for everything, bundled with the app (`@fontsource/figtree`, weights 400 to 700) so it works offline.
- Every button and tap target is at least **44 px** tall.
- Light and dark mode follow the system setting.
Every color is a token at the top of `src/styles.css`, with both palettes defined once.

### Colors carry meaning

| Meaning | Token | Light |
| --- | --- | --- |
| Happy stories and sets | `--happy-bg`, `--happy-fill`, `--happy-text` | peach |
| Challenging stories and sets | `--challenging-bg`, `--challenging-fill`, `--challenging-text` | sky blue |
| A set in range (9:00 to 11:00) | `--done-bg`, `--done-fill`, `--done-text` | mint green |
| A set over 11:00 | `--over-bg`, `--danger-text` | soft red |
| Actions (buttons, links) | `--primary`, `--primary-soft` | indigo |
| Recording and deleting | `--record`, `--danger-text`, `--danger-soft` | red |
| Story length warnings | `--ok`, `--warn` | green, amber |

Use the meaning, not just the color: a set's color comes from `tintClass()`, so it turns mint when in range wherever it appears.
Color is never the only signal; there is always text too ("Ready", "In range", "Over by 0:50").

### Layout

- **Phone** (the main target): a single column up to 28rem (448 px) wide, a top bar with text buttons (Back, Cancel, Menu), and a Menu that opens Home, Record a Story and Listen to Stories.
- Home shows a compact current-group card with a group name selector.
Choosing a group updates the `group` query parameter in the URL.
If the URL points to a group that does not exist, show the selector and a clear recovery message without showing story progress.
- **Computer** (960 px and wider): a 256 px sidebar replaces Menu and Back.
Home shows all 4 sets with their own Record buttons, and sets sit in two columns, happy beside challenging, in a page up to 64rem wide.
Recording and editing use a narrower 42rem column, and the sidebar is locked ("Finish or cancel this story to leave.") so a recording isn't lost by accident.

## Words

- Short sentences in everyday language: "Happy set 2 needs about 3 more minutes.", "Saved your edits to "Bike ride".", "Finish or cancel this story to leave."
- Say "story", "set", "storyteller" and "the patient" (or "your loved one" where it's warmer).
Never "clip", "file", "upload", "audio track" or "database" in the interface.
- Buttons say what they do: "Start recording", "Add story", "Edit to fit", "Record it again", "Move here".
- Times are always `m:ss` from `formatTime()`, and every time includes the name clip, because the patient hears it.
- Errors say what happened and what to do next ("The app can't reach the cloud. Check the internet connection and try again.").
- No em dashes anywhere (code, interface or docs).

## Decisions, and where they come from

Slide numbers refer to the project doc; [requirements.md](requirements.md) summarizes it.

- **Exactly 4 sets** (slides 10, 11 and 21): 2 happy and 2 challenging.
The family records the library once, a clinician approves it, and then it's locked.
More sets would mean more recording without matching the protocol.
- **Randomness belongs to playback** (slides 22 and 23, not built): 4 sessions a day, at least 2 hours apart, each a random set not yet played that day, with the stories in random order.
Recording has no randomness.
- **Lengths**: a story is up to 5:00 counting the name said 3 times; a set holds any number of stories adding up to 9:00 to 11:00.
The app checks both while recording, and the database rules check the 5:00 limit again.
- **Open question**: slide 10 gives happy sets 9:45 to 10:15, while slides 11 and 19 say 9:00 to 11:00.
The app uses 9:00 to 11:00 for all 4 sets; the tighter range would be one setting.
- **Approval comes first** (slides 11 and 17): playing opens only after a clinician approves all 4 sets, and approved sets can't be edited.
Home already says so.
- **Recording in 3 steps**: say the name 3 times, tell the story, add details (title, storyteller, relationship, happy or challenging).
The timer shows the 5:00 limit and turns yellow at 4:30 (slide 14).
When the set has less than 5:00 of room, a "Set full" marker shows where the set would pass 11:00.
"Finish" is disabled for the first second, so a double tap on Start can't end the recording.
- **When a story runs long** (slides 15 and 16): over 5:00, or too long for its set, the app shows the time left in the set and offers **Edit to fit** (recommended, keeps everything said) or **Record it again** (keeps the name recording).
- **A simple editor, not a Voice Memos copy**: the doc points to the iPhone Voice Memos editor, but families only need to get under a limit.
So there are three tools: shorten long pauses (one switch), trim the start and end, and speed up (1.1× or 1.2×, voice keeps its pitch) or cut a part.
A readout always shows the length before and after, and whether it fits.
- **Rearrange keeps the affect** (slide 19): stories move only between sets of the same affect.
Tap a story, then "Move here" or another story to swap with.
"No room" and "Won't fit" explain when a move would take a set over 11:00.
- **Back always works**: every screen is a browser history entry, so the phone's Back gesture behaves as expected.

## Designing what's next

The canvas has a "Coming later" area for accounts, admin, approval and playing.
New screens should:

- Reuse the existing components and tokens (cards, pills, set cards, bars, chips, `NavBar`, `ClipPlayer`) before inventing new ones.
- Work at phone width first, then get a computer layout in the `min-width: 60rem` block.
- Be checked in light and dark mode.
- Keep the one-main-action-per-screen rule, especially the playing checklists, which are used at a bedside.
