import LiveWaveform from './LiveWaveform.jsx';
import { PauseIcon, PlayIcon, StopIcon } from './icons.jsx';
import { STORY_MAX, STORY_WARN, formatTime } from './stories.js';

// The recorder's card and buttons, used to record a story (RecordStory) and to add a part to one
// (StoryEditor).

const STATUS = { idle: 'Ready to record', recording: 'Recording', paused: 'Paused' };
const WARN_BEFORE_LIMIT = STORY_MAX - STORY_WARN; // the bar turns yellow this long before the limit

// The recorder card: status, the big timer, the live waveform, and for the story a bar toward its
// limit. `length` is the story so far with its name clip, since the 5:00 cap counts the name.
// `room` is how much the set can still take; when it's under 5:00 the bar marks where the set is full.
export function RecorderCard({ tint, recorder, length, story, room }) {
  const { state } = recorder;
  const limit = Math.min(STORY_MAX, room);
  let level = 'ok';
  if (length > limit) level = 'long';
  else if (length >= limit - WARN_BEFORE_LIMIT) level = 'warn';

  let hint;
  if (room < STORY_MAX) hint = length <= room ? `${formatTime(room - length)} until this set is full` : 'This set is full. Finish now.';
  else if (length > STORY_MAX) hint = `Over ${formatTime(STORY_MAX)}`;
  else hint = `${formatTime(STORY_MAX - length)} left${level === 'warn' ? '. Start wrapping up.' : ''}`;

  return (
    <section className={`card recorder ${tint}`}>
      <span className={`status ${state}`} aria-live="polite">
        <span className="record-dot" aria-hidden="true" />
        {STATUS[state]}
      </span>
      <div className="timer">
        <strong>{formatTime(length)}</strong>
        {story && <span>of {formatTime(STORY_MAX)}</span>}
      </div>
      {/* Keeps its height when not recording, so the screen doesn't jump. */}
      <div className="waveform-slot">{state === 'recording' && <LiveWaveform stream={recorder.stream} />}</div>
      {story && (
        <div className="limit-bar">
          <div className="bar bar-thick">
            <div className={`bar-fill ${level}`} style={{ width: `${Math.min(length / STORY_MAX, 1) * 100}%` }} />
            {room < STORY_MAX && <div className="bar-marker" style={{ left: `${(room / STORY_MAX) * 100}%` }} />}
          </div>
          <div className="bar-labels">
            {room < STORY_MAX && <span className="marker-label" style={{ left: `${(room / STORY_MAX) * 100}%` }}>Set full</span>}
            <span className="end-label">{formatTime(STORY_MAX)}</span>
          </div>
          <p className="timer-hint">{hint}</p>
        </div>
      )}
    </section>
  );
}

// Start, then Finish and Pause (or Resume) while recording.
export function RecordButtons({ recorder, finishLabel, onStart, onStop }) {
  const { state } = recorder;
  if (state === 'idle') {
    return (
      <button className="pill pill-record" onClick={onStart}>
        <span className="record-dot" aria-hidden="true" />
        Start recording
      </button>
    );
  }
  const paused = state === 'paused';
  return (
    <>
      {/* Finish takes Start's place, so it waits a second: a double tap shouldn't end the recording. */}
      <button className="pill pill-record" onClick={onStop} disabled={recorder.elapsed < 1000}>
        <StopIcon />
        {finishLabel}
      </button>
      <button className="pill pill-white" onClick={paused ? recorder.resume : recorder.pause}>
        {paused ? <PlayIcon /> : <PauseIcon />}
        {paused ? 'Resume' : 'Pause'}
      </button>
    </>
  );
}
