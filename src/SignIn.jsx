import { useState } from 'react';
import NavBar from './NavBar.jsx';
import {
  authErrorMessage, createAccount, sendPasswordReset, signInWithEmail, signInWithGoogle,
} from './auth.js';
import { BackIcon, GoogleIcon } from './icons.jsx';

// Signing in: Google in one tap, or an email address and a password.
// Steps: 'start' (the two ways in), 'signIn', 'create' (a new account) and 'reset' (forgot the password).
// `invited` when the page was opened from an invite link, which still works after signing in.
export default function SignIn({ invited }) {
  const [step, setStep] = useState('start');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function go(next) {
    setStep(next);
    setError('');
    setNotice('');
    setPassword('');
  }

  async function run(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (err) {
      setError(authErrorMessage(err) ?? '');
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (step === 'signIn') run(() => signInWithEmail(email, password));
    else if (step === 'create') run(() => createAccount(name, email, password));
    else {
      run(async () => {
        await sendPasswordReset(email);
        setNotice(`If there's an account for ${email.trim()}, we sent it a link to choose a new password.`);
      });
    }
  }

  const title = { start: 'Welcome to FASTapp', signIn: 'Sign in with email', create: 'Create an account', reset: 'Reset your password' }[step];
  const lead = {
    start: invited
      ? 'Sign in to accept your invite. Use the email address the invite was sent to.'
      : "Record family stories for your loved one's FAST therapy, together with their care team.",
    signIn: 'Use the email address and password you signed up with.',
    create: "Your name is how the care team will see you. We'll send you an email to confirm your address.",
    reset: "Enter your email address, and we'll send you a link to choose a new password.",
  }[step];

  return (
    <div className="screen solo">
      <aside className="welcome-panel">
        <span className="wordmark">
          FAST<span>app</span>
        </span>
        <p className="welcome-headline">Familiar voices, telling the stories that matter.</p>
        <p className="welcome-text">Familiar Auditory Sensory Training</p>
      </aside>
      <div className="page">
        <NavBar
          left={step === 'start' ? (
            <span className="wordmark desktop-hidden">
              FAST<span>app</span>
            </span>
          ) : (
            <button className="nav-button" onClick={() => go(step === 'reset' ? 'signIn' : 'start')} disabled={busy}>
              <BackIcon />
              Back
            </button>
          )}
        />
        <main className="content">
          <h1 className="page-title">{title}</h1>
          <p className="lead">{lead}</p>

          {step === 'start' ? (
            <div className="sign-in-options">
              <button className="pill pill-white" onClick={() => run(signInWithGoogle)} disabled={busy}>
                <GoogleIcon />
                Continue with Google
              </button>
              <p className="divider">or</p>
              <button className="pill pill-white" onClick={() => go('signIn')} disabled={busy}>
                Continue with email
              </button>
              {error && <p className="error" role="alert">{error}</p>}
              {!invited && <p className="footnote">Invited to a care team? Open the invite link you were sent first.</p>}
            </div>
          ) : (
            <form className="sign-in-form" onSubmit={submit}>
              {step === 'create' && (
                <label className="field">
                  <span className="field-label">Your name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} required />
                </label>
              )}
              <label className="field">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  required
                />
              </label>
              {step !== 'reset' && (
                <label className="field">
                  <span className="field-label">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={step === 'create' ? 'new-password' : 'current-password'}
                    minLength={step === 'create' ? 6 : undefined}
                    required
                  />
                  {step === 'create' && <span className="hint">At least 6 characters.</span>}
                </label>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              {notice && <p className="notice" role="status">{notice}</p>}
              <button className="pill pill-primary" type="submit" disabled={busy}>
                {{ signIn: 'Sign in', create: 'Create account', reset: 'Send the link' }[step]}
              </button>
              {step === 'signIn' && (
                <>
                  <button type="button" className="pill pill-quiet" onClick={() => go('reset')} disabled={busy}>
                    Forgot your password?
                  </button>
                  <p className="footnote">
                    New to FASTapp?{' '}
                    <button type="button" className="link-button" onClick={() => go('create')} disabled={busy}>
                      Create an account
                    </button>
                  </p>
                </>
              )}
              {step === 'create' && (
                <p className="footnote">
                  Already have an account?{' '}
                  <button type="button" className="link-button" onClick={() => go('signIn')} disabled={busy}>
                    Sign in
                  </button>
                </p>
              )}
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
