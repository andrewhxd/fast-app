import { useEffect, useRef } from 'react';

const BAR_WIDTH = 3; // px
const BAR_GAP = 2; // px
const BAR_INTERVAL = 50; // ms between bars, so the chart scrolls at a readable speed

let sharedContext;

// One AudioContext for the whole app. Call it during a tap:
// iPhone only lets audio start from a tap, and the waveform needs audio running.
export function wakeAudio() {
  sharedContext ??= new AudioContext();
  if (sharedContext.state === 'suspended') sharedContext.resume();
  return sharedContext;
}

// Draws a scrolling bar chart of the microphone volume, newest bar on the right.
export default function LiveWaveform({ stream }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const audioContext = wakeAudio();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // Match the canvas to its on-screen size so bars stay sharp on high-res screens.
    const canvas = canvasRef.current;
    const scale = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    const draw2d = canvas.getContext('2d');
    draw2d.scale(scale, scale);
    draw2d.fillStyle = getComputedStyle(canvas).color;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const maxBars = Math.ceil(width / (BAR_WIDTH + BAR_GAP));
    const samples = new Uint8Array(analyser.fftSize);
    const levels = [];
    let lastBarTime = 0;
    let frame;

    function draw(time) {
      if (time - lastBarTime >= BAR_INTERVAL) {
        lastBarTime = time;

        // Loudest point in the latest slice of audio: 0 is silence, 1 is the maximum.
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);

        levels.push(Math.sqrt(peak)); // square root makes quiet speech easier to see
        if (levels.length > maxBars) levels.shift();

        // Draw each level as a bar centered on the middle line (at least 2px, so silence still shows).
        draw2d.clearRect(0, 0, width, height);
        levels.forEach((level, i) => {
          const barHeight = Math.max(2, level * height);
          const x = width - (levels.length - i) * (BAR_WIDTH + BAR_GAP);
          draw2d.fillRect(x, (height - barHeight) / 2, BAR_WIDTH, barHeight);
        });
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);

    // Stop drawing and listening when recording ends.
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      audioContext.suspend();
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="waveform" aria-label="Microphone volume" />;
}
