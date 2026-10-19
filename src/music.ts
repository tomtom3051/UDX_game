// Background music: one looping track for the whole app, independent of page changes.
// Browsers only allow audio after a user gesture, so playback starts on the first tap or key press.
import { MUSIC } from './config';
import { settings } from './settings';

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let ducked = false;
let fade = 0;

function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    // Ogg for Chrome and Firefox, AAC for Safari.
    const src = MUSIC.src.find((s) => audio!.canPlayType(s.endsWith('.ogg') ? 'audio/ogg; codecs="vorbis"' : 'audio/mp4') !== '');
    audio.src = `${import.meta.env.BASE_URL}${src ?? MUSIC.src[0]}`;
    audio.loop = true;
    audio.volume = 0;
  }
  return audio;
}

function target(): number {
  return ducked ? MUSIC.duckedVolume : MUSIC.volume;
}

function fadeTo(volume: number, done?: () => void): void {
  const el = element();
  cancelAnimationFrame(fade);
  const step = () => {
    const diff = volume - el.volume;
    if (Math.abs(diff) < 0.01) {
      el.volume = volume;
      done?.();
      return;
    }
    el.volume = Math.min(1, Math.max(0, el.volume + Math.sign(diff) * 0.01));
    fade = requestAnimationFrame(step);
  };
  step();
}

/** Starts or stops the music to match the setting. */
export function syncMusic(): void {
  if (!unlocked) return;
  const el = element();
  if (settings.music) {
    el.play()
      .then(() => fadeTo(target()))
      .catch(() => {
        // Missing file or blocked playback: stay silent.
      });
  } else if (!el.paused) {
    fadeTo(0, () => el.pause());
  }
}

/** Lowers the music while a loud sound (the mower engine) plays. */
export function duckMusic(on: boolean): void {
  ducked = on;
  if (audio && !audio.paused) fadeTo(target());
}

/** Call once at startup. */
export function initMusic(): void {
  const unlock = () => {
    unlocked = true;
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    syncMusic();
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}
