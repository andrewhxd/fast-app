import { useEffect, useRef, useState } from 'react';
import { wakeAudio } from './LiveWaveform.jsx';
import { pickAudioFormat } from './audio.js';

// 64 kbps is plenty for a speaking voice and keeps a 5 minute story near 2.4 MB (uploads max out at 5 MB).
const BITS_PER_SECOND = 64_000;

// Time recorded so far in a session, not counting pauses.
function timeSoFar(session) {
  const running = session.resumedAt === null ? 0 : performance.now() - session.resumedAt;
  return session.banked + running;
}

// Records one clip from the microphone, with pause.
// `state` is 'idle', 'recording' or 'paused'; `elapsed` is the recorded time in ms;
// `stream` is the live microphone while recording (for the waveform);
// `error` explains a recording that stopped by itself (e.g. the microphone was disconnected).
// stop() resolves to { blob, duration }.
export function useRecorder() {
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const sessionRef = useRef(null); // the recording in progress, until stop() is called

  // Turn off the mic if the screen closes mid-recording.
  useEffect(() => () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.recorder.onstop = null;
    clearInterval(session.timer);
    if (session.recorder.state !== 'inactive') session.recorder.stop();
    session.stream.getTracks().forEach((track) => track.stop());
  }, []);

  function resetToIdle() {
    setStream(null);
    setState('idle');
  }

  async function start() {
    setError('');
    wakeAudio(); // must happen during the tap, before any waiting, for iPhone
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickAudioFormat();
    const recorder = new MediaRecorder(micStream, { ...(mimeType && { mimeType }), audioBitsPerSecond: BITS_PER_SECOND });
    const session = { recorder, stream: micStream, mimeType, chunks: [], banked: 0, resumedAt: performance.now() };
    session.finished = new Promise((resolve, reject) => {
      session.resolve = resolve;
      session.reject = reject;
    });

    // The recorder hands us audio in pieces; collect them.
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) session.chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      session.error = event.error;
    };
    // Runs after stop(), or by itself if recording fails (an error, or the microphone went away).
    recorder.onstop = () => {
      clearInterval(session.timer);
      micStream.getTracks().forEach((track) => track.stop()); // turn off the mic
      const stoppedByUser = sessionRef.current !== session;
      if (!stoppedByUser) {
        sessionRef.current = null;
        resetToIdle();
        setError(`Recording stopped unexpectedly${session.error ? ` (${session.error.message})` : ''}. Try again.`);
        return;
      }
      // Join the pieces into one audio file.
      const blob = new Blob(session.chunks, { type: recorder.mimeType || mimeType });
      // Stopping right away (before the mic warms up) can leave nothing to play or save.
      if (session.error || blob.size === 0) session.reject(new Error('No audio was captured. Try recording again.'));
      else session.resolve({ blob, duration: session.duration });
    };
    session.timer = setInterval(() => setElapsed(timeSoFar(session)), 100);

    recorder.start();
    sessionRef.current = session;
    setElapsed(0);
    setStream(micStream);
    setState('recording');
  }

  function pause() {
    const session = sessionRef.current;
    session.recorder.pause();
    session.banked = timeSoFar(session);
    session.resumedAt = null;
    setElapsed(session.banked);
    setState('paused');
  }

  function resume() {
    const session = sessionRef.current;
    session.recorder.resume();
    session.resumedAt = performance.now();
    setState('recording');
  }

  function stop() {
    const session = sessionRef.current;
    sessionRef.current = null;
    session.duration = Math.round(timeSoFar(session));
    clearInterval(session.timer);
    setElapsed(session.duration);
    resetToIdle();
    session.recorder.stop();
    return session.finished;
  }

  return { state, elapsed, stream, error, start, pause, resume, stop };
}
