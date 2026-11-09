// Story editing: trim the ends, shorten long pauses, cut parts, speed parts up (keeping the
// voice's pitch), and add new recordings. An edit is only a description over the original
// recording's timeline, in seconds:
//
//   { trimStart, trimEnd, shortenPauses, cuts: [{ start, end }], speedups: [{ start, end, rate }],
//     inserts: [{ id, at, samples, replaces }] }
//
// so changes are free to undo. An insert is a new recording (decoded samples) placed at `at`;
// recording over a part also takes that part out while the insert is there (`replaces`:
// { start, end }, or null). Inserts are kept whole:
// trims, cuts, pauses and speed-ups apply only to the original recording.
// The audio is only processed ("rendered") to preview or save.

export const SAMPLE_RATE = 44_100;
const PAUSE_MIN = 1.5; // a quiet stretch at least this long is a long pause (seconds)
const PAUSE_KEEP = 0.5; // how much of each long pause is kept, half on each side (seconds)
const FADE = 0.01; // fade at every join, so cuts don't click (seconds)
const MP3_KBPS = 64; // plenty for a speaking voice: a 5 minute story is about 2.4 MB

// Decode a recorded clip to mono samples at 44.1 kHz.
export async function decodeClip(blob) {
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}

export function lengthOf(samples) {
  return samples.length / SAMPLE_RATE;
}

// The loudness of the recording in `count` equal slices, from 0 to 1, for drawing the waveform.
export function peaks(samples, count) {
  const out = new Array(count).fill(0);
  const size = Math.max(1, Math.floor(samples.length / count));
  let loudest = 0;
  for (let i = 0; i < count; i++) {
    let peak = 0;
    for (let j = i * size; j < Math.min((i + 1) * size, samples.length); j++) peak = Math.max(peak, Math.abs(samples[j]));
    out[i] = peak;
    loudest = Math.max(loudest, peak);
  }
  return out.map((p) => (loudest ? Math.sqrt(p / loudest) : 0)); // square root makes quiet speech easier to see
}

// Long pauses: stretches at least PAUSE_MIN seconds long that are much quieter than the speech
// around them. The threshold comes from the recording itself, so it works in quiet and noisy rooms.
// Returns [{ start, end }] in seconds.
export function findPauses(samples) {
  const window = Math.round(0.02 * SAMPLE_RATE);
  const levels = [];
  for (let i = 0; i + window <= samples.length; i += window) {
    let sum = 0;
    for (let j = i; j < i + window; j++) sum += samples[j] * samples[j];
    levels.push(Math.sqrt(sum / window));
  }
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const speech = sorted[Math.floor(sorted.length * 0.9)];
  const threshold = Math.max(0.002, floor + (speech - floor) * 0.12);

  const pauses = [];
  let runStart = -1;
  levels.forEach((level, i) => {
    if (level < threshold) {
      if (runStart < 0) runStart = i;
    } else {
      if (runStart >= 0 && (i - runStart) * 0.02 >= PAUSE_MIN) pauses.push({ start: runStart * 0.02, end: i * 0.02 });
      runStart = -1;
    }
  });
  if (runStart >= 0 && (levels.length - runStart) * 0.02 >= PAUSE_MIN) {
    pauses.push({ start: runStart * 0.02, end: levels.length * 0.02 });
  }
  return pauses;
}

// How much time shortening these pauses saves (seconds).
export function pauseSavings(pauses) {
  return pauses.reduce((sum, p) => sum + Math.max(0, p.end - p.start - PAUSE_KEEP), 0);
}

export function noEdits(length) {
  return { trimStart: 0, trimEnd: length, shortenPauses: false, cuts: [], speedups: [], inserts: [] };
}

export function isEdited(edits, length) {
  return edits.trimStart > 0 || edits.trimEnd < length || edits.shortenPauses
    || edits.cuts.length > 0 || edits.speedups.length > 0 || edits.inserts.length > 0;
}

