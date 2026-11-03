import { useState } from 'react';
import NavBar from './NavBar.jsx';
import { setName } from './stories.js';

export default function RecordingGuide({ affect, setNumber, backButton, onContinue }) {
  const [step, setStep] = useState(0);
  const set = setName(affect, setNumber);
  const steps = [
    {
      title: 'Your story set',
      body: <><p>You have chosen this set for your story.</p><div className={`guide-set tint-${affect}`}><span>Selected set</span><strong>{set}</strong></div><p>To choose a different set, go back.</p></>,
    },
    {
      title: 'Allow microphone access',
      body: <><p>The first time you tap <strong>Start recording</strong>, your phone or browser may ask to use your microphone. Tap <strong>Allow</strong>.</p><div className="guide-permissions"><figure><img src="/guide/ios-microphone-permission.PNG" alt="iPhone microphone permission request with an Allow button" /><figcaption>iPhone</figcaption></figure><figure><img src="/guide/android-microphone-permission.png" alt="Android microphone permission request with options to allow access" /><figcaption>Android</figcaption></figure></div><p>If access was blocked, allow the microphone in your browser or phone settings, then try again.</p></>,
    },
    {
      title: "Say the patient's name",
      body: <><p>Tap <strong>Start recording</strong> and say the patient&apos;s name 3 times, using the name they are used to hearing.</p><p>When you are finished, tap <strong>Done</strong>.</p></>,
    },
    {
      title: 'Tell your story',
      body: <><p>Tap <strong>Start recording</strong> again and tell your story. You can pause and resume.</p><div className="guide-callout"><strong>Up to 5:00</strong><span>This includes the name. If the set has less room, your story needs to fit within that time.</span></div><p>When you are finished, tap <strong>Finish story</strong>.</p></>,
    },
    {
      title: 'Listen and add your story',
      body: <><p>Listen to your recording, then add the title, storyteller, relationship and affect.</p><div className="guide-callout"><strong>Need to make a change?</strong><span>Edit your recording before saving. If it is too long or does not fit, edit it to fit or record the story again.</span></div><p>When you are ready, tap <strong>Add story</strong>.</p></>,
    },
  ];
  return (
    <>
      <NavBar left={backButton} title={set} />
      <main className="content guide">
        <div className="guide-heading"><h1 className="page-title">How to record a story</h1><p className="lead">A few steps before you begin.</p></div>
        <div className="guide-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          <span>STEP {step + 1} OF {steps.length}</span>
          <div className="guide-dots" aria-hidden="true">{steps.map((item, index) => <span key={item.title} className={index === step ? 'active' : ''} />)}</div>
        </div>
        <section className="card guide-step" aria-live="polite">
          <h2>{steps[step].title}</h2>
          {steps[step].body}
        </section>
        <div className="guide-actions">
          {step > 0 && <button className="pill pill-white" onClick={() => setStep(step - 1)}>Previous</button>}
          <button className="pill pill-primary" onClick={() => step === steps.length - 1 ? onContinue() : setStep(step + 1)}>{step === steps.length - 1 ? 'Continue to recording' : 'Next'}</button>
        </div>
        <button className="pill pill-quiet" onClick={onContinue}>Skip instructions</button>
      </main>
    </>
  );
}
