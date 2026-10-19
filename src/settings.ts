// App-wide settings: sound, music and colour theme. Stored apart from game progress,
// so resetting a game never touches them.
import { THEMES } from './config';

const KEY = 'pocket-jobs-settings-v1';
const LEGACY_LAWN_KEY = 'pocket-jobs-save-v1';

export interface Settings {
  music: boolean;
  effects: boolean;
  /** Preset id, or 'custom' to use customAccent. */
  theme: string;
  customAccent: string;
  /** Lawn Mower job timer. Off is relaxed mode: no clock, no time pressure. */
  lawnTimer: boolean;
  /** Presenter option: very short sessions and breaks for testing. */
  fastTimers: boolean;
}

function fresh(): Settings {
  return { music: true, effects: true, theme: 'meadow', customAccent: '#3fa34d', lawnTimer: true, fastTimers: false };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
    // The mute flag used to live in the lawn save.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_LAWN_KEY) ?? '{}');
    if (legacy.muted) return { ...fresh(), music: false, effects: false };
  } catch {
    // Corrupt or unavailable storage: defaults.
  }
  return fresh();
}

export const settings: Settings = load();

export function persistSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings still apply for this visit.
  }
}

// ---------------------------------------------------------------- theme

function channels(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixHex(a: string, b: string, k: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca.map((c, i) => Math.round(c + (cb[i] - c) * k).toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance (WCAG). */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function currentTheme(): { accent: string; background: string } {
  if (settings.theme === 'custom') {
    return { accent: settings.customAccent, background: mixHex(settings.customAccent, '#ffffff', 0.93) };
  }
  const preset = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];
  return { accent: preset.accent, background: preset.background };
}

/**
 * Sets the theme variables on :root. Everything else (dark and soft variants, ink, lines)
 * is derived from these in styles.css with color-mix().
 */
export function applyTheme(): void {
  const { accent, background } = currentTheme();
  const root = document.documentElement.style;
  root.setProperty('--accent', accent);
  root.setProperty('--bg', background);
  // White text on the accent unless the accent is too light for it to stay readable.
  root.setProperty('--on-accent', luminance(accent) > 0.45 ? '#1d241f' : '#ffffff');
}
