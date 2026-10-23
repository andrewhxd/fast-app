import NavBar from './NavBar.jsx';
import { CheckIcon } from './icons.jsx';
import {
  SET_MAX, SET_MIN, STORY_MAX, formatTime, setKey, setName, setStatus, setStatusText, tintClass,
} from './stories.js';

export const GROUPS = [
  { affect: 'happy', label: 'Happy events' },
  { affect: 'challenging', label: 'Challenging events' },
];

// The 9:00 to 11:00 target sits at the right end of every set's bar, which runs from 0:00 to 11:00.
const TARGET_START = `${(SET_MIN / SET_MAX) * 100}%`;

// Progress toward a set's time target, with the target range shaded.
export function SetBar({ total }) {
  return (
    <div className="bar">
      {setStatus(total) !== 'complete' && <div className="bar-zone" style={{ left: TARGET_START }} />}
      <div className="bar-fill" style={{ width: `${Math.min(total / SET_MAX, 1) * 100}%` }} />
    </div>
  );
}

function SetCard({ affect, setNumber, count, total, onRecord }) {
  const status = setStatus(total);
  const stories = count ? `${count} ${count === 1 ? 'story' : 'stories'} · ${formatTime(total)}` : 'No stories yet';
  return (
    <div className={`set-card ${tintClass(affect, total)}`}>
      <div className="set-head">
        <span className="set-text">
          <strong>{setName(affect, setNumber)}</strong>
          <span>{status === 'short' && count ? `${stories} · ${setStatusText(total)}` : stories}</span>
        </span>
        {status === 'short' && (
          <button className="pill-small pill-primary" onClick={onRecord} aria-label={`Record in ${setName(affect, setNumber)}`}>
            <span className="record-dot soft" aria-hidden="true" />
            Record
          </button>
        )}
        {status === 'complete' && (
          <span className="set-ready">
            <CheckIcon />
            Ready
          </span>
        )}
        {status === 'over' && <span className="set-ready">{setStatusText(total)}</span>}
      </div>
      <SetBar total={total} />
    </div>
  );
}

// The 4 sets, happy beside challenging on a computer, each with a Record button until it's full.
export function SetGroups({ summary, onRecord }) {
  return (
    <div className="groups">
      {GROUPS.map(({ affect, label }) => (
        <section key={affect} className="group-section" aria-label={label}>
          <h2 className="group-label">{label}</h2>
          {[1, 2].map((setNumber) => (
            <SetCard
              key={setNumber}
              affect={affect}
              setNumber={setNumber}
              {...summary[setKey(affect, setNumber)]}
              onRecord={() => onRecord(affect, setNumber)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

// "Record a story": pick a set. Each set's total time against its 9:00 to 11:00 target.
export default function StorySets({ summary, notice, backButton, onRecord }) {
  return (
    <>
      <NavBar left={backButton} />
      <main className="content">
        <h1 className="page-title">Record a story</h1>
        <p className="lead">
          Pick a set. Each set needs about 10 minutes of stories (9 to 11), and a story can be up to {formatTime(STORY_MAX)}, counting the name.
        </p>
        {notice && <p className="notice" role="status">{notice}</p>}

        <SetGroups summary={summary} onRecord={onRecord} />
      </main>
    </>
  );
}
