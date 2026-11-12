// Dev only: the checklists before and after playing, on their own page (checklists.html), with no
// sign-in, Firebase or stories. Shows what each screen would hand over to be saved.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import AfterChecklist from './AfterChecklist.jsx';
import BeforeChecklist from './BeforeChecklist.jsx';
import NavBar from './NavBar.jsx';
import './styles.css';

function ChecklistsPreview() {
  const [step, setStep] = useState('before'); // 'before', 'after' or 'done'
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [run, setRun] = useState(0); // bumped to start over with empty checklists

  function startOver() {
    setBefore(null);
    setAfter(null);
    setStep('before');
    setRun(run + 1);
  }

  return (
    <div className="screen solo">
      <div className="page focused">
        <NavBar
          left={<span className="wordmark">FAST<span>app</span></span>}
          right={<button className="nav-button" onClick={startOver}>Start over</button>}
        />
        {step === 'before' && (
          <BeforeChecklist
            key={run}
            onDone={(answers) => { setBefore(answers); setStep('after'); }}
            onCancel={startOver}
          />
        )}
        {step === 'after' && (
          <AfterChecklist key={run} onDone={(answers) => { setAfter(answers); setStep('done'); }} />
        )}
        {step === 'done' && (
          <main className="content">
            <h1 className="page-title">Done</h1>
            <p className="lead">This is what the two checklists hand over to be saved with the session.</p>
            <pre className="card" style={{ margin: 0, overflowX: 'auto', fontSize: '0.875rem' }}>
              {JSON.stringify({ before, after }, null, 2)}
            </pre>
            <div className="actions">
              <button className="pill pill-primary" onClick={startOver}>Start over</button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChecklistsPreview />
  </React.StrictMode>
);
