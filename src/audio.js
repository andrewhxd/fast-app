// Prefer AAC (audio/mp4): every iPhone and Android phone can play it.
// Browsers that can't record it fall back to webm or ogg.
export function pickAudioFormat() {
  const formats = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'];
  return formats.find((format) => MediaRecorder.isTypeSupported(format)) || '';
}
