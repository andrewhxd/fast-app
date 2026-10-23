import NavBar from './NavBar.jsx';
import { SetGroups } from './StorySets.jsx';
import { HeadphonesIcon } from './icons.jsx';
import { SETS, SET_MIN, setKey, setName, setStatus, tintClass } from './stories.js';

const MINUTE = 60_000;

// What to do next, e.g. "Next: Happy set 2 needs about 3 more minutes."
function nextStep(summary) {
  const next = SETS.find((s) => setStatus(summary[setKey(s.affect, s.setNumber)].total) === 'short');
  if (!next) return 'Every set has enough stories.';
  const minutes = Math.max(1, Math.ceil((SET_MIN - summary[setKey(next.affect, next.setNumber)].total) / MINUTE));
  return (
    <>
      Next: <strong>{setName(next.affect, next.setNumber)}</strong> needs about {minutes} more {minutes === 1 ? 'minute' : 'minutes'}.
    </>
  );
}

// The home screen: progress on the 4 story sets, and the two ways in.
// On a computer there's room to show the sets themselves too, each with its own Record button.
// `summary` is null while the stories load.
export default function Home({ summary, menuButton, onRecord, onRecordInSet, onListen }) {
  const ready = summary
    ? SETS.filter((s) => setStatus(summary[setKey(s.affect, s.setNumber)].total) === 'complete').length
    : 0;
  const storyCount = summary ? Object.values(summary).reduce((sum, set) => sum + set.count, 0) : 0;

  return (
    <>
      <NavBar
        left={(
          <span className="wordmark">
            FAST<span>app</span>
          </span>
        )}
        right={menuButton}
      />
      <main className="content">
        <h1 className="page-title">Your story sets</h1>

        <section className="card progress-card" aria-label="Progress">
          <div className="card-line">
            <strong>{summary ? `${ready} of ${SETS.length} sets ready` : 'Loading...'}</strong>
            {summary && <span>{storyCount} {storyCount === 1 ? 'story' : 'stories'}</span>}
          </div>
          <div className="segments">
            {SETS.map(({ affect, setNumber }) => {
              const total = summary ? summary[setKey(affect, setNumber)].total : 0;
              const filled = setStatus(total) === 'short' ? Math.min(total / SET_MIN, 1) : 1;
              return (
                <div key={setKey(affect, setNumber)} className={`bar ${tintClass(affect, total)}`}>
                  <div className="bar-fill" style={{ width: `${filled * 100}%` }} />
                </div>
              );
            })}
          </div>
          {summary && <p className="card-text">{nextStep(summary)}</p>}
        </section>

        {summary && (
          <div className="desktop-only">
            <SetGroups summary={summary} onRecord={onRecordInSet} />
          </div>
        )}

        <div className="actions home-actions">
          <button className="pill pill-primary" onClick={onRecord}>
            <span className="record-dot soft" aria-hidden="true" />
            Record a story
          </button>
          <button className="pill pill-white" onClick={onListen}>
            <HeadphonesIcon />
            Listen to stories
          </button>
          <p className="footnote">Playing stories to your loved one opens once all 4 sets are approved.</p>
        </div>
      </main>
    </>
  );
}
