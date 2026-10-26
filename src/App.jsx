import { useEffect, useRef, useState } from 'react';
import CareTeam, { InviteSomeone } from './CareTeam.jsx';
import YourCareTeams, { StartCareTeam } from './CareTeams.jsx';
import EditStory from './EditStory.jsx';
import Home from './Home.jsx';
import JoinGroup from './JoinGroup.jsx';
import NavBar from './NavBar.jsx';
import RecordStory from './RecordStory.jsx';
import Sidebar from './Sidebar.jsx';
import SignIn from './SignIn.jsx';
import StoryLibrary from './StoryLibrary.jsx';
import StorySets from './StorySets.jsx';
import { displayName, signOut, useUser } from './auth.js';
import { isValidGroupId, listMyGroups } from './group.js';
import { BackIcon, HeadphonesIcon, HomeIcon, MicIcon, PeopleIcon } from './icons.jsx';
import { listStories } from './storage.js';
import { summarizeSets } from './stories.js';

// Screens: { name: 'home' }, { name: 'sets' }, { name: 'stories' }, { name: 'record', affect, setNumber },
// { name: 'edit', storyId }, { name: 'team' } (Care team), { name: 'invite' }, { name: 'teams' }
// (Your care teams) or { name: 'newTeam' }.
// Each one is a browser history entry, so the phone's back button goes to the previous screen.
// `depth` counts this app's screens behind the current one, so Back never leaves the app.
const HOME = { name: 'home', depth: 0 };
const SETS_SCREEN = { name: 'sets' };
const STORIES_SCREEN = { name: 'stories' };
const TEAM_SCREEN = { name: 'team' };
const INVITE_SCREEN = { name: 'invite' };
const TEAMS_SCREEN = { name: 'teams' };
const NEW_TEAM_SCREEN = { name: 'newTeam' };

// The current group (care team) is in the URL as ?group=<groupId>, so a link opens the right one.
// Without it, the app opens the group used last on this device, or the first one.
function readGroupFromUrl() {
  const groupId = new URLSearchParams(window.location.search).get('group');
  if (groupId === null || groupId === '') return { groupId: null, error: '' };
  if (!isValidGroupId(groupId)) {
    return { groupId: null, error: "That link's care team ID isn't right, so here are your care teams." };
  }
  return { groupId, error: '' };
}

// An invite link: ?group=<groupId>&invite=<inviteId>.
function readInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('group');
  const inviteId = params.get('invite');
  return isValidGroupId(groupId) && /^[A-Za-z0-9]{1,40}$/.test(inviteId ?? '') ? { groupId, inviteId } : null;
}

// The group used last on this device, per account. Storage can be unavailable (private browsing).
const lastGroupKey = (uid) => `fastapp.lastGroup.${uid}`;
function rememberGroup(uid, groupId) {
  try {
    localStorage.setItem(lastGroupKey(uid), groupId);
  } catch {
    // Not remembering is fine.
  }
}
function lastGroup(uid) {
  try {
    return localStorage.getItem(lastGroupKey(uid));
  } catch {
    return null;
  }
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
  { label: 'Care team', screen: TEAM_SCREEN, icon: <PeopleIcon /> },
];

// The menu item each screen belongs to: recording starts from the sets, editing from Listen,
// and inviting, switching and starting care teams from Care team.
const SECTION = { record: 'sets', edit: 'stories', invite: 'team', teams: 'team', newTeam: 'team' };

// Recording and editing are focused steps: a narrower page, and no leaving it from the sidebar.
const FOCUSED = ['record', 'edit'];

// Everything starts with signing in. Each account gets a fresh app, so nothing from one person's
// session (screens, stories, the current group) carries over to the next.
export default function App() {
  const user = useUser();
  if (user === undefined) return <Loading />;
  if (!user) return <SignIn invited={readInviteFromUrl() !== null} />;
  return <CareApp key={user.uid} user={user} />;
}

function Loading({ text = '', error = '' }) {
  return (
    <div className="screen solo">
      <div className="page">
        <NavBar
          left={(
            <span className="wordmark">
              FAST<span>app</span>
            </span>
          )}
        />
        <main className="content">
          {error ? <p className="error" role="alert">{error}</p> : text && <p className="lead">{text}</p>}
        </main>
      </div>
    </div>
  );
}

