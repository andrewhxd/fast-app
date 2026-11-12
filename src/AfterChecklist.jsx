import { useState } from 'react';
import { AFTER_BEHAVIORS, CHANGES } from './checklists.js';

const CHANGE_LABELS = { more: 'More', same: 'Same', less: 'Less' };

// The questions after a set has played.
// Calls onDone({ changes, agitated }), where changes is { behaviorId: 'more' | 'same' | 'less' };
// App saves them. If that fails, the error shows here so they can try again.
export default function AfterChecklist({ onDone }) {
  const [changes, setChanges] = useState({});
  const [agitated, setAgitated] = useState(null); // true, false, or null until answered
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      await onDone({ changes, agitated });
    } catch (err) {
      setError(`Could not save your answers: ${err.message}`);
      setSaving(false);
    }
  }

  const allAnswered = AFTER_BEHAVIORS.every((item) => changes[item.id]) && agitated !== null;

  return (
    <main className="content">
      <h1 className="page-title">After playing</h1>
      <p className="lead">Compared to before the stories, does your loved one do each of these more, the same or less?</p>

      {AFTER_BEHAVIORS.map((item) => (
        <fieldset key={item.id} className="field question">
          <legend className="field-label">{item.label}</legend>
          <div className="segmented plain">
            {CHANGES.map((change) => (
              <label key={change} className={changes[item.id] === change ? 'on' : ''}>
                <input
                  type="radio"
                  name={item.id}
                  checked={changes[item.id] === change}
                  onChange={() => setChanges({ ...changes, [item.id]: change })}
                />
                {CHANGE_LABELS[change]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className="field question">
        <legend className="field-label">Did your loved one become agitated?</legend>
        <div className="segmented plain">
          <label className={agitated === true ? 'on' : ''}>
            <input type="radio" name="agitated" checked={agitated === true} onChange={() => setAgitated(true)} />
            Yes
          </label>
          <label className={agitated === false ? 'on' : ''}>
            <input type="radio" name="agitated" checked={agitated === false} onChange={() => setAgitated(false)} />
            No
          </label>
        </div>
      </fieldset>

      {agitated === true && (
        <p className="notice caution">Consider stopping the sessions, and check again each week.</p>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="pill pill-primary" disabled={!allAnswered || saving} onClick={save}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </main>
  );
}
