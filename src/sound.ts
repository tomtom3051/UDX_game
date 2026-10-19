// Small synthesised sound effects (WebAudio, no audio files). Music lives in music.ts.
import { duckMusic, syncMusic } from './music';
import { persistSettings, settings } from './settings';

let ctx: AudioContext | null = null;
let engine: { osc: OscillatorNode; gain: GainNode } | null = null;
let wheel: { osc: OscillatorNode; gain: GainNode } | null = null;

function audio(): AudioContext | null {
  if (!settings.effects) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.12, delay = 0, slideTo?: number): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, filterFrom: number, filterTo: number): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFrom, t);
  filter.frequency.exponentialRampToValueAtTime(filterTo, t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  click: () => tone(520, 0.06, 'triangle', 0.08),
  deny: () => tone(160, 0.14, 'square', 0.05),
  buy: () => {
    tone(880, 0.09, 'triangle', 0.1);
    tone(1320, 0.16, 'triangle', 0.1, 0.08);
  },
  beep: () => tone(440, 0.14, 'square', 0.06),
  go: () => tone(880, 0.3, 'square', 0.06),
  crunch: () => {
    noise(0.22, 0.25, 1800, 300);
    tone(140, 0.18, 'sawtooth', 0.08, 0, 70);
  },
  splash: () => {
    noise(0.7, 0.3, 3000, 200);
    tone(300, 0.5, 'sine', 0.1, 0, 60);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.28, 'triangle', 0.1, i * 0.16)),

  water: () => {
    noise(0.3, 0.12, 2600, 700);
    tone(620, 0.12, 'sine', 0.06, 0.02, 380);
  },
  dab: () => tone(340, 0.09, 'sine', 0.07, 0, 260),

  /** Soft hum of the pottery wheel. */
  wheel(on: boolean): void {
    if (!on) {
      if (wheel && ctx) {
        wheel.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        wheel.osc.stop(ctx.currentTime + 0.5);
      }
      wheel = null;
      return;
    }
    if (wheel) return;
    const ac = audio();
    if (!ac) return;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 82;
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.035, ac.currentTime, 0.4);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    wheel = { osc, gain };
  },

  /** Low mower hum while a job is running. */
  engine(on: boolean): void {
    duckMusic(on && settings.effects);
    if (!on) {
      if (engine && ctx) {
        engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        engine.osc.stop(ctx.currentTime + 0.3);
      }
      engine = null;
      return;
    }
    if (engine) return;
    const ac = audio();
    if (!ac) return;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 62;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.06, ac.currentTime, 0.2);
    osc.connect(filter).connect(gain).connect(ac.destination);
    osc.start();
    engine = { osc, gain };
  },
};

/** The quick mute buttons switch music and effects together. */
export function isMuted(): boolean {
  return !settings.music && !settings.effects;
}

export function setEffects(on: boolean): void {
  if (!on) {
    sfx.engine(false);
    sfx.wheel(false);
  }
  settings.effects = on;
  persistSettings();
}

export function setMusic(on: boolean): void {
  settings.music = on;
  persistSettings();
  syncMusic();
}

export function toggleMute(): boolean {
  const mute = !isMuted();
  setEffects(!mute);
  setMusic(!mute);
  return mute;
}

/** Renders a mute toggle button and keeps its icon in sync. */
export function muteButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  const sync = () => {
    btn.textContent = isMuted() ? '🔇' : '🔊';
    btn.setAttribute('aria-label', isMuted() ? 'Turn sound on' : 'Turn sound off');
  };
  sync();
  btn.addEventListener('click', () => {
    toggleMute();
    sync();
    sfx.click();
  });
  return btn;
}
