import { useEffect, useMemo, useRef, useState } from 'react';
import NavBar from './NavBar.jsx';
import { wakeAudio } from './LiveWaveform.jsx';
import { BackIcon, ChevronIcon, PlayIcon, StopIcon } from './icons.jsx';
import {
  SAMPLE_RATE, decodeClip, encodeMp3, findPauses, isEdited, lengthOf, noEdits, pauseSavings, peaks, planSegments,
  plannedLength, render, withCut, withSpeedup,
} from './audioEdit.js';
import { formatTime } from './stories.js';

const BARS = 64;
const MIN_KEEP = 1; // the trim handles keep at least this much (seconds)
const HANDLE_REACH = 28; // how close a touch must be to grab a trim handle (px)
const RATES = [
  { rate: 1, label: 'Normal' },
  { rate: 1.1, label: '1.1×' },
  { rate: 1.2, label: '1.2×' },
];
// Saving rounds lengths, so leave a little room under the limit.
const SAFETY = 100; // ms

// Seconds as "m:ss", rounded to the nearest second.
function seconds(value) {
  return formatTime(Math.round(value) * 1000);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// "Length with the name: 5:21 → 4:58", and whether that fits.
function LengthCard({ before, after, maxLength, limitText }) {
  const fits = after <= maxLength - SAFETY;
  return (
    <section className="length-card">
      <span className="length-text">
        <span>Length with the name</span>
        <strong>
          {Math.round(before / 1000) !== Math.round(after / 1000) && <s>{formatTime(before)}</s>}
          {Math.round(before / 1000) !== Math.round(after / 1000) && ' → '}
          {formatTime(after)}
        </strong>
        <small>{limitText}</small>
      </span>
      <span className={`fit-chip${fits ? ' fits' : ''}`}>{fits ? '✓ Fits' : `${formatTime(after - maxLength + 999)} over`}</span>
    </section>
  );
}

// The story editor: trim the ends, shorten long pauses, and speed up or cut a part, with a live
// length readout and a preview. `name` and `story` are the recorded clips ({ blob, duration }).
// The name clip isn't edited, but it counts toward `maxLength` (ms): the most the story may be.
// `limitText` explains that limit. onSave({ name, story }) gets both clips as MP3, because a story's
// two clips are stored in one format; it can return a promise while it saves them.
export default function StoryEditor({ name, story, maxLength, limitText, onSave, onCancel }) {
  const [samples, setSamples] = useState(null); // the story, decoded
  const [nameSamples, setNameSamples] = useState(null);
  const [pauses, setPauses] = useState([]);
  const [edits, setEdits] = useState(null);
  const [mode, setMode] = useState('main'); // 'main', or 'part' while speeding up or cutting a part
  const [selection, setSelection] = useState(null); // { start, end } of the part, in seconds
  const [rate, setRate] = useState(1.1);
  const [preview, setPreview] = useState(null); // { loading } or { position } while the preview plays
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const waveRef = useRef(null);
  const dragRef = useRef(null); // 'start' or 'end' handle, or { anchor } of a selection
  const playerRef = useRef(null); // the playing preview: { source, startedAt, frame }
  const pendingRef = useRef(null); // the preview being prepared, if any

  useEffect(() => {
    let cancelled = false;
    Promise.all([decodeClip(story.blob), decodeClip(name.blob)])
      .then(([decoded, decodedName]) => {
        if (cancelled) return;
        setSamples(decoded);
        setNameSamples(decodedName);
        setPauses(findPauses(decoded));
        setEdits(noEdits(lengthOf(decoded)));
      })
      .catch((err) => {
        if (!cancelled) setError(`Could not open the recording: ${err.message}`);
      });
    return () => {
      cancelled = true;
      stopPreview();
    };
  }, [name, story]);

  // Any change to the edit stops the preview, which would no longer match.
  useEffect(() => () => stopPreview(), [edits]);

  const length = samples ? lengthOf(samples) : 0;
  const segments = useMemo(() => edits && planSegments(edits, pauses), [edits, pauses]);
  const bars = useMemo(() => samples && peaks(samples, BARS), [samples]);

  // While choosing a part, show what applying it would do.
  const shownEdits = mode === 'part' && selection && edits ? withSpeedup(edits, selection.start, selection.end, rate) : edits;
  const shownSegments = useMemo(() => shownEdits && planSegments(shownEdits, pauses), [shownEdits, pauses]);
  // Start from the length shown everywhere else (timed while recording), and take off what the edits remove.
  const before = name.duration + story.duration;
  const after = before - (length - (shownSegments ? plannedLength(shownSegments) : length)) * 1000;
  const fits = after <= maxLength - SAFETY;
  const edited = edits && isEdited(edits, length);

  function stopPreview() {
    const player = playerRef.current;
    playerRef.current = null;
    pendingRef.current = null; // a preview still being prepared won't start
    if (player) {
      cancelAnimationFrame(player.frame);
      player.source.onended = null;
      player.source.stop();
    }
    setPreview(null);
  }

  async function togglePreview() {
    if (preview) {
      stopPreview();
      return;
    }
    const context = wakeAudio(); // during the tap, so the phone lets it play
    const pending = {};
    pendingRef.current = pending;
    setPreview({ loading: true });
    const out = await render(samples, segments);
    if (pendingRef.current !== pending) return; // stopped, edited or closed meanwhile
    pendingRef.current = null;
    const buffer = context.createBuffer(1, out.length, SAMPLE_RATE);
    buffer.copyToChannel(out, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const player = { source, startedAt: context.currentTime, frame: 0 };
    source.onended = () => {
      if (playerRef.current === player) stopPreview();
    };
    playerRef.current = player;
    source.start();
    const tick = () => {
      setPreview({ position: (context.currentTime - player.startedAt) * 1000 });
      player.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---------- Dragging on the waveform ----------

  function timeAt(clientX) {
    const box = waveRef.current.getBoundingClientRect();
    return clamp((clientX - box.left) / box.width, 0, 1) * length;
  }

  function moveHandle(which, time) {
    setEdits((e) => (which === 'start'
      ? { ...e, trimStart: clamp(time, 0, e.trimEnd - MIN_KEEP) }
      : { ...e, trimEnd: clamp(time, e.trimStart + MIN_KEEP, length) }));
  }

  function pointerDown(event) {
    if (!edits || saving) return;
    const time = timeAt(event.clientX);
    if (mode === 'main') {
      // Grab the nearest trim handle, if the touch is close enough to it.
      const width = waveRef.current.getBoundingClientRect().width;
      const toPixels = (t) => Math.abs(t - time) / length * width;
      const which = toPixels(edits.trimStart) <= toPixels(edits.trimEnd) ? 'start' : 'end';
      if (toPixels(which === 'start' ? edits.trimStart : edits.trimEnd) > HANDLE_REACH) return;
      dragRef.current = which;
    } else {
      dragRef.current = { anchor: time };
      setSelection({ start: time, end: time });
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const time = timeAt(event.clientX);
    if (typeof drag === 'string') moveHandle(drag, time);
    else setSelection({ start: Math.min(drag.anchor, time), end: Math.max(drag.anchor, time) });
  }

  function pointerUp() {
    if (dragRef.current && typeof dragRef.current !== 'string' && selection && selection.end - selection.start < 0.5) {
      setSelection(null); // a tap, not a drag
    }
    dragRef.current = null;
  }

  // Arrow keys move a focused handle by half a second (5 seconds with Shift).
  function handleKey(which) {
    return (event) => {
      const step = event.shiftKey ? 5 : 0.5;
      const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[event.key];
      if (!delta) return;
      event.preventDefault();
      moveHandle(which, (which === 'start' ? edits.trimStart : edits.trimEnd) + delta);
    };
  }

  // ---------- Actions ----------

  function applyToPart() {
    setEdits((e) => withSpeedup(e, selection.start, selection.end, rate));
    setSelection(null);
    setMode('main');
  }

  function cutPart() {
    setEdits((e) => withCut(e, selection.start, selection.end));
    setSelection(null);
    setMode('main');
  }

  async function save() {
    if (!edited) {
      onCancel(); // nothing changed
      return;
    }
    stopPreview();
    setSaving(true);
    setError('');
    try {
      const out = await render(samples, segments);
      const [storyBlob, nameBlob] = await Promise.all([encodeMp3(out), encodeMp3(nameSamples)]);
      await onSave({
        name: { blob: nameBlob, duration: Math.round(lengthOf(nameSamples) * 1000) },
        story: { blob: storyBlob, duration: Math.round(lengthOf(out) * 1000) },
      });
    } catch (err) {
      setError(`Could not save the edit: ${err.message}`);
      setSaving(false);
    }
  }

  // ---------- Drawing ----------

  // Each bar's look: outside the trim, removed (a cut or a shortened pause), faster, or picked.
  function barClass(index) {
    const time = ((index + 0.5) / BARS) * length;
    if (time < edits.trimStart || time > edits.trimEnd) return 'wave-bar trimmed';
    if (mode === 'part' && selection && time >= selection.start && time <= selection.end) return 'wave-bar picked';
    const segment = segments.find((s) => time >= s.start && time < s.end);
    if (!segment) return 'wave-bar removed';
    return segment.rate > 1 ? 'wave-bar faster' : 'wave-bar';
  }

  const percent = (time) => `${(time / length) * 100}%`;
  const storyAfter = segments ? plannedLength(segments) * 1000 : 0;
  const trimSaved = edits ? edits.trimStart + (length - edits.trimEnd) : 0;
  const savedByPauses = pauseSavings(pauses);
  const partCount = edits ? edits.speedups.length + edits.cuts.length : 0;

  if (!edits) {
    return (
      <>
        <NavBar left={<button className="nav-button" onClick={onCancel}>Cancel</button>} title="Edit story" />
        <main className="content">
          <p className={error ? 'error' : 'lead'} role={error ? 'alert' : undefined}>{error || 'Opening the recording...'}</p>
        </main>
      </>
    );
  }

  const waveform = (
    <div
      ref={waveRef}
      className={`waveform-edit${mode === 'part' ? ' picking' : ''}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      {bars.map((level, index) => {
        const className = barClass(index);
        // Removed parts (cuts, shortened pauses) shrink to a thin line.
        const height = className.endsWith('removed') ? '4px' : `${Math.max(6, level * 100)}%`;
        return <span key={index} className={className} style={{ height }} />;
      })}
      {mode === 'part' && selection && (
        <span className="pick-box" style={{ left: percent(selection.start), width: percent(selection.end - selection.start) }} />
      )}
      {mode === 'main' && (
        <>
          <span className="trim-frame" style={{ left: percent(edits.trimStart), right: `${100 - (edits.trimEnd / length) * 100}%` }} />
          <span
            className="trim-handle"
            style={{ left: percent(edits.trimStart) }}
            role="slider"
            tabIndex={0}
            aria-label="Start of the story"
            aria-valuemin={0}
            aria-valuemax={Math.round(length)}
            aria-valuenow={Math.round(edits.trimStart)}
            aria-valuetext={formatTime(edits.trimStart * 1000)}
            onKeyDown={handleKey('start')}
          />
          <span
            className="trim-handle"
            style={{ left: percent(edits.trimEnd) }}
            role="slider"
            tabIndex={0}
            aria-label="End of the story"
            aria-valuemin={0}
            aria-valuemax={Math.round(length)}
            aria-valuenow={Math.round(edits.trimEnd)}
            aria-valuetext={formatTime(edits.trimEnd * 1000)}
            onKeyDown={handleKey('end')}
          />
        </>
      )}
    </div>
  );

  // The middle time is left out when it would repeat an end's, as on a very short clip.
  const middle = formatTime((length * 1000) / 2);
  const end = formatTime(length * 1000);
  const ruler = (
    <div className="ruler">
      <span>0:00</span>
      {middle !== '0:00' && middle !== end && <span>{middle}</span>}
      <span>{end}</span>
    </div>
  );

  if (mode === 'part') {
    return (
      <>
        <NavBar
          left={(
            <button className="nav-button" onClick={() => { setMode('main'); setSelection(null); }}>
              <BackIcon />
              Edit
            </button>
          )}
          title="Speed up or cut a part"
        />
        <main className="content">
          <p className="lead">Drag across a slow stretch of the story to pick it.</p>
          <section className="card wave-card">
            {waveform}
            {ruler}
            <p className="pick-text">
              {selection
                ? <>Picked {seconds(selection.start)} to {seconds(selection.end)} · <span>{seconds(selection.end - selection.start)}</span></>
                : 'Nothing picked yet'}
            </p>
          </section>

          <section className="field">
            <span className="field-label" id="rate-label">Speed for this part</span>
            <div className="segmented" role="radiogroup" aria-labelledby="rate-label">
              {RATES.map((r) => (
                <button key={r.rate} role="radio" aria-checked={rate === r.rate} onClick={() => setRate(r.rate)}>
                  {r.label}
                </button>
              ))}
            </div>
            <p className="hint">Voices keep their natural pitch.</p>
          </section>

          <LengthCard before={before} after={after} maxLength={maxLength} limitText={limitText} />

          <div className="actions">
            <button className="pill pill-primary" onClick={applyToPart} disabled={!selection}>Apply to this part</button>
            <button className="pill pill-danger" onClick={cutPart} disabled={!selection}>Cut this part instead</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar
        left={<button className="nav-button" onClick={onCancel} disabled={saving}>Cancel</button>}
        title="Edit story"
        right={(
          <button className="nav-button strong" onClick={save} disabled={saving || !fits}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      />
      <main className="content">
        <LengthCard before={before} after={after} maxLength={maxLength} limitText={limitText} />

        <section className="card wave-card">
          {waveform}
          {ruler}
          <div className="preview-row">
            <button className="play-button" onClick={togglePreview} disabled={saving || preview?.loading} aria-label={preview ? 'Stop' : 'Play the edited story'}>
              {preview && !preview.loading ? <StopIcon /> : <PlayIcon />}
            </button>
            <span>
              {!preview && 'Play the edited story'}
              {preview?.loading && 'Getting it ready...'}
              {preview && !preview.loading && <>{formatTime(preview.position)} of {formatTime(storyAfter)}</>}
            </span>
          </div>
        </section>

        <section className="card tool-list">
          <div className="tool-row">
            <span className="tool-text">
              <strong id="pauses-label">Shorten long pauses</strong>
              <span>
                {pauses.length
                  ? `${pauses.length} ${pauses.length === 1 ? 'pause' : 'pauses'} over 1½ seconds · saves ${formatTime(savedByPauses * 1000)}`
                  : 'No long pauses found'}
              </span>
            </span>
            <button
              className="switch"
              role="switch"
              aria-checked={edits.shortenPauses}
              aria-labelledby="pauses-label"
              onClick={() => setEdits((e) => ({ ...e, shortenPauses: !e.shortenPauses }))}
              disabled={!pauses.length || saving}
            >
              <span />
            </button>
          </div>
          <div className="tool-row">
            <span className="tool-text">
              <strong>Trim the start and end</strong>
              <span>Drag the purple handles{trimSaved >= 0.5 ? ` · saves ${formatTime(trimSaved * 1000)}` : ''}</span>
            </span>
          </div>
          <button className="tool-row" onClick={() => setMode('part')} disabled={saving}>
            <span className="tool-text">
              <strong>Speed up or cut a part</strong>
              <span>
                {partCount
                  ? [
                    edits.speedups.length && `${edits.speedups.length} ${edits.speedups.length === 1 ? 'part' : 'parts'} faster`,
                    edits.cuts.length && `${edits.cuts.length} cut`,
                  ].filter(Boolean).join(' · ')
                  : 'Pick a part, then play it faster or cut it'}
              </span>
            </span>
            <ChevronIcon />
          </button>
        </section>

        {error && <p className="error" role="alert">{error}</p>}
        {edited && (
          <button className="pill pill-quiet" onClick={() => setEdits(noEdits(length))} disabled={saving}>
            Undo all changes
          </button>
        )}
      </main>
    </>
  );
}
