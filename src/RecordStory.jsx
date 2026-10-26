import { useMemo, useState } from 'react';
import ClipPlayer from './ClipPlayer.jsx';
import LiveWaveform from './LiveWaveform.jsx';
import NavBar from './NavBar.jsx';
import StoryEditor from './StoryEditor.jsx';
import { PauseIcon, PlayIcon, RedoIcon, ScissorsIcon, StopIcon } from './icons.jsx';
import { addStory } from './storage.js';
import {
  NAME_MAX, RELATIONSHIPS, SET_MAX, STORY_MAX, STORY_WARN, fitsInSet, formatTime, setKey, setName,
} from './stories.js';
import { useRecorder } from './useRecorder.js';

const STATUS = { idle: 'Ready to record', recording: 'Recording', paused: 'Paused' };
const WARN_BEFORE_LIMIT = STORY_MAX - STORY_WARN; // the bar turns yellow this long before the limit

// Plain explanations for the save errors people can run into.
const SAVE_ERRORS = {
  'resource-exhausted': 'the cloud is busy. Wait a minute and try again.', // Firestore briefly limits bursts of writes
  'permission-denied': "the server didn't accept this story. Try recording it again.",
  unavailable: "the app can't reach the cloud. Check the internet connection and try again.",
};

// The recorder card: status, the big timer, the live waveform, and for the story a bar toward its
// limit. `length` is the story so far with its name clip, since the 5:00 cap counts the name.
// `room` is how much the set can still take; when it's under 5:00 the bar marks where the set is full.
function RecorderCard({ tint, recorder, length, story, room }) {
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
function RecordButtons({ recorder, finishLabel, onStart, onStop }) {
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

// Records one personal story into a set, in steps:
//   name      record the patient's name said 3 times
//   story     record the story (up to 5:00 with the name)
//   tooLong   the story is over 5:00, or overSet: it would take the set over 11:00.
//             Either edit it to fit, or record it again.
//   edit      the story editor
//   review    listen back, add the title, storyteller, relationship and affect, then save
export default function RecordStory({ groupId, affect: startAffect, setNumber, summary, onSaved, onCancel }) {
  const recorder = useRecorder();
  const [step, setStep] = useState('name');
  const [editReturn, setEditReturn] = useState('review'); // where Cancel in the editor goes back to
  const [nameTake, setNameTake] = useState(null); // { blob, duration }
  const [storyTake, setStoryTake] = useState(null);
  const [edited, setEdited] = useState(false);
  const [affect, setAffect] = useState(startAffect); // can change on review; the set number stays
  const [title, setTitle] = useState('');
  const [storyteller, setStoryteller] = useState('');
  const [relationship, setRelationship] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setTime = summary[setKey(affect, setNumber)].total; // already in the set
  const room = SET_MAX - setTime; // how much more this set can take
  const limit = Math.min(STORY_MAX, room); // the most this story can be
  const nameTime = nameTake?.duration ?? 0;
  const takeTime = nameTime + (storyTake?.duration ?? 0); // this story, name included
  const fits = takeTime <= STORY_MAX && fitsInSet(setTime, takeTime);
  const elapsed = recorder.state === 'idle' ? 0 : recorder.elapsed;
  const clips = useMemo(() => [nameTake, storyTake], [nameTake, storyTake]); // the same array while typing
  const tint = `tint-${affect}`;
  const set = setName(affect, setNumber);

  async function startRecording() {
    setError('');
    try {
      await recorder.start();
    } catch (err) {
      setError(`Could not start recording: ${err.message}`);
    }
  }

  async function stopRecording() {
    let take;
    try {
      take = await recorder.stop();
    } catch (err) {
      setError(err.message);
      return;
    }

    if (step === 'name') {
      if (take.duration > NAME_MAX) {
        setError('That was over a minute. Just say the patient\'s name 3 times, then tap Done.');
        return;
      }
      setNameTake(take);
      setStep('story');
      return;
    }

    setStoryTake(take);
    setEdited(false);
    const length = nameTake.duration + take.duration;
    if (length > STORY_MAX) setStep('tooLong');
    else if (!fitsInSet(setTime, length)) setStep('overSet');
    else setStep('review');
  }

  // Throw away the story (keeping the name clip) and record it again.
  function rerecordStory() {
    setStoryTake(null);
    setEdited(false);
    setError('');
    setStep('story');
  }

  function openEditor() {
    setEditReturn(step);
    setStep('edit');
  }

  async function save() {
    if (!title.trim() || !storyteller.trim() || !relationship) {
      setError('Fill in the title, storyteller and relationship first.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await addStory({
        groupId,
        name: nameTake,
        story: storyTake,
        title: title.trim(),
        storyteller: storyteller.trim(),
        relationship,
        affect,
        setNumber,
      });
    } catch (err) {
      setError(`Could not save: ${SAVE_ERRORS[err.code] ?? err.message}`);
      setSaving(false);
      return;
    }
    onSaved(`Added "${title.trim()}" to ${set}.`); // stays on "Saving..." until the sets reload
  }

  if (step === 'edit') {
    return (
      <StoryEditor
        name={nameTake}
        story={storyTake}
        maxLength={limit}
        limitText={room < STORY_MAX ? `${set} has room for ${formatTime(room)}` : `A story can be up to ${formatTime(STORY_MAX)}`}
        onSave={(editedClips) => {
          setNameTake(editedClips.name);
          setStoryTake(editedClips.story);
          setEdited(true);
          setStep('review');
        }}
        onCancel={() => setStep(editReturn)}
      />
    );
  }

  const stepNumber = { name: 1, story: 2, tooLong: 2, overSet: 2, review: 3 }[step];
  const shownError = error || recorder.error;
  const errorMessage = shownError && <p className="error" role="alert">{shownError}</p>;
  const over = takeTime - limit;

  return (
    <>
      <NavBar
        left={(
          <button className="nav-button" onClick={step === 'review' ? () => setConfirmingDelete(true) : onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        title={set}
        subtitle={`Step ${stepNumber} of 3`}
      />

      <main className="content">
        {step === 'name' && (
          <>
            <h1 className="page-title">Say the patient&apos;s name</h1>
            <p className="lead">Say their name 3 times, the way they&apos;re used to hearing it.</p>
            <RecorderCard tint={tint} recorder={recorder} length={elapsed} room={room} />
            {errorMessage}
            <div className="actions">
              <RecordButtons recorder={recorder} finishLabel="Done" onStart={startRecording} onStop={stopRecording} />
            </div>
          </>
        )}

        {step === 'story' && (
          <>
            <h1 className="page-title">Tell your story</h1>
            <div className="chips">
              <span className="chip">Up to {formatTime(STORY_MAX)} with the name</span>
              {room < STORY_MAX && <span className={`chip tinted ${tint}`}>Room in this set: {formatTime(room)}</span>}
            </div>
            <RecorderCard tint={tint} recorder={recorder} length={nameTime + elapsed} room={room} story />
            {errorMessage}
            <div className="actions">
              <RecordButtons recorder={recorder} finishLabel="Finish story" onStart={startRecording} onStop={stopRecording} />
            </div>
          </>
        )}

        {(step === 'tooLong' || step === 'overSet') && (
          <>
            <h1 className="page-title">{step === 'tooLong' ? 'A little too long' : "Doesn't fit in this set"}</h1>
            <p className="lead">
              {step === 'tooLong'
                ? <>This story is <strong>{formatTime(takeTime)}</strong> counting the name. A story can be up to {formatTime(STORY_MAX)}, so it needs to lose about {formatTime(over + 999)}.</>
                : <>{set} has room for <strong>{formatTime(room)}</strong>, and this story is {formatTime(takeTime)}. It needs to lose about {formatTime(over + 999)}.</>}
            </p>
            <section className="card over-card">
              <div className="over-line">
                <strong>{formatTime(takeTime)}</strong>
                <span className="over-chip">{formatTime(over + 999)} over</span>
              </div>
              <div className="bar bar-thick">
                <div className="bar-fill ok" style={{ width: `${(limit / Math.max(takeTime, STORY_MAX)) * 100}%` }} />
                <div className="bar-fill long" style={{ left: `${(limit / Math.max(takeTime, STORY_MAX)) * 100}%`, width: `${((takeTime - limit) / Math.max(takeTime, STORY_MAX)) * 100}%` }} />
                <div className="bar-marker" style={{ left: `${(limit / Math.max(takeTime, STORY_MAX)) * 100}%` }} />
              </div>
            </section>

            <h2 className="group-label">What would you like to do?</h2>
            <button className="choice-card recommended" onClick={openEditor}>
              <span className="choice-icon"><ScissorsIcon /></span>
              <span className="choice-text">
                <strong>Edit to fit <span className="tag">Recommended</span></strong>
                <span>Trim the ends, shorten long pauses, or speed up a part. Keeps everything you said.</span>
              </span>
            </button>
            <button className="choice-card" onClick={rerecordStory}>
              <span className="choice-icon"><RedoIcon /></span>
              <span className="choice-text">
                <strong>Record it again</strong>
                <span>Start the story over. Your recording of the name is kept.</span>
              </span>
            </button>
          </>
        )}

        {step === 'review' && (
          <>
            <h1 className="page-title">Add details</h1>

            <section className={`review-card ${tint}`}>
              <ClipPlayer clips={clips} tint="" />
              <div className="review-line">
                <span>
                  {edited && <span className="tag soft">Edited</span>}
                  {edited ? ' Saved with your edits' : 'Too long, or long pauses? You can edit it.'}
                </span>
                <button className="pill-small pill-white" onClick={openEditor} disabled={saving}>Edit</button>
              </div>
            </section>

            <div className="field">
              <label className="field-label" htmlFor="title">Title</label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Heather and Dave's wedding"
                maxLength={100}
                enterKeyHint="next"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="storyteller">Storyteller</label>
              <input
                id="storyteller"
                value={storyteller}
                onChange={(event) => setStoryteller(event.target.value)}
                placeholder="Your name"
                maxLength={100}
                autoComplete="name"
                enterKeyHint="next"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="relationship">Relationship to the patient</label>
              <select id="relationship" value={relationship} onChange={(event) => setRelationship(event.target.value)} required>
                <option value="" disabled>Choose one</option>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <fieldset className="field">
              <legend className="field-label">Affect of the event</legend>
              <div className="segmented">
                <label className={`tint-happy${affect === 'happy' ? ' on' : ''}`}>
                  <input type="radio" name="affect" checked={affect === 'happy'} onChange={() => setAffect('happy')} />
                  Happy
                </label>
                <label className={`tint-challenging${affect === 'challenging' ? ' on' : ''}`}>
                  <input type="radio" name="affect" checked={affect === 'challenging'} onChange={() => setAffect('challenging')} />
                  Challenging
                </label>
              </div>
            </fieldset>

            {!fits && (
              <p className="error" role="alert">
                {set} only has room for {formatTime(room)}, and this story is {formatTime(takeTime)}. Edit it to fit, or pick the other affect.
              </p>
            )}
            {errorMessage}

            <div className="actions">
              {confirmingDelete ? (
                <div className="confirm">
                  <p>Delete this recording? This can&apos;t be undone.</p>
                  <div className="buttons">
                    <button className="pill pill-record" onClick={onCancel}>Delete</button>
                    <button className="pill pill-white" onClick={() => setConfirmingDelete(false)}>Keep it</button>
                  </div>
                </div>
              ) : (
                <>
                  <button className="pill pill-primary" onClick={save} disabled={saving || !fits}>
                    {saving ? 'Saving...' : 'Add story'}
                  </button>
                  <button className="pill pill-quiet danger" onClick={() => setConfirmingDelete(true)} disabled={saving}>
                    Delete recording
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
