// The sound check before playing a set: a short, gentle chime, made here rather than recorded, so
// it's the same on every device and needs no download. Four bell-like notes rise (C, E, G, high C)
// and ring out together, at about the loudness of a voice recording, so the volume set with it
// suits the stories too.

const RATE = 22_050; // samples per second
const NOTES = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 in Hz
const STEP = 0.32; // seconds between notes
const RING = 1.9; // seconds each note rings for
const PEAK = 0.32; // loudest sample, out of 1

export const CHIME_DURATION = Math.round((STEP * (NOTES.length - 1) + RING) * 1000); // ms

// The chime's samples, from -1 to 1.
export function chimeSamples() {
  const samples = new Float32Array(Math.round((CHIME_DURATION / 1000) * RATE));
  NOTES.forEach((frequency, i) => {
    const start = Math.round(i * STEP * RATE);
    for (let n = 0; n < RING * RATE && start + n < samples.length; n++) {
      const t = n / RATE;
      const envelope = Math.min(1, t / 0.008) * Math.exp(-3.2 * t); // a soft strike, then a slow fade
      const tone = Math.sin(2 * Math.PI * frequency * t) + 0.3 * Math.sin(4 * Math.PI * frequency * t) * Math.exp(-6 * t);
      samples[start + n] += envelope * tone;
    }
  });
  const loudest = samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
  for (let n = 0; n < samples.length; n++) samples[n] *= PEAK / loudest;
  // Fade the last 50 ms to silence, so it never ends with a click.
  const fade = Math.round(0.05 * RATE);
  for (let n = 0; n < fade; n++) samples[samples.length - 1 - n] *= n / fade;
  return samples;
}

// The chime as a 16-bit mono WAV file, which every browser plays.
export function chimeWav() {
  const samples = chimeSamples();
  const bytes = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset, value) => [...value].forEach((c, i) => bytes.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  bytes.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  bytes.setUint32(16, 16, true); // format chunk size
  bytes.setUint16(20, 1, true); // PCM
  bytes.setUint16(22, 1, true); // mono
  bytes.setUint32(24, RATE, true);
  bytes.setUint32(28, RATE * 2, true); // bytes per second
  bytes.setUint16(32, 2, true); // bytes per sample
  bytes.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  bytes.setUint32(40, samples.length * 2, true);
  samples.forEach((s, n) => bytes.setInt16(44 + n * 2, Math.round(s * 32767), true));
  return new Blob([bytes], { type: 'audio/wav' });
}
