import { useEffect, useRef, useState } from 'react';
import ClipPlayer from './ClipPlayer.jsx';
import NavBar from './NavBar.jsx';
import { GROUPS } from './StorySets.jsx';
import { CheckIcon, MoreIcon, PlusIcon } from './icons.jsx';
import { deleteStory, loadStoryAudio, moveStory, splitClips, swapStories } from './storage.js';
import {
  SET_MAX, fitsInSet, formatTime, setKey, setName, setStatus, setStatusText, storiesInSet, storyLength, tintClass,
} from './stories.js';

// "Listen": every set and its stories, grouped like the Record a Story screen.
// Play a whole set or one story; each story's ⋯ opens Edit, Move and Delete.
// Rearrange (or Move) moves stories between the two sets of the same affect: tap a story, then a
// story in the other set to swap them, or "Move Here". Only moves that keep both sets at or under
// 11:00 are offered.
// `onChanged(message)` reloads the stories after a change; `notice` says what the last change did,
// until `onClearNotice()` is called. `onEdit(story)` opens the editor.
export default function StoryLibrary({ stories, summary, notice, backButton, onChanged, onClearNotice, onRecord, onEdit }) {
  const [arranging, setArranging] = useState(false);
  const [selectedId, setSelectedId] = useState(''); // the story picked to move, while arranging
  const [openId, setOpenId] = useState(''); // the story whose ⋯ actions are showing
  const [deletingId, setDeletingId] = useState(''); // the story asking "Delete?"
  const [busy, setBusy] = useState(false); // saving a move, swap or delete
  const [error, setError] = useState('');
  const [audio, setAudio] = useState({}); // story id -> its audio Blob, once loaded
  const [loadError, setLoadError] = useState('');

  // Load every story's audio in the background, so the play buttons are ready when tapped
  // (phones only let audio start right from a tap, not after a download).
  useEffect(() => {
    let cancelled = false;
    setLoadError('');
    for (const story of stories) {
      loadStoryAudio(story)
        .then((blob) => {
          if (!cancelled) setAudio((prev) => (prev[story.id] === blob ? prev : { ...prev, [story.id]: blob }));
        })
        .catch((err) => {
          if (!cancelled) setLoadError(`Could not load some of the audio: ${err.message}`);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [stories]);

  // Players need the same clips array on every render, or playback restarts, so the clips are
  // kept until the story or its audio changes.
  const storyClips = useRef(new Map()); // story id -> { story, blob, clips }
  const setClips = useRef(new Map()); // set key -> { parts, clips }

  function clipsFor(story) {
    const blob = audio[story.id];
    if (!blob) return null;
    const kept = storyClips.current.get(story.id);
    if (kept && kept.story === story && kept.blob === blob) return kept.clips;
    const clips = splitClips(story, blob);
    storyClips.current.set(story.id, { story, blob, clips });
    return clips;
  }

  // A whole set as one playlist, each clip labeled with its story's title.
  function clipsForSet(key, inSet) {
    const parts = inSet.map(clipsFor);
    if (!parts.length || parts.some((p) => !p)) return null;
    const kept = setClips.current.get(key);
    if (kept && kept.parts.length === parts.length && kept.parts.every((p, i) => p === parts[i])) return kept.clips;
    const clips = parts.flatMap((p, i) => p.map((clip) => ({ ...clip, label: inSet[i].title })));
    setClips.current.set(key, { parts, clips });
    return clips;
  }

  const selected = arranging ? stories.find((s) => s.id === selectedId) : undefined;
  const totalOf = (story) => summary[setKey(story.affect, story.setNumber)].total;

  // While a story is picked, the other set with the same affect is where it can go.
  function isTargetSet(affect, setNumber) {
    return Boolean(selected) && selected.affect === affect && selected.setNumber !== setNumber;
  }

  // A swap keeps both sets at or under 11:00.
  function canSwap(a, b) {
    const delta = storyLength(b) - storyLength(a);
    return totalOf(a) + delta <= SET_MAX && totalOf(b) - delta <= SET_MAX;
  }

  // Save a move, swap or delete, then reload the stories and say what happened.
  async function change(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(`Could not save the change: ${err.message}`);
      setBusy(false);
      return;
    }
    setSelectedId('');
    setDeletingId('');
    setOpenId('');
    await onChanged(message);
    setBusy(false);
  }

  function startArranging(story) {
    setArranging(true);
    setSelectedId(story ? story.id : '');
    setOpenId('');
    setDeletingId('');
    setError('');
    onClearNotice();
  }

  function stopArranging() {
    setArranging(false);
    setSelectedId('');
    onClearNotice();
  }

  function toggleActions(id) {
    setOpenId(openId === id ? '' : id);
    setDeletingId('');
    onClearNotice();
  }

  // While arranging: pick a story, or swap the picked one with a story in the other set.
  function tapStory(story) {
    setError('');
    onClearNotice();
    if (selected && story.id !== selected.id && isTargetSet(story.affect, story.setNumber) && canSwap(selected, story)) {
      change(() => swapStories(selected, story), `Swapped "${selected.title}" and "${story.title}".`);
    } else {
      setSelectedId(story.id === selectedId ? '' : story.id);
    }
  }

  function moveSelectedTo(setNumber) {
    onClearNotice();
    change(() => moveStory(selected, setNumber), `Moved "${selected.title}" to ${setName(selected.affect, setNumber)}.`);
  }

  function storyRow(story) {
    const length = storyLength(story);

    if (arranging) {
      const isSelected = story.id === selectedId;
      const inTarget = !isSelected && isTargetSet(story.affect, story.setNumber);
      const swappable = inTarget && canSwap(selected, story);
      return (
        <button
          key={story.id}
          className={`story-row pick${isSelected ? ' selected' : ''}`}
          onClick={() => tapStory(story)}
          aria-pressed={isSelected}
          disabled={busy}
        >
          <span className="pick-mark">{isSelected && <CheckIcon />}</span>
          <span className="mini-text">
            <strong>{story.title}</strong>
            <span>{story.storyteller} · {formatTime(length)}</span>
          </span>
          {swappable && <span className="tag">Swap</span>}
          {inTarget && !swappable && <span className="hint">Won&apos;t fit</span>}
        </button>
      );
    }

    const open = openId === story.id;
    return (
      <div key={story.id} className="story-item">
        <div className="story-row">
          <ClipPlayer compact clips={clipsFor(story)} title={story.title} details={story.storyteller} total={length} />
          <button
            className="more-button"
            onClick={() => toggleActions(story.id)}
            aria-label={`More for ${story.title}`}
            aria-expanded={open}
            disabled={busy}
          >
            <MoreIcon />
          </button>
        </div>
        {open && deletingId !== story.id && (
          <div className="story-actions">
            <button className="action edit" onClick={() => onEdit(story)}>Edit</button>
            <button className="action" onClick={() => startArranging(story)}>Move</button>
            <button className="action delete" onClick={() => setDeletingId(story.id)}>Delete</button>
          </div>
        )}
        {deletingId === story.id && (
          <div className="confirm slot-confirm">
            <p>Delete &quot;{story.title}&quot;? This can&apos;t be undone.</p>
            <div className="buttons">
              <button className="pill pill-record" onClick={() => change(() => deleteStory(story), `Deleted "${story.title}".`)} disabled={busy}>
                Delete
              </button>
              <button className="pill pill-white" onClick={() => setDeletingId('')} disabled={busy}>Keep it</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // The last line of a set: record another story, or (while arranging) move the picked story here.
  function lastRow(affect, setNumber, total) {
    if (arranging) {
      if (!isTargetSet(affect, setNumber)) return null;
      if (fitsInSet(total, storyLength(selected))) {
        return (
          <button className="add-row" onClick={() => moveSelectedTo(setNumber)} disabled={busy}>
            <PlusIcon />
            Move &quot;{selected.title}&quot; here
          </button>
        );
      }
      return <p className="add-row muted">No room to move it here ({formatTime(SET_MAX - total)} left)</p>;
    }
    if (setStatus(total) !== 'short') return null;
    return (
      <button className="add-row" onClick={() => onRecord(affect, setNumber)}>
        <PlusIcon />
        Record a story
      </button>
    );
  }

  function setCard(affect, setNumber) {
    const key = setKey(affect, setNumber);
    const inSet = storiesInSet(stories, affect, setNumber);
    const { count, total } = summary[key];
    const last = lastRow(affect, setNumber, total);

    return (
      <section
        key={key}
        className={`set-card listen ${tintClass(affect, total)}${arranging && isTargetSet(affect, setNumber) ? ' is-target' : ''}`}
        aria-label={setName(affect, setNumber)}
      >
        <div className="set-head">
          {count > 0 && !arranging ? (
            <ClipPlayer
              key={inSet.map((s) => s.id).join()}
              compact
              clips={clipsForSet(key, inSet)}
              title={setName(affect, setNumber)}
              details="Whole set"
              total={total}
            />
          ) : (
            <span className="set-text">
              <strong>{setName(affect, setNumber)}</strong>
              <span>{count ? `${count} ${count === 1 ? 'story' : 'stories'} · ${formatTime(total)}` : 'No stories yet'}</span>
            </span>
          )}
          <span className="status-chip">{setStatusText(total)}</span>
        </div>
        {(inSet.length > 0 || last) && (
          <div className="story-list">
            {inSet.map(storyRow)}
            {last}
          </div>
        )}
      </section>
    );
  }

  let arrangeHelp = 'Tap the story you want to move. Happy stories stay in happy sets, and challenging stories in challenging sets.';
  if (selected) {
    const otherNumber = selected.setNumber === 1 ? 2 : 1;
    const other = setName(selected.affect, otherNumber);
    const canMove = fitsInSet(summary[setKey(selected.affect, otherNumber)].total, storyLength(selected));
    arrangeHelp = `Now tap a story in ${other} to swap it with "${selected.title}"${canMove ? ', or tap Move here' : ''}.`;
  }

  return (
    <>
      <NavBar
        left={backButton}
        right={stories.length > 0 && (
          <button className="nav-button" onClick={arranging ? stopArranging : () => startArranging()} disabled={busy}>
            {arranging ? 'Done' : 'Rearrange'}
          </button>
        )}
      />
      <main className="content">
        <h1 className="page-title">Listen</h1>
        {arranging && <p className="lead">{arrangeHelp}</p>}

        {notice && <p className="notice" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {loadError && <p className="error" role="alert">{loadError}</p>}

        <div className="groups">
          {GROUPS.map(({ affect, label }) => (
            <section key={affect} className="group-section" aria-label={label}>
              <h2 className="group-label">{label}</h2>
              {setCard(affect, 1)}
              {setCard(affect, 2)}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
