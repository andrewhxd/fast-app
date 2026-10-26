export const DEFAULT_GROUP_ID = 'default';

// Group IDs appear in URLs and are Firestore document IDs.
export function isValidGroupId(groupId) {
  return typeof groupId === 'string'
    && groupId.length <= 1500
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(groupId);
}
