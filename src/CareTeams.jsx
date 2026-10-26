import { useState } from 'react';
import { Avatar } from './CareTeam.jsx';
import NavBar from './NavBar.jsx';
import { createGroup } from './group.js';
import { CheckIcon, ChevronIcon, PlusIcon } from './icons.jsx';

// Your care teams: everyone you record stories for. Picking one makes it the current team.
// `message` explains why this screen opened instead of the one asked for, e.g. a link to another team.
export default function YourCareTeams({ user, groups, currentId, message, backButton, menuButton, onSelect, onStart }) {
  return (
    <>
      <NavBar left={backButton} right={menuButton} />
      <main className="content team-page">
        <h1 className="page-title">Your care teams</h1>
        <p className="lead">Pick whose stories to work on.</p>
        {message && <p className="error" role="alert">{message}</p>}
        <div className="story-list">
          {groups.map((group, i) => (
            <button key={group.id} className="person-row" onClick={() => onSelect(group.id)}>
              <Avatar name={group.name} index={i + 1} />
              <span className="person-text">
                <strong>{group.name}</strong>
                <span>{group.ownerId === user.uid ? 'Lead caregiver' : 'Member'}</span>
              </span>
              {group.id === currentId ? (
                <span className="current-mark">
                  <CheckIcon />
                  Open
                </span>
              ) : (
                <span className="row-chevron"><ChevronIcon /></span>
              )}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="pill pill-primary" onClick={onStart}>
            <PlusIcon />
            Start a new care team
          </button>
          <p className="footnote">Joining someone else&apos;s care team? Open the invite link you were sent.</p>
        </div>
      </main>
    </>
  );
}

// Starting a care team for a patient, led by the signed-in person.
// `first` when they're on no care team yet, so this is the whole app for now: no Back, but Sign out.
export function StartCareTeam({ user, first, notice, backButton, menuButton, onSignOut, onCreated }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = await createGroup(user, name);
      await onCreated(id, `Started ${name.trim()}'s care team. Invite family and friends from Care team.`);
    } catch (err) {
      setError(`Could not start the care team: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <>
      <NavBar
        left={first ? (
          <span className="wordmark">
            FAST<span>app</span>
          </span>
        ) : backButton}
        right={first ? <button className="nav-button" onClick={onSignOut}>Sign out</button> : menuButton}
      />
      <main className="content team-page">
        <h1 className="page-title">Start a care team</h1>
        <p className="lead">
          A care team is the family and friends recording stories for one person, and later playing them.
          You&apos;ll lead it, and you can invite others next.
        </p>
        {notice && <p className="notice" role="status">{notice}</p>}
        <form className="sign-in-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Your loved one&apos;s name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
              autoComplete="off"
              maxLength={100}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="pill pill-primary" type="submit" disabled={busy || !name.trim()}>Start care team</button>
        </form>
        {first && (
          <p className="footnote">
            Joining someone else&apos;s care team instead? Ask them for an invite link, and open it on this device.
            You&apos;re signed in as {user.email}.
          </p>
        )}
      </main>
    </>
  );
}
