import { useEffect, useMemo, useRef, useState } from 'react';
import ClipPlayer from './ClipPlayer.jsx';
import { CHIME_DURATION, chimeWav } from './chime.js';
import NavBar from './NavBar.jsx';
import { setHearingAid } from './group.js';
import { CheckIcon } from './icons.jsx';
import { AWAKE, localDay, pickSet, playableSets, prepareItems, shuffled } from './playing.js';
import { listSessionsOn, markSessionEnded, saveSession } from './sessions.js';
import { loadStoryAudio, splitClips } from './storage.js';
import { setKey, setName, storiesInSet } from './stories.js';

// Playing a story set to the patient, in 3 steps (slides 22 to 26):
//   1. "Get ready": a sound check and the checklist (hearing aid, told, earbuds, quiet room, out of view).
//   2. "Is Sam awake?": which signs of being awake the patient shows. With none, it suggests waiting,
//      but they can still play.
//   3. The set plays: one picked at random from the sets not yet played today, its stories shuffled.
// The session is saved when the set starts playing, and marked as ended if it plays to the end.
// `group` is the current care team; `onHearingAid(answer)` updates it once the hearing aid question
// is answered. `onDone(message)` and `onCancel()` leave the screen.
export default function PlaySession({ group, stories, onHearingAid, onDone, onCancel }) {
  const { name } = group; // the patient's name
  const [plan, setPlan] = useState(null); // { affect, setNumber, stories, day }, or { none: 'empty' | 'played' }
  const [clips, setClips] = useState(null); // the set's clips in playing order, once loaded
  const [step, setStep] = useState('prepare'); // 'prepare', 'awake', 'playing' or 'done'
  const [hearingAid, setHearingAidAnswer] = useState(group.hearingAid); // undefined until answered
  const [prepared, setPrepared] = useState([]); // checklist keys ticked
  const [awake, setAwake] = useState([]); // signs of being awake ticked
  const [notAwake, setNotAwake] = useState(false); // asking whether to play with no signs of being awake
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saved = useRef(null); // the session being saved: a promise of its id

  // Pick today's set and start loading its audio, so it's ready by the time the checklist is done.
  useEffect(() => {
    let cancelled = false;
    const day = localDay();
    listSessionsOn(group.id, day)
      .then((sessions) => {
        if (cancelled) return;
        const set = pickSet(playableSets(stories, sessions.map((s) => setKey(s.affect, s.setNumber))));
        if (!set) {
          setPlan({ none: stories.length ? 'played' : 'empty' });
          return;
        }
        const order = shuffled(storiesInSet(stories, set.affect, set.setNumber));
        setPlan({ ...set, stories: order, day });
        return Promise.all(order.map(loadStoryAudio)).then((blobs) => {
          if (!cancelled) setClips(order.flatMap((story, i) => splitClips(story, blobs[i]).map((clip) => ({ ...clip, label: story.title }))));
        });
      })
      .catch((err) => {
        if (!cancelled) setError(`Could not get the set ready: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // The sound check plays a short chime, made in the browser, so it's ready right away.
  const soundCheck = useMemo(() => [{ blob: chimeWav(), duration: CHIME_DURATION }], []);

  const items = prepareItems(hearingAid === true);
  const ready = hearingAid !== undefined && items.every((item) => prepared.includes(item.key));
  const set = plan && !plan.none ? setName(plan.affect, plan.setNumber) : '';

  function toggle(list, setList, key) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  // Remember the hearing aid answer for the care team the first time, then go on.
  async function finishPreparing() {
    if (!ready) return;
    setError('');
    if (group.hearingAid === undefined) {
      setSaving(true);
      try {
        await setHearingAid(group.id, hearingAid);
      } catch (err) {
        setError(`Could not save the answer about a hearing aid: ${err.message}`);
        setSaving(false);
        return;
      }
      setSaving(false);
      onHearingAid(hearingAid);
    }
    setStep('awake');
    window.scrollTo(0, 0);
  }

  function startPlaying() {
    if (!awake.length && !notAwake) {
      setNotAwake(true);
      return;
    }
    setStep('playing');
    window.scrollTo(0, 0);
  }

  // Saved once, the first time Play is tapped. Playing carries on if it can't be saved.
  function saveOnce() {
    if (saved.current) return;
    saved.current = saveSession(group.id, {
      affect: plan.affect,
      setNumber: plan.setNumber,
      day: plan.day,
      prepared: items.map((item) => item.key),
      awake: AWAKE.map((sign) => sign.key).filter((key) => awake.includes(key)),
    });
    saved.current.catch((err) => {
      saved.current = null;
      setError(`Could not save this session: ${err.message}. The set keeps playing.`);
    });
  }

  // The set played to the end: say so, and record it on the session once it's saved.
  function finish() {
    setStep('done');
    saved.current?.then((id) => markSessionEnded(group.id, id)).catch((err) => {
      setError(`Could not record that the set finished: ${err.message}`);
    });
  }

  const errorMessage = error && <p className="error" role="alert">{error}</p>;
  const stepNumber = { prepare: 1, awake: 2, playing: 3, done: 3 }[step];
  const navBar = (
    <NavBar
      left={step !== 'done' && <button className="nav-button" onClick={onCancel}>Cancel</button>}
      title={set || 'Play stories'}
      subtitle={set && `Step ${stepNumber} of 3`}
    />
  );

  if (!plan) {
    return (
      <>
        {navBar}
        <main className="content">{errorMessage || <p className="lead">Picking today&apos;s set...</p>}</main>
      </>
    );
  }

  if (plan.none) {
    return (
      <>
        {navBar}
        <main className="content">
          <h1 className="page-title">{plan.none === 'empty' ? 'No stories to play yet' : "That's every set for today"}</h1>
          <p className="lead">
            {plan.none === 'empty'
              ? 'Record some stories first. Then you can play them here.'
              : `Every set with stories has been played to ${name} today. The next session is tomorrow.`}
          </p>
          <div className="actions">
            <button className="pill pill-primary" onClick={onCancel}>Back</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {navBar}
      <main className="content">
        {step === 'prepare' && (
          <>
            <h1 className="page-title">Get ready</h1>
            <p className="lead">Before you start, out of {name}&apos;s hearing, check each of these.</p>

            {group.hearingAid === undefined && (
              <section className="field">
                <span className="field-label" id="hearing-aid-label">Does {name} use a hearing aid or other hearing accommodation?</span>
                <div className="segmented" role="radiogroup" aria-labelledby="hearing-aid-label">
                  <button role="radio" aria-checked={hearingAid === true} onClick={() => setHearingAidAnswer(true)}>Yes</button>
                  <button role="radio" aria-checked={hearingAid === false} onClick={() => setHearingAidAnswer(false)}>No</button>
                </div>
              </section>
            )}

            <section className="card" aria-label="Sound check">
              <p className="card-text">
                Put the earbuds in your own ears and play the sound check. Set the volume so it&apos;s clear and comfortable.
              </p>
              <ClipPlayer clips={soundCheck} compact title="Sound check" details="A short chime" />
            </section>

            <Checklist
              label="Before playing"
              options={items.map((item) => ({ key: item.key, label: item.label(name) }))}
              checked={prepared}
              onToggle={(key) => toggle(prepared, setPrepared, key)}
            />
            {errorMessage}
            <div className="actions">
              <button className="pill pill-primary" onClick={finishPreparing} disabled={!ready || saving}>
                {saving ? 'Saving...' : 'Continue'}
              </button>
              {!ready && <p className="footnote">Tick every item to continue.</p>}
            </div>
          </>
        )}

        {step === 'awake' && (
          <>
            <h1 className="page-title">Is {name} awake?</h1>
            <p className="lead">Tick everything {name} is doing right now.</p>
            <Checklist
              label={`Signs ${name} is awake`}
              options={AWAKE}
              checked={awake}
              onToggle={(key) => {
                toggle(awake, setAwake, key);
                setNotAwake(false);
              }}
            />
            <div className="actions">
              {notAwake ? (
                <div className="confirm" role="alert">
                  <p>{name} may not be awake yet.</p>
                  <p className="card-text">
                    Try again in an hour or so, or gently wake {name} by calling their name or touching their arm.
                    If you can&apos;t, you can still play the set now.
                  </p>
                  <div className="buttons">
                    <button className="pill pill-primary" onClick={startPlaying}>Play anyway</button>
                    <button className="pill pill-white" onClick={onCancel}>Not now</button>
                  </div>
                </div>
              ) : (
                <button className="pill pill-primary" onClick={startPlaying}>Continue</button>
              )}
            </div>
          </>
        )}

        {step === 'playing' && (
          <>
            <h1 className="page-title">Playing {set}</h1>
            <p className="lead">Tap play, then stay out of {name}&apos;s view until the set ends.</p>
            <section className={`session-card tint-${plan.affect}`} aria-label={set}>
              <ClipPlayer
                clips={clips}
                idleLabel={clips ? (plan.stories.length === 1 ? '1 story' : `${plan.stories.length} stories, in random order`) : 'Loading...'}
                onPlay={saveOnce}
                onEnd={finish}
                showLeft
              />
            </section>
            {errorMessage}
          </>
        )}

        {step === 'done' && (
          <>
            <h1 className="page-title">{set} is done</h1>
            <p className="lead">Take the earbuds out of {name}&apos;s ears.</p>
            {errorMessage}
            <div className="actions">
              <button className="pill pill-primary" onClick={() => onDone(`Played ${set} to ${name}.`)}>Done</button>
            </div>
          </>
        )}
      </main>
    </>
  );
}

// A list of things to tick, each a big row that's easy to tap.
function Checklist({ label, options, checked, onToggle }) {
  return (
    <fieldset className="checklist">
      <legend className="sr-only">{label}</legend>
      {options.map(({ key, label: text }) => {
        const on = checked.includes(key);
        return (
          <label key={key} className={`check-row${on ? ' on' : ''}`}>
            <input type="checkbox" checked={on} onChange={() => onToggle(key)} />
            <span className="check-box" aria-hidden="true"><CheckIcon /></span>
            <span>{text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
