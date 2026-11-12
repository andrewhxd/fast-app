import { useState } from 'react';
import { AWAKE_BEHAVIORS, BEFORE_ITEMS } from './checklists.js';

// The two screens before playing a set: the checklist, then the signs of being awake.
// Calls onDone({ done, awake }) with the ids that were ticked; App saves the session and plays the set.
// If that fails, the error shows here so they can try again.
export default function BeforeChecklist({ onDone, onCancel }) {
  const [screen, setScreen] = useState(1);
  const [done, setDone] = useState([]);
  const [awake, setAwake] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function play() {
    setSaving(true);
    setError('');
    try {
      await onDone({ done, awake });
    } catch (err) {
      setError(`Could not start playing: ${err.message}`);
      setSaving(false);
    }
  }

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  if (screen === 1) {
    return (
      <main className="content">
        <h1 className="page-title">Before you play</h1>
        <p className="lead">Tick each one when it&apos;s done.</p>
        <div className="checklist">
          {BEFORE_ITEMS.map((item) => (
            <label key={item.id} className="check-row">
              <input type="checkbox" checked={done.includes(item.id)} onChange={() => toggle(done, setDone, item.id)} />
              {item.label}
            </label>
          ))}
        </div>
        <div className="actions">
          <button className="pill pill-primary" disabled={done.length < BEFORE_ITEMS.length} onClick={() => setScreen(2)}>
            Next
          </button>
          <button className="pill pill-white" onClick={onCancel}>Cancel</button>
        </div>
      </main>
    );
  }

  return (
    <main className="content">
      <h1 className="page-title">Is your loved one awake?</h1>
      <p className="lead">Tick everything they are doing right now.</p>
      <div className="checklist">
        {AWAKE_BEHAVIORS.map((item) => (
          <label key={item.id} className="check-row">
            <input type="checkbox" checked={awake.includes(item.id)} onChange={() => toggle(awake, setAwake, item.id)} />
            {item.label}
          </label>
        ))}
      </div>
      {awake.length === 0 && (
        <p className="notice caution">They may not be awake. Try again in an hour, or try to wake them. You can still play now.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="pill pill-primary" onClick={play} disabled={saving}>{saving ? 'Starting...' : 'Play'}</button>
        <button className="pill pill-white" onClick={() => setScreen(1)} disabled={saving}>Back</button>
      </div>
    </main>
  );
}
