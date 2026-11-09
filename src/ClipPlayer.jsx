import { useEffect, useRef, useState } from 'react';
import { PauseIcon, PlayIcon } from './icons.jsx';
import { formatTime } from './stories.js';

// Only one player plays at a time: starting one pauses the one that was playing.
let current = null; // { pause } of the player that is playing

const NO_CLIPS = [];

// Plays several clips back to back as if they were one recording (e.g. the name clip, then the story,
// or a whole set of stories). `clips` is a list of { blob, duration, label? }; pass the same array on
// every render (e.g. from useMemo), or playback restarts; null while the audio is still loading.
// The durations come from the recorder, because some browsers write recordings without a length
// the player can read. A clip's `label` (e.g. the story's title) shows while it plays.
//
// Two looks:
// - full (default): a play button and a progress bar, on a card colored by `tint` (e.g. "tint-happy").
//   `idleLabel` shows above the bar before playback starts.
// - compact: a small play button beside `title` and a line of `details` with the time,
//   for a row in a list. `total` is the length to show while the audio loads.
//
// `onPlay()` is called each time playback starts from a tap, and `onEnd()` when the last clip
// finishes. With `showLeft`, the full player shows the time left instead of the total.
export default function ClipPlayer({
  clips, tint = '', idleLabel, compact = false, title, details, total: knownTotal, trailing, onPlay, onEnd, showLeft = false,
}) {
  const audioRef = useRef(null);
  const [index, setIndex] = useState(0); // the clip in the player
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0); // ms from the start of the first clip
  const owner = useRef({ pause: () => {} }); // this player, as other players see it
  const pendingSeek = useRef(null); // seconds within a clip whose metadata is still loading
  const list = clips ?? NO_CLIPS;

  function pause() {
    audioRef.current?.pause();
    setPlaying(false);
  }
  owner.current.pause = pause;

  // One playable URL per clip, freed when the clips change or the player closes.
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    const clipUrls = list.map((clip) => URL.createObjectURL(clip.blob));
    setUrls(clipUrls);
    return () => clipUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [list]);

  useEffect(() => () => {
    if (current === owner.current) current = null;
  }, []);

  const total = clips ? list.reduce((sum, clip) => sum + clip.duration, 0) : (knownTotal ?? 0);
  const offset = list.slice(0, index).reduce((sum, clip) => sum + clip.duration, 0); // start of the current clip

  // Keep playing when the player moves on to the next clip.
  useEffect(() => {
    if (playing && audioRef.current.paused) audioRef.current.play();
  }, [index]);

  function togglePlay() {
    const audio = audioRef.current;
    if (playing) {
      pause();
      return;
    }
    if (current && current !== owner.current) current.pause();
    current = owner.current;
    // Finished last time, so start over from the first clip.
    if (position >= total) {
      setPosition(0);
      if (index !== 0) {
        setPlaying(true);
        setIndex(0); // the effect above starts it once the first clip is loaded
        return;
      }
      audio.currentTime = 0;
    }
    audio.play();
    setPlaying(true);
    onPlay?.();
  }

  function handleTimeUpdate() {
    if (pendingSeek.current !== null || !list[index]) return;
    const clipTime = Math.min(audioRef.current.currentTime * 1000, list[index].duration);
    setPosition(offset + clipTime);
  }

  function handleEnded() {
    if (index < list.length - 1) {
      setIndex(index + 1);
    } else {
      setPlaying(false);
      setPosition(total);
      onEnd?.();
    }
  }

  function seek(value) {
    if (!clips || !total) return;
    const target = Math.max(0, Math.min(Number(value), total));
    let nextIndex = 0;
    let start = 0;
    while (nextIndex < list.length - 1 && target >= start + list[nextIndex].duration) {
      start += list[nextIndex].duration;
      nextIndex += 1;
    }
    const seconds = (target - start) / 1000;
    setPosition(target);
    if (nextIndex === index && audioRef.current.readyState >= 1) {
      pendingSeek.current = null;
      audioRef.current.currentTime = seconds;
    } else {
      pendingSeek.current = seconds;
      if (nextIndex !== index) setIndex(nextIndex);
    }
  }

  function handleMetadata() {
    if (pendingSeek.current === null) return;
    audioRef.current.currentTime = pendingSeek.current;
    pendingSeek.current = null;
  }

  const started = playing || (position > 0 && position < total);
  const audio = clips && (
    <audio ref={audioRef} src={urls[index]} preload="auto" onLoadedMetadata={handleMetadata} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} />
  );
  const progress = (
    <div className="seek-control">
      <input type="range" min="0" max="1000" step="1" value={total ? Math.round(Math.min(position, total) / total * 1000) : 0}
        disabled={!clips || !urls.length || !total} onChange={(event) => seek(Number(event.target.value) / 1000 * total)}
        aria-label={`Playback position${title ? ` for ${title}` : ''}`}
        aria-valuetext={`${formatTime(position)} of ${formatTime(total)}`}
        style={{ '--seek-progress': `${total ? position / total * 100 : 0}%` }} />
      {!compact && (
        <div className="seek-times">
          <span>{formatTime(position)}</span>
          <span>{showLeft ? `${formatTime(total - Math.min(position, total))} left` : formatTime(total)}</span>
        </div>
      )}
    </div>
  );
  const button = (
    <button
      className={`play-button${compact ? ' small' : ''}`}
      onClick={togglePlay}
      disabled={!clips}
      aria-label={`${playing ? 'Pause' : 'Play'}${title ? ` ${title}` : ''}`}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );

  if (compact) {
    const time = `${formatTime(position)} of ${formatTime(total)}`;
    return (
      <div className="mini-player">
        {audio}
        {button}
        <span className="mini-text">
          <strong>{title}</strong>
          <span>
            {details && `${details} · `}
            {clips ? time : `${time} · Loading...`}
          </span>
        </span>
        {trailing}
        {progress}
      </div>
    );
  }

  const label = (!started && idleLabel) || list[index]?.label;
  return (
    <div className={`player ${tint}`}>
      {audio}
      {button}
      <div className="player-track">
        {label && <span className="player-label">{label}</span>}
        {progress}
      </div>
    </div>
  );
}
