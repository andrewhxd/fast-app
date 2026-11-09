import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from './icons.jsx';

// The guide opens by itself the first time someone records on this device, and after that from the
// info button on the record screen. Storage can be unavailable (private browsing): then it opens each time.
const SEEN_KEY = 'fastapp.recordingGuideSeen';
export function seenRecordingGuide() {
  try {
    return localStorage.getItem(SEEN_KEY) === 'yes';
  } catch {
    return false;
  }
}
function rememberSeen() {
  try {
    localStorage.setItem(SEEN_KEY, 'yes');
  } catch {
    // Showing it again next time is fine.
  }
}

// The step to open at for each recording step, so the guide picks up where the person is.
export const GUIDE_STEP = { name: 0, story: 3, tooLong: 4, overSet: 4, review: 4 };

// How to record a story, as cards with Previous and Next, in a dialog over the record screen.
// Close, Escape or a tap outside it closes it.
export default function RecordingGuide({ affect, set, startStep = 0, onClose }) {
  const dialog = useRef(null);
  const [step, setStep] = useState(startStep);

  useEffect(() => {
    dialog.current.showModal();
    rememberSeen();
  }, []);

  const close = () => dialog.current.close(); // fires the dialog's close event, which calls onClose

  const steps = [
    {
      title: 'Your story set',
      body: <><p>You have chosen this set for your story.</p><div className={`guide-set tint-${affect}`}><span>Selected set</span><strong>{set}</strong></div><p>To choose a different set, tap <strong>Cancel</strong>.</p></>,
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
  const last = step === steps.length - 1;

  return (
    // A click on the dialog itself, not its contents, is a click on the backdrop around it.
    <dialog
      ref={dialog}
      className="guide"
      aria-labelledby="guide-title"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && close()}
    >
      <div className="guide-inner">
        <header className="guide-header">
          <h1 id="guide-title">How to record a story</h1>
          <button className="icon-button" onClick={close} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="guide-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          <span>STEP {step + 1} OF {steps.length}</span>
          <div className="guide-dots" aria-hidden="true">{steps.map((item, index) => <span key={item.title} className={index === step ? 'active' : ''} />)}</div>
        </div>
        <section className="guide-step" aria-live="polite">
          <h2>{steps[step].title}</h2>
          {steps[step].body}
        </section>
        <div className="guide-actions">
          {step > 0 && <button className="pill pill-white" onClick={() => setStep(step - 1)}>Previous</button>}
          <button className="pill pill-primary" onClick={() => (last ? close() : setStep(step + 1))}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </dialog>
  );
}
