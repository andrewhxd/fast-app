import { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import StoryEditor from './StoryEditor.jsx';
import { loadStoryAudio, replaceStoryAudio, splitClips } from './storage.js';
import { SET_MAX, STORY_MAX, formatTime, setKey, setName, storyLength } from './stories.js';

// Edit a saved story (from Listen to Stories): open it in the editor, then save the edited audio
// in its place. The story may grow back up to 5:00, as long as its set stays at or under 11:00.
export default function EditStory({ story, summary, onSaved, onCancel }) {
  const [clips, setClips] = useState(null); // { name, story }
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadStoryAudio(story)
      .then((blob) => {
        const [name, storyClip] = splitClips(story, blob);
        if (!cancelled) setClips({ name, story: storyClip });
      })
      .catch((err) => {
        if (!cancelled) setError(`Could not load the story: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [story]);

  if (!clips) {
    return (
      <>
        <NavBar left={<button className="nav-button" onClick={onCancel}>Cancel</button>} title="Edit story" />
        <main className="content">
          <p className={error ? 'error' : 'lead'} role={error ? 'alert' : undefined}>{error || 'Loading the story...'}</p>
        </main>
      </>
    );
  }

  const set = setName(story.affect, story.setNumber);
  const room = SET_MAX - (summary[setKey(story.affect, story.setNumber)].total - storyLength(story));
  return (
    <StoryEditor
      name={clips.name}
      story={clips.story}
      maxLength={Math.min(STORY_MAX, room)}
      limitText={room < STORY_MAX ? `${set} has room for ${formatTime(room)}` : `A story can be up to ${formatTime(STORY_MAX)}`}
      onSave={async (edited) => {
        await replaceStoryAudio(story, edited);
        await onSaved(`Saved your edits to "${story.title}".`);
      }}
      onCancel={onCancel}
    />
  );
}
