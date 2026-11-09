import { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import { ACCESS, accessDoes, accessLabel, canManage } from './access.js';
import {
  cancelInvite, createInvite, inviteLink, listInvites, listMembers, normalizeEmail, removeMember, setMemberAccess,
} from './group.js';
import { CheckIcon, CopyIcon, MoreIcon, PlusIcon, ShareIcon } from './icons.jsx';

// A person's initials in a colored circle, e.g. "AS" for Ann Smith.
export function Avatar({ name, index = 0 }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
  return <span className={`avatar avatar-${index % 4}`} aria-hidden="true">{initials}</span>;
}

// "Invite people and manage..." from "invite people and manage...".
const sentence = (text) => text[0].toUpperCase() + text.slice(1);

// The 4 access levels to pick from, each with what it can do.
function AccessChoice({ value, onChange, name }) {
  return (
    <fieldset className="checklist">
      <legend className="field-label">What can they do?</legend>
      {ACCESS.map((level) => (
        <label key={level.key} className={`check-row${value === level.key ? ' on' : ''}`}>
          <input type="radio" name={name} checked={value === level.key} onChange={() => onChange(level.key)} />
          <span className="check-box round" aria-hidden="true"><CheckIcon /></span>
          <span className="access-text">
            <strong>{level.label}</strong>
            <span>{sentence(level.does)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// "Oct 26"
const shortDate = (timestamp) => timestamp.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Copy an invite link. Returns false if the browser refused, so the caller can show the link instead.
async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

// The Care team screen: who's on the team and what each person can do. The lead caregiver and
// administrators invite people, change their access and remove them. Members can leave; the lead
// caregiver can't, since every team needs one.
export default function CareTeam({ user, group, notice: startNotice, menuButton, backButton, onInvite, onLeft }) {
  const isOwner = group.ownerId === user.uid;
  const manager = canManage(group.access);
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [open, setOpen] = useState(null); // the row whose options are showing: a uid or an invite id
  const [confirming, setConfirming] = useState(null); // a member uid to remove, or 'leave'
  const [changing, setChanging] = useState(null); // { uid, access } while changing someone's access
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(startNotice);

  async function load() {
    try {
      const [people, pending] = await Promise.all([listMembers(group), manager ? listInvites(group.id) : []]);
      setMembers(people);
      setInvites(pending);
    } catch (err) {
      setError(`Could not load the care team: ${err.message}`);
    }
  }

  useEffect(() => {
    load();
  }, [group.id]);

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      setNotice(message);
      setOpen(null);
      setConfirming(null);
      setChanging(null);
      await load();
    } catch (err) {
      setError(`That didn't work: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy(invite) {
    const copied = await copyLink(inviteLink(group.id, invite.id));
    setNotice(copied ? `Copied the invite link for ${invite.email}.` : '');
    setError(copied ? '' : `Your browser didn't allow copying. The link is: ${inviteLink(group.id, invite.id)}`);
  }

  async function leave() {
    setBusy(true);
    setError('');
    try {
      await removeMember(group.id, user.uid);
      await onLeft(`You left ${group.name}'s care team.`);
    } catch (err) {
      setError(`That didn't work: ${err.message}`);
      setBusy(false);
    }
  }

  const toggle = (id) => {
    setOpen(open === id ? null : id);
    setConfirming(null);
    setChanging(null);
  };
  const owner = members?.find((m) => m.uid === group.ownerId);
  const others = members?.filter((m) => m.uid !== group.ownerId) ?? [];

  function personRow(person, index) {
    const you = person.uid === user.uid;
    const lead = person.uid === group.ownerId;
    const canChange = manager && !you && !lead;
    return (
      <div key={person.uid}>
        <div className="person-row">
          <Avatar name={person.name} index={index} />
          <span className="person-text">
            <strong>
              {person.name}
              {you && <span className="muted"> (you)</span>}
            </strong>
            <span>{lead ? 'Lead caregiver' : accessLabel(person.access)}</span>
            <span>{person.email}</span>
          </span>
          {canChange && (
            <button
              className="more-button"
              onClick={() => toggle(person.uid)}
              aria-expanded={open === person.uid}
              aria-label={`Options for ${person.name}`}
            >
              <MoreIcon />
            </button>
          )}
        </div>
        {open === person.uid && (
          changing?.uid === person.uid ? (
            <div className="slot-confirm change-access">
              <AccessChoice value={changing.access} onChange={(access) => setChanging({ uid: person.uid, access })} name={`access-${person.uid}`} />
              <div className="confirm">
                <div className="buttons">
                  <button
                    className="pill pill-primary"
                    onClick={() => run(() => setMemberAccess(group.id, person.uid, changing.access), `${person.name} now has ${accessLabel(changing.access)} access.`)}
                    disabled={busy || changing.access === person.access}
                  >
                    Save
                  </button>
                  <button className="pill pill-white" onClick={() => setChanging(null)} disabled={busy}>Cancel</button>
                </div>
              </div>
            </div>
          ) : confirming === person.uid ? (
            <div className="confirm slot-confirm">
              <p>Remove {person.name}? They won&apos;t see or record {group.name}&apos;s stories anymore. Their stories stay.</p>
              <div className="buttons">
                <button className="pill pill-record" onClick={() => run(() => removeMember(group.id, person.uid), `Removed ${person.name} from the care team.`)} disabled={busy}>
                  Remove
                </button>
                <button className="pill pill-white" onClick={() => setConfirming(null)} disabled={busy}>Keep</button>
              </div>
            </div>
          ) : (
            <div className="story-actions double">
              <button className="action edit" onClick={() => setChanging({ uid: person.uid, access: person.access })}>Change access</button>
              <button className="action delete" onClick={() => setConfirming(person.uid)}>Remove</button>
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <>
      <NavBar left={backButton} right={menuButton} />
      <main className="content team-page">
        <h1 className="page-title">{group.name}&apos;s care team</h1>
        <p className="lead">
          {isOwner
            ? "As the lead caregiver, you invite people, choose what each person can do, and remove them."
            : `With ${accessLabel(group.access)} access, you can ${accessDoes(group.access)}.`}
        </p>
        {notice && <p className="notice" role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {!members ? (
          !error && <p className="lead">Loading the care team...</p>
        ) : (
          <>
            <section className="group-section">
              <h2 className="group-label">Leads the care team</h2>
              <div className="story-list">{owner && personRow(owner, 0)}</div>
            </section>

            <section className="group-section">
              <h2 className="group-label">Family and friends</h2>
              <div className="story-list">
                {others.map((person, i) => personRow(person, i + 1))}
                {others.length === 0 && <p className="add-row muted">Nobody else yet.</p>}
                {manager && (
                  <button className="add-row" onClick={onInvite}>
                    <PlusIcon />
                    Invite someone
                  </button>
                )}
              </div>
            </section>

            {manager && invites.length > 0 && (
              <section className="group-section">
                <h2 className="group-label">Invited, not joined yet</h2>
                <div className="story-list">
                  {invites.map((invite) => (
                    <div key={invite.id}>
                      <div className="person-row">
                        <span className="avatar avatar-pending" aria-hidden="true">?</span>
                        <span className="person-text">
                          <strong>{invite.email}</strong>
                          <span>{accessLabel(invite.access)} · Invited {shortDate(invite.createdAt)}</span>
                        </span>
                        <button
                          className="more-button"
                          onClick={() => toggle(invite.id)}
                          aria-expanded={open === invite.id}
                          aria-label={`Options for the invite to ${invite.email}`}
                        >
                          <MoreIcon />
                        </button>
                      </div>
                      {open === invite.id && (
                        <div className="story-actions double">
                          <button className="action edit" onClick={() => copy(invite)}>Copy link</button>
                          <button className="action delete" onClick={() => run(() => cancelInvite(group.id, invite.id), `Canceled the invite to ${invite.email}.`)} disabled={busy}>
                            Cancel invite
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!isOwner && (
              <div className="actions">
                {confirming === 'leave' ? (
                  <div className="confirm">
                    <p>Leave {group.name}&apos;s care team? You won&apos;t see its stories unless you&apos;re invited again.</p>
                    <div className="buttons">
                      <button className="pill pill-record" onClick={leave} disabled={busy}>Leave</button>
                      <button className="pill pill-white" onClick={() => setConfirming(null)} disabled={busy}>Stay</button>
                    </div>
                  </div>
                ) : (
                  <button className="pill pill-danger" onClick={() => setConfirming('leave')}>Leave this care team</button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

// Inviting someone: their email address, then a link to send them from your own phone.
// The app can't send email itself on the free plan, and a link works by text message too.
export function InviteSomeone({ user, group, backButton, menuButton, onDone }) {
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('stories');
  const [link, setLink] = useState(null); // { email, url } once the invite exists
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault();
    const address = normalizeEmail(email);
    setBusy(true);
    setError('');
    try {
      const [members, invites] = await Promise.all([listMembers(group), listInvites(group.id)]);
      if (members.some((m) => m.email === address)) {
        setError(`${address} is already on the care team.`);
        return;
      }
      const existing = invites.find((invite) => invite.email === address);
      const inviteId = existing?.id ?? await createInvite(group, user, address, access);
      setNotice(existing ? `${address} was already invited, with ${accessLabel(existing.access)} access, so this is the same link.` : '');
      setLink({ email: address, url: inviteLink(group.id, inviteId) });
    } catch (err) {
      setError(`Could not create the invite: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const copied = await copyLink(link.url);
    setNotice(copied ? 'Copied the link. Paste it into a text or an email.' : "Your browser didn't allow copying. Select the link above and copy it.");
  }

  async function share() {
    try {
      await navigator.share({
        title: `Join ${group.name}'s care team`,
        text: `I'm inviting you to ${group.name}'s care team on FASTapp, to record stories together. Sign in with ${link.email}.`,
        url: link.url,
      });
    } catch {
      // Closing the share sheet is fine.
    }
  }

  if (link) {
    return (
      <>
        <NavBar right={<button className="nav-button strong" onClick={onDone}>Done</button>} />
        <main className="content team-page">
          <h1 className="page-title">Send the invite</h1>
          <p className="lead">
            Send this link from your phone, by text or email. It opens FASTapp and adds them to {group.name}&apos;s care team.
          </p>
          <section className="card">
            <span className="field-label">Invite link</span>
            <p className="link-text">{link.url}</p>
            <p className="hint">Only {link.email} can use it, after signing in with that address.</p>
          </section>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="actions">
            {'share' in navigator && (
              <button className="pill pill-primary" onClick={share}>
                <ShareIcon />
                Share invite
              </button>
            )}
            <button className={`pill ${'share' in navigator ? 'pill-white' : 'pill-primary'}`} onClick={copy}>
              <CopyIcon />
              Copy link
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar left={backButton} right={menuButton} />
      <main className="content team-page">
        <h1 className="page-title">Invite someone</h1>
        <p className="lead">
          Choose what they can do on {group.name}&apos;s care team. You can change it later.
        </p>
        <form className="sign-in-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Their email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
            <span className="hint">They sign in with this address to join.</span>
          </label>
          <AccessChoice value={access} onChange={setAccess} name="invite-access" />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="pill pill-primary" type="submit" disabled={busy}>Create invite</button>
        </form>
      </main>
    </>
  );
}
