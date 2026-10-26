import { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import { checkEmailVerified, sendVerificationEmail } from './auth.js';
import { acceptInvite, getInvite } from './group.js';

// Opened from an invite link (?group=...&invite=...): who invited you to which care team, and Join.
// Joining needs a confirmed email address, since the invite is for one address. Google accounts
// are always confirmed; an email account confirms with the link Firebase emailed at sign-up.
export default function JoinGroup({ user, groupId, inviteId, onJoined, onDismiss, onSignOut }) {
  const [invite, setInvite] = useState(undefined); // undefined while loading, null if it doesn't work
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    getInvite(groupId, inviteId)
      .then((found) => !cancelled && setInvite(found))
      .catch((err) => !cancelled && setError(`Could not open the invite: ${err.message}`));
    return () => {
      cancelled = true;
    };
  }, [groupId, inviteId]);

  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const join = () => run(async () => {
    try {
      await acceptInvite(groupId, inviteId, user);
    } catch (err) {
      throw new Error(`Could not join the care team (${err.code ?? err.message}). Please try again.`);
    }
    await onJoined(groupId);
  });

  const confirmed = () => run(async () => {
    if (!(await checkEmailVerified())) {
      throw new Error("Your email address isn't confirmed yet. Open the link in the email, then try again.");
    }
  });

  const resend = () => run(async () => {
    await sendVerificationEmail();
    setNotice(`We sent a new link to ${user.email}.`);
  });

  let body;
  if (invite === undefined) {
    body = error ? <p className="error" role="alert">{error}</p> : <p className="lead">Opening your invite...</p>;
  } else if (invite === null) {
    body = (
      <>
        <h1 className="page-title">This invite link doesn&apos;t work</h1>
        <p className="lead">
          It may be for a different email address, or it was canceled or already used.
          You&apos;re signed in as <strong>{user.email}</strong>.
        </p>
        <div className="actions">
          <button className="pill pill-primary" onClick={onSignOut}>Sign in with another account</button>
          <button className="pill pill-quiet" onClick={onDismiss}>Continue without joining</button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="page-title">
          {invite.invitedByName} invited you to {invite.groupName}&apos;s care team
        </h1>
        <p className="lead">
          You&apos;ll be able to record stories for {invite.groupName}, listen to them, and edit them, together with
          everyone else on the care team.
        </p>
        {!user.emailVerified && (
          <section className="card">
            <strong>First, confirm your email address</strong>
            <p className="card-text">
              We sent a link to <strong>{user.email}</strong>. Open it, then come back here.
            </p>
          </section>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="actions">
          {user.emailVerified ? (
            <button className="pill pill-primary" onClick={join} disabled={busy}>Join the care team</button>
          ) : (
            <>
              <button className="pill pill-primary" onClick={confirmed} disabled={busy}>I&apos;ve confirmed it</button>
              <button className="pill pill-white" onClick={resend} disabled={busy}>Send the email again</button>
            </>
          )}
          <button className="pill pill-quiet" onClick={onDismiss} disabled={busy}>Not now</button>
        </div>
      </>
    );
  }

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
        <main className="content">{body}</main>
      </div>
    </div>
  );
}
