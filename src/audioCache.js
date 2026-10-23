// Keeps recently played recordings in memory so picking one again doesn't download it again.
// When the total size goes over `maxBytes`, the least recently played recordings are dropped
// (they simply download again if picked later).
export function createAudioCache(maxBytes) {
  const blobs = new Map(); // id -> Blob, least recently played first (Maps keep insertion order)
  let totalBytes = 0;

  function remove(id) {
    const blob = blobs.get(id);
    if (!blob) return;
    blobs.delete(id);
    totalBytes -= blob.size;
  }

  return {
    // Return the cached recording (or undefined), marking it as just played.
    get(id) {
      const blob = blobs.get(id);
      if (blob) {
        blobs.delete(id);
        blobs.set(id, blob); // move to the "most recently played" end
      }
      return blob;
    },

    // Add a recording, then drop the oldest ones until the total fits (never the one just added).
    add(id, blob) {
      remove(id);
      blobs.set(id, blob);
      totalBytes += blob.size;
      for (const oldId of blobs.keys()) {
        if (totalBytes <= maxBytes || oldId === id) break;
        remove(oldId);
      }
    },

    remove,

    // For checking the cache: ids from least to most recently played, and the total size.
    stats: () => ({ ids: [...blobs.keys()], totalBytes }),
  };
}
