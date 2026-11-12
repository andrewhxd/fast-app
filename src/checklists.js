// The questions asked before and after playing a story set to the patient.
// The ids are what gets saved, so don't change an id once sessions use it (labels can change).

// Before playing, screen 1: every item must be ticked before playing.
export const BEFORE_ITEMS = [
  { id: 'hearingAid', label: "The hearing aid is in place (or they don't use one)" },
  { id: 'soundCheck', label: 'Sound check done, at a comfortable volume' },
  { id: 'told', label: 'Told your loved one that stories are coming' },
  { id: 'earbuds', label: 'The earbuds are in' },
  { id: 'room', label: 'The door is closed and the room is quiet' },
  { id: 'outOfView', label: 'You are out of their view' },
];

// Before playing, screen 2: signs that the patient is awake (survey question 4).
export const AWAKE_BEHAVIORS = [
  { id: 'opensEyes', label: 'Opens eyes on their own' },
  { id: 'opensEyesToStimulus', label: 'Opens eyes when shaken gently or called by name' },
  { id: 'followsInstruction', label: 'Does something they were told to do with their body' },
  { id: 'intentionalMovement', label: 'Makes an intentional movement (scratching, moving clothing, adjusting position)' },
  { id: 'turnsToSound', label: 'Turns head or body toward a sound or voice' },
  { id: 'makesSounds', label: 'Makes sounds on their own or in response' },
  { id: 'respondsToTouch', label: 'Moves more, or shows more facial activity or voice, when touched or talked to' },
];

// After playing: compared to before, does the patient show more, the same or less of each?
export const AFTER_BEHAVIORS = [
  ...AWAKE_BEHAVIORS,
  { id: 'answersQuestions', label: 'Answers questions about the room' },
  { id: 'usesObject', label: 'Shows how to use a familiar object' },
];

export const CHANGES = ['more', 'same', 'less'];