// Intervals in `keep` with everything in `remove` taken out.
function subtract(keep, remove) {
  let result = keep;
  for (const r of remove) {
    result = result.flatMap((k) => {
      if (r.end <= k.start || r.start >= k.end) return [k];
      const parts = [];
      if (r.start > k.start) parts.push({ start: k.start, end: r.start });
      if (r.end < k.end) parts.push({ start: r.end, end: k.end });
      return parts;
    });
  }
  return result.filter((k) => k.end - k.start > 0.005);
}

// The edited story's pieces, in order: the parts of the original recording that are kept, each
// with the rate it plays at ({ start, end, rate }), and the added recordings where they go
// ({ insert, start: 0, end: its length, rate: 1 }). An insert placed before the trimmed start or
// after the trimmed end goes at that end.
export function planSegments(edits, pauses) {
  const pieces = planOriginal(edits, pauses);
  const inserts = edits.inserts
    .map((insert) => ({ insert, at: Math.min(Math.max(insert.at, edits.trimStart), edits.trimEnd) }))
    .sort((a, b) => a.at - b.at); // stable, so inserts at the same point stay in the order they were added
  const asPiece = ({ insert }) => ({ insert, start: 0, end: lengthOf(insert.samples), rate: 1 });

  const out = [];
  let next = 0; // the next insert to place
  for (const piece of pieces) {
    let start = piece.start;
    // Inserts at or before this point go first; one inside the piece splits it.
    while (next < inserts.length && inserts[next].at < piece.end) {
      const { at } = inserts[next];
      if (at > start + 0.005) {
        out.push({ ...piece, start, end: at });
        start = at;
      }
      out.push(asPiece(inserts[next]));
      next += 1;
    }
    if (piece.end - start > 0.005) out.push({ ...piece, start });
  }
  for (; next < inserts.length; next++) out.push(asPiece(inserts[next]));
  return out;
}

// The parts of the original recording that are kept, in order, each with the rate it plays at.
function planOriginal(edits, pauses) {
  const removed = [...edits.cuts, ...edits.inserts.filter((i) => i.replaces).map((i) => i.replaces)];
  if (edits.shortenPauses) {
    for (const p of pauses) {
      if (p.end - p.start > PAUSE_KEEP) removed.push({ start: p.start + PAUSE_KEEP / 2, end: p.end - PAUSE_KEEP / 2 });
    }
  }
  const kept = subtract([{ start: edits.trimStart, end: edits.trimEnd }], removed);

  // Split at the edges of sped-up parts, so each piece has one rate.
  return kept.flatMap((segment) => {
    const cuts = [segment.start, segment.end];
    for (const s of edits.speedups) {
      if (s.start > segment.start && s.start < segment.end) cuts.push(s.start);
      if (s.end > segment.start && s.end < segment.end) cuts.push(s.end);
    }
    cuts.sort((a, b) => a - b);
    const pieces = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i];
      const end = cuts[i + 1];
      if (end - start <= 0.005) continue;
      const middle = (start + end) / 2;
      const speedup = edits.speedups.find((s) => middle >= s.start && middle < s.end);
      pieces.push({ start, end, rate: speedup ? speedup.rate : 1 });
    }
    return pieces;
  });
}

// How long the edited story plays (seconds), without processing any audio.
export function plannedLength(segments) {
  return segments.reduce((sum, s) => sum + (s.end - s.start) / s.rate, 0);
}

// Add a speed-up or cut over [start, end], replacing any speed-up it overlaps.
export function withSpeedup(edits, start, end, rate) {
  const others = edits.speedups.filter((s) => s.end <= start || s.start >= end);
  return { ...edits, speedups: rate === 1 ? others : [...others, { start, end, rate }] };
}

export function withCut(edits, start, end) {
  return { ...edits, cuts: [...edits.cuts, { start, end }] };
}

// Add a new recording at `at`, or in place of the part [at, replaceEnd] when recording over it.
export function withInsert(edits, at, samples, replaceEnd = null) {
  const id = edits.inserts.reduce((most, i) => Math.max(most, i.id), 0) + 1;
  const replaces = replaceEnd === null ? null : { start: at, end: replaceEnd };
  return { ...edits, inserts: [...edits.inserts, { id, at, samples, replaces }] };
}

