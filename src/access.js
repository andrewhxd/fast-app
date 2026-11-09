// Access levels on a care team (project doc slide 4). The lead caregiver starts the team and gives
// each person one level when inviting them, and can change it or remove them later. Administrators
// can do the same for everyone except the lead caregiver and themselves.
//
// Every level can listen to the stories. The lead caregiver has every permission.
// Must match firestore.rules.

export const ACCESS = [
  {
    key: 'administrator',
    label: 'Administrator',
    does: 'invite people and manage their access, record and edit stories, and play them to the patient',
  },
  {
    key: 'clinician',
    label: 'Clinician',
    does: 'record and edit stories, play them to the patient, and later review and approve them',
  },
  {
    key: 'stories',
    label: 'Record and edit stories',
    does: 'record, listen to, edit and move stories',
  },
  {
    key: 'player',
    label: 'Play stories',
    does: 'play story sets to the patient, and listen to the stories',
  },
];

// The level of anyone who joined before access levels existed.
export const DEFAULT_ACCESS = 'stories';

export function accessLabel(key) {
  return ACCESS.find((level) => level.key === key)?.label ?? accessLabel(DEFAULT_ACCESS);
}

// What a level can do, to follow "can" or "You'll be able to", e.g. "record, listen to, edit and move stories".
export function accessDoes(key) {
  return ACCESS.find((level) => level.key === key)?.does ?? accessDoes(DEFAULT_ACCESS);
}

// What a level allows. `access` is a level's key, or 'lead' for the lead caregiver.
export const canManage = (access) => access === 'lead' || access === 'administrator';
export const canRecord = (access) => access !== 'player';
export const canPlay = (access) => access !== 'stories';
