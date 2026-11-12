import { useEffect, useMemo, useState } from 'react';
import ClipPlayer from './ClipPlayer.jsx';
import { loadStoryAudio, splitClips } from './storage.js';
import { setName } from './stories.js';

// Plays one set to the patient: `stories` in the order given (already shuffled), one after another.
// Calls onFinished() when the caregiver continues, after the set ends or if they stop early.
export default function PlaySet({ affect, setNumber, stories, onFinished }) {
  const [audio, setAudio] = useState({}); // story id -> its audio Blob, once loaded
  const [error, setError] = useState('');
  const [ended, setEnded] = useState(false);

  // Load every story's audio first, since phones only let audio start right from a tap.
  useEffect(() => {
    let cancelled = false;
    for (const story of stories) {
      loadStoryAudio(story)
        .then((blob) => {
          if (!cancelled) setAudio((prev) => ({ ...prev, [story.id]: blob }));
        })
        .catch((err) => {
          if (!cancelled) setError(`Could not load the stories: ${err.message}`);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [stories]);

  // The whole set as one playlist, once every story has loaded (null until then).
  const loaded = stories.every((story) => audio[story.id]);
  const clips = useMemo(() => (loaded
    ? stories.flatMap((story) => splitClips(story, audio[story.id]).map((clip) => ({ ...clip, label: story.title })))
    : null), [loaded, stories, audio]);

  return (
    <main className="content">
      <h1 className="page-title">Playing {setName(affect, setNumber)}</h1>
      <p className="lead">
        {stories.length} {stories.length === 1 ? 'story' : 'stories'}, in a random order.
        Stay out of view until it finishes.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <section className={`review-card tint-${affect}`}>
        <ClipPlayer clips={clips} idleLabel="Tap play to start" onEnded={() => setEnded(true)} />
      </section>
      <div className="actions">
        {ended ? (
          <button className="pill pill-primary" onClick={onFinished}>Continue</button>
        ) : (
          <button className="pill pill-white" onClick={onFinished}>Stop early</button>
        )}
      </div>
    </main>
  );
}