// Move an added recording: to `at`, or, for one recorded over a part, to replace [at, replaceEnd].
export function withMovedInsert(edits, id, at, replaceEnd = null) {
  return {
    ...edits,
    inserts: edits.inserts.map((i) => (i.id !== id ? i : {
      ...i, at, replaces: i.replaces && { start: at, end: replaceEnd },
    })),
  };
}

// Take out an added recording; a part it recorded over comes back.
export function withoutInsert(edits, id) {
  return { ...edits, inserts: edits.inserts.filter((i) => i.id !== id) };
}

// Where an added recording starts in the edited story, and how long it is (seconds).
export function insertSpan(segments, id) {
  let start = 0;
  for (const s of segments) {
    if (s.insert?.id === id) return { start, length: s.end - s.start };
    start += (s.end - s.start) / s.rate;
  }
  return null;
}

// Play `samples` faster without raising the pitch (SoundTouch's time stretch).
async function stretch(samples, rate) {
  const { SoundTouch, SimpleFilter } = await import('soundtouchjs');
  const soundTouch = new SoundTouch();
  soundTouch.tempo = rate;
  // SoundTouch holds back the last few thousand samples, so feed it a second of silence after the audio.
  const padded = new Float32Array(samples.length + SAMPLE_RATE);
  padded.set(samples);
  const source = {
    extract(target, numFrames, position) {
      const count = Math.max(0, Math.min(numFrames, padded.length - position));
      for (let i = 0; i < count; i++) {
        target[i * 2] = padded[position + i];
        target[i * 2 + 1] = padded[position + i];
      }
      return count;
    },
  };
  const filter = new SimpleFilter(source, soundTouch);
  const wanted = Math.round(samples.length / rate);
  const out = new Float32Array(wanted);
  const chunk = new Float32Array(4096 * 2);
  let filled = 0;
  while (filled < wanted) {
    const count = filter.extract(chunk, 4096);
    if (!count) break;
    for (let i = 0; i < count && filled < wanted; i++) out[filled++] = chunk[i * 2];
  }
  return out;
}

// Apply the edit: the kept parts, sped up where asked, and the added recordings, joined with short fades.
export async function render(samples, segments) {
  const pieces = [];
  for (const segment of segments) {
    const source = segment.insert ? segment.insert.samples : samples;
    let piece = source.slice(Math.round(segment.start * SAMPLE_RATE), Math.round(segment.end * SAMPLE_RATE));
    if (segment.rate !== 1) piece = await stretch(piece, segment.rate);
    pieces.push(piece);
  }
  const out = new Float32Array(pieces.reduce((sum, p) => sum + p.length, 0));
  const fade = Math.round(FADE * SAMPLE_RATE);
  let offset = 0;
  pieces.forEach((piece, index) => {
    for (let i = 0; i < Math.min(fade, piece.length); i++) {
      const gain = i / fade;
      if (index > 0) piece[i] *= gain; // fade in after a join
      if (index < pieces.length - 1) piece[piece.length - 1 - i] *= gain; // fade out before a join
    }
    out.set(piece, offset);
    offset += piece.length;
  });
  return out;
}

// Encode mono samples as an MP3 file, which every phone and browser can play.
export async function encodeMp3(samples) {
  const { createMp3Encoder } = await import('wasm-media-encoders');
  const encoder = await createMp3Encoder();
  encoder.configure({ sampleRate: SAMPLE_RATE, channels: 1, bitrate: MP3_KBPS });
  const parts = [];
  for (let i = 0; i < samples.length; i += SAMPLE_RATE) {
    parts.push(encoder.encode([samples.subarray(i, i + SAMPLE_RATE)]).slice()); // the encoder reuses its buffer
  }
  parts.push(encoder.finalize().slice());
  return new Blob(parts, { type: 'audio/mpeg' });
}
