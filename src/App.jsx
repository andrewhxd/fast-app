import { useEffect, useState } from 'react';
import EditStory from './EditStory.jsx';
import Home from './Home.jsx';
import RecordStory from './RecordStory.jsx';
import Sidebar from './Sidebar.jsx';
import StoryLibrary from './StoryLibrary.jsx';
import StorySets from './StorySets.jsx';
import { BackIcon, HeadphonesIcon, HomeIcon, MicIcon } from './icons.jsx';
import { listStories } from './storage.js';
import { summarizeSets } from './stories.js';

// Screens: { name: 'home' }, { name: 'sets' }, { name: 'stories' }, { name: 'record', affect, setNumber }
// or { name: 'edit', storyId }.
// Each one is a browser history entry, so the phone's back button goes to the previous screen.
// `depth` counts this app's screens behind the current one, so Back never leaves the app.
const HOME = { name: 'home', depth: 0 };
const SETS_SCREEN = { name: 'sets' };
const STORIES_SCREEN = { name: 'stories' };
const DEFAULT_GROUP_ID = 'default';

// Group IDs are Firestore document IDs. Preserve their case and decoded URL value,
// while rejecting values Firestore cannot use as a document ID.
function readGroupFromUrl() {
  const groupId = new URLSearchParams(window.location.search).get('group');
  if (groupId === null || groupId === '') return { groupId: DEFAULT_GROUP_ID, error: '' };

  const byteLength = new TextEncoder().encode(groupId).length;
  if (
    !groupId.trim()
    || groupId.includes('/')
    || /^__.*__$/.test(groupId)
    || /[\u0000-\u001f\u007f]/.test(groupId)
    || byteLength > 1500
  ) {
    return {
      groupId: DEFAULT_GROUP_ID,
      error: 'That group ID is not valid. Using the default group.',
    };
  }

  return { groupId, error: '' };
}

// After a reload, go back to the screen that was open, but never into the middle of a recording or edit.
function firstScreen() {
  const screen = history.state?.name ? history.state : HOME;
  if (screen.name === 'record') return { ...SETS_SCREEN, depth: screen.depth };
  if (screen.name === 'edit') return { ...STORIES_SCREEN, depth: screen.depth };
  return screen;
}

const MENU = [
  { label: 'Home', screen: HOME, icon: <HomeIcon /> },
  { label: 'Record a Story', screen: SETS_SCREEN, icon: <MicIcon /> },
  { label: 'Listen to Stories', screen: STORIES_SCREEN, icon: <HeadphonesIcon /> },
];

// The menu item each screen belongs to: recording starts from the sets, editing from Listen.
const SECTION = { record: 'sets', edit: 'stories' };

// Recording and editing are focused steps: a narrower page, and no leaving it from the sidebar.
const FOCUSED = ['record', 'edit'];

export default function App() {
  const [screen, setScreen] = useState(firstScreen);
  const [group, setGroup] = useState(readGroupFromUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stories, setStories] = useState(null); // every story's details (no audio), null while loading
  const [notice, setNotice] = useState(''); // e.g. "Added ... to Happy set 1."
  const [error, setError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false); // an edited story is replacing the old one

  function refreshStories() {
    return listStories()
      .then((list) => {
        setStories(list);
        setError('');
      })
      .catch((err) => setError(`Could not load stories: ${err.message}`));
  }

  useEffect(() => {
    history.replaceState(screen, '');
    refreshStories();
    const onBack = (event) => {
      setScreen(event.state?.name ? event.state : HOME);
      setGroup(readGroupFromUrl());
      setMenuOpen(false);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  function goTo(next) {
    setMenuOpen(false);
    setNotice('');
    if (next.name === screen.name) return;
    const entry = { ...next, depth: next.name === 'home' ? 0 : screen.depth + 1 };
    if (entry.name === 'home') history.replaceState(entry, '');
    else history.pushState(entry, '');
    setScreen(entry);
    window.scrollTo(0, 0);
  }

  // Back to the previous screen, or Home if this screen was the first one opened.
  function goBack() {
    if (screen.depth > 0) history.back();
    else goTo(HOME);
  }

  // Leave the record screen for the screen it was opened from.
  // After a save, reload the stories first, so the set totals are never out of date.
  async function finishRecording(message = '') {
    if (message) await refreshStories();
    setNotice(message);
    goBack();
  }

  // After a story is moved, swapped or deleted: reload the stories, then say what happened.
  async function storiesChanged(message) {
    await refreshStories();
    setNotice(message);
  }

  // After an edited story is saved: reload the stories, go back to Listen, and say so.
  async function editSaved(message) {
    setSavingEdit(true); // the old story disappears from the list before this screen closes
    await refreshStories();
    setNotice(message);
    goBack();
    setSavingEdit(false);
  }

  const summary = stories && summarizeSets(stories);
  const recordInSet = (affect, setNumber) => goTo({ name: 'record', affect, setNumber });
  const backButton = (
    <button className="nav-button desktop-hidden" onClick={goBack}>
      <BackIcon />
      Back
    </button>
  );
  const status = error ? <p className="error" role="alert">{error}</p> : !summary && <p className="lead">Loading stories...</p>;
  const groupStatus = group.error && <p className="error" role="alert">{group.error}</p>;

  let content;
  if (screen.name === 'home') {
    content = (
      <Home
        groupId={group.groupId}
        summary={summary}
        menuButton={(
          <button className="nav-button desktop-hidden" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="menu">
            Menu
          </button>
        )}
        onRecord={() => goTo(SETS_SCREEN)}
        onRecordInSet={recordInSet}
        onListen={() => goTo(STORIES_SCREEN)}
      />
    );
  } else if (!summary) {
    content = <main className="content">{status}</main>;
  } else if (screen.name === 'sets') {
    content = <StorySets groupId={group.groupId} summary={summary} notice={notice} backButton={backButton} onRecord={recordInSet} />;
  } else if (screen.name === 'stories') {
    content = (
      <StoryLibrary
        groupId={group.groupId}
        stories={stories}
        summary={summary}
        notice={notice}
        backButton={backButton}
        onChanged={storiesChanged}
        onClearNotice={() => setNotice('')}
        onRecord={recordInSet}
        onEdit={(story) => goTo({ name: 'edit', storyId: story.id })}
      />
    );
  } else if (screen.name === 'edit') {
    const story = stories.find((s) => s.id === screen.storyId);
    content = story ? (
      <EditStory key={story.id} groupId={group.groupId} story={story} summary={summary} onSaved={editSaved} onCancel={goBack} />
    ) : (
      <main className="content">
        {savingEdit ? <p className="lead">Saving...</p> : <p className="error" role="alert">This story was deleted.</p>}
      </main>
    );
  } else {
    content = (
      <RecordStory
        groupId={group.groupId}
        affect={screen.affect}
        setNumber={screen.setNumber}
        summary={summary}
        onSaved={finishRecording}
        onCancel={() => finishRecording()}
      />
    );
  }

  const section = SECTION[screen.name] ?? screen.name;
  const focused = FOCUSED.includes(screen.name);
  return (
    <div className="screen">
      <Sidebar items={MENU} current={section} locked={focused} onGo={goTo} />
      <div className={`page${focused ? ' focused' : ''}`}>
        {groupStatus}
        {content}
        {screen.name === 'home' && error && status}
      </div>

      {menuOpen && (
        <>
          <div className="backdrop" onClick={() => setMenuOpen(false)} />
          <nav id="menu" className="menu">
            {MENU.map((item) => (
              <button
                key={item.label}
                className={item.screen.name === section ? 'current' : ''}
                onClick={() => goTo(item.screen)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