function CareApp({ user }) {
  const [screen, setScreen] = useState(firstScreen);
  const [group, setGroup] = useState(readGroupFromUrl);
  const [invite, setInvite] = useState(readInviteFromUrl);
  const [groups, setGroups] = useState(null); // the groups this person is in, null while loading
  const [groupsError, setGroupsError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [stories, setStories] = useState(null); // every story's details (no audio), null while loading
  const [storiesGroupId, setStoriesGroupId] = useState(null);
  const storyLoadId = useRef(0);
  const activeGroupId = useRef(group.groupId);
  activeGroupId.current = group.groupId;
  const [notice, setNotice] = useState(''); // e.g. "Added ... to Happy set 1."
  const [error, setError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false); // an edited story is replacing the old one

  const currentGroup = groups?.find((item) => item.id === group.groupId);

  async function refreshStories(groupId = group.groupId) {
    if (groupId !== activeGroupId.current) return;
    const loadId = ++storyLoadId.current;
    setStories(null);
    setError('');
    try {
      const list = await listStories(groupId);
      if (loadId === storyLoadId.current && groupId === activeGroupId.current) {
        setStories(list);
        setStoriesGroupId(groupId);
      }
    } catch (err) {
      if (loadId === storyLoadId.current && groupId === activeGroupId.current) {
        setError(`Could not load stories: ${err.message}`);
      }
    }
  }

  async function refreshGroups() {
    const list = await listMyGroups(user.uid);
    setGroups(list);
    return list;
  }

  useEffect(() => {
    history.replaceState(screen, '');
    const onBack = (event) => {
      setScreen(event.state?.name ? event.state : HOME);
      setGroup(readGroupFromUrl());
      setInvite(readInviteFromUrl());
      setMenuOpen(false);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMyGroups(user.uid)
      .then((list) => {
        if (!cancelled) setGroups(list);
      })
      .catch((err) => {
        if (!cancelled) setGroupsError(`Could not load your care teams: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only a group this person is in has stories they can load.
  useEffect(() => {
    if (!currentGroup) return undefined;
    rememberGroup(user.uid, currentGroup.id);
    refreshStories(currentGroup.id);
    return () => {
      storyLoadId.current += 1;
    };
  }, [currentGroup?.id]);

  // With no group in the URL, open the one used last on this device, or the first.
  useEffect(() => {
    if (!groups?.length || group.groupId || invite) return;
    const remembered = lastGroup(user.uid);
    showGroup(groups.some((item) => item.id === remembered) ? remembered : groups[0].id, { replace: true, keepError: true });
  }, [groups, group.groupId, invite]);

  // An invite to a group this person is already in: just open that group.
  useEffect(() => {
    if (invite && groups?.some((item) => item.id === invite.groupId)) {
      dismissInvite();
      showGroup(invite.groupId, { replace: true });
    }
  }, [invite, groups]);

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

  // Open a group: a new history entry with it in the URL, so Back returns to the previous group.
  function showGroup(groupId, { replace = false, screen: next, keepError = false } = {}) {
    const url = new URL(window.location.href);
    url.searchParams.set('group', groupId);
    url.searchParams.delete('invite');
    const entry = next ?? (screen.name === 'teams' || screen.name === 'newTeam' ? HOME : screen);
    if (replace) history.replaceState(entry, '', url);
    else history.pushState(entry, '', url);
    setScreen(entry);
    setGroup({ groupId, error: keepError ? group.error : '' });
    setMenuOpen(false);
    setNotice('');
  }

  function selectGroup(groupId) {
    if (groupId === group.groupId) goTo(HOME);
    else showGroup(groupId, { screen: { ...HOME, depth: 0 } });
  }

  function dismissInvite() {
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    history.replaceState(history.state, '', url);
    setInvite(null);
  }

  async function joined(groupId) {
    const list = await refreshGroups();
    setInvite(null);
    showGroup(groupId, { replace: true, screen: HOME });
    const name = list.find((item) => item.id === groupId)?.name;
    setNotice(name ? `You joined ${name}'s care team. Welcome!` : 'You joined the care team. Welcome!');
  }

  async function started(groupId, message) {
    await refreshGroups();
    showGroup(groupId, { screen: HOME, replace: screen.name !== 'newTeam' });
    setNotice(message);
  }

  async function left(message) {
    const list = await refreshGroups();
    if (list.length) showGroup(list[0].id, { screen: HOME });
    else setGroup({ groupId: null, error: '' });
    setNotice(message);
  }

  // Signing out from the menu forgets the current group; from an invite that doesn't work,
  // the invite link stays, so it works after signing in with the right account.
  function signOutOf({ keepInvite = false } = {}) {
    if (!keepInvite) history.replaceState(HOME, '', window.location.pathname);
    signOut();
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

  if (groups === null) return <Loading text={groupsError ? '' : 'Loading your care teams...'} error={groupsError} />;

  if (invite && !groups.some((item) => item.id === invite.groupId)) {
    return (
      <JoinGroup
        user={user}
        groupId={invite.groupId}
        inviteId={invite.inviteId}
        onJoined={joined}
        onDismiss={dismissInvite}
        onSignOut={() => signOutOf({ keepInvite: true })}
      />
    );
  }

  if (groups.length === 0) {
    return (
      <div className="screen solo">
        <div className="page">
          <StartCareTeam user={user} first notice={notice} onSignOut={() => signOutOf()} onCreated={started} />
        </div>
      </div>
    );
  }

  if (!group.groupId) return <Loading />;

  const currentStories = currentGroup && storiesGroupId === group.groupId ? stories : null;
  const summary = currentStories && summarizeSets(currentStories);
  const recordInSet = (affect, setNumber) => goTo({ name: 'record', affect, setNumber });
  const backButton = (
    <button className="nav-button desktop-hidden" onClick={goBack}>
      <BackIcon />
      Back
    </button>
  );
  const menuButton = (
    <button className="nav-button desktop-hidden" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="menu">
      Menu
    </button>
  );
  const status = error ? <p className="error" role="alert">{error}</p> : !summary && <p className="lead">Loading stories...</p>;
  const teamsScreen = (message) => (
    <YourCareTeams
      user={user}
      groups={groups}
      currentId={currentGroup?.id}
      message={message}
      backButton={currentGroup ? backButton : null}
      menuButton={menuButton}
      onSelect={selectGroup}
      onStart={() => goTo(NEW_TEAM_SCREEN)}
    />
  );

  let content;
  if (screen.name === 'newTeam') {
    content = <StartCareTeam user={user} backButton={backButton} menuButton={menuButton} onCreated={started} />;
  } else if (screen.name === 'teams') {
    content = teamsScreen(group.error);
  } else if (!currentGroup) {
    // A link to a group this person isn't in (or was removed from).
    content = teamsScreen(group.error || "You aren't on that care team, so here are the ones you're on.");
  } else if (screen.name === 'team') {
    content = (
      <CareTeam
        key={currentGroup.id}
        user={user}
        group={currentGroup}
        notice={notice}
        backButton={backButton}
        menuButton={menuButton}
        onInvite={() => goTo(INVITE_SCREEN)}
        onLeft={left}
      />
    );
  } else if (screen.name === 'invite') {
    content = currentGroup.ownerId === user.uid ? (
      <InviteSomeone user={user} group={currentGroup} backButton={backButton} menuButton={menuButton} onDone={goBack} />
    ) : (
      <main className="content"><p className="error" role="alert">Only the lead caregiver can invite people.</p></main>
    );
  } else if (screen.name === 'home') {
    content = (
      <Home
        groupName={currentGroup.name}
        canSwitch={groups.length > 1}
        onSwitch={() => goTo(TEAMS_SCREEN)}
        notice={notice}
        summary={summary}
        menuButton={menuButton}
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
        key={group.groupId}
        stories={currentStories}
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
    const story = currentStories?.find((s) => s.id === screen.storyId);
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
  const account = { name: displayName(user), email: user.email };
  return (
    <div className="screen">
      <Sidebar
        items={MENU}
        current={section}
        locked={focused}
        onGo={goTo}
        groupName={currentGroup?.name}
        account={account}
        onTeams={() => goTo(TEAMS_SCREEN)}
        onSignOut={() => signOutOf()}
      />
      <div className={`page${focused ? ' focused' : ''}`}>
        {content}
        {screen.name === 'home' && error && status}
      </div>

      {menuOpen && (
        <>
          <div className="backdrop" onClick={() => setMenuOpen(false)} />
          <nav id="menu" className="menu">
            <div className="menu-account">
              <strong>{account.name}</strong>
              <span>{account.email}</span>
            </div>
            {MENU.map((item) => (
              <button
                key={item.label}
                className={item.screen.name === section ? 'current' : ''}
                onClick={() => goTo(item.screen)}
              >
                {item.label}
              </button>
            ))}
            <hr />
            <button onClick={() => goTo(TEAMS_SCREEN)}>Your care teams</button>
            <button onClick={() => signOutOf()}>Sign out</button>
          </nav>
        </>
      )}
    </div>
  );
}
