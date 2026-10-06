import { GARDEN } from '../config';
import type { Plant } from './logic';

const KEY = 'pocket-jobs-garden-v1';

interface GardenSave {
  coins: number;
  /** One entry per owned plot, null is an empty plot. */
  plots: (Plant | null)[];
  /** Days skipped with the presenter "Next day" tool. */
  dayOffset: number;
  /** Day the garden was started, for the "Day N" label. */
  startDay: number;
}

/** Calendar day in local time, as a running number. */
function realDay(): number {
  const now = new Date();
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
}

function fresh(): GardenSave {
  return { coins: GARDEN.startingCoins, plots: Array(GARDEN.startPlots).fill(null), dayOffset: 0, startDay: realDay() };
}

function load(): GardenSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage: start a new garden.
  }
  return fresh();
}

export const garden: GardenSave = load();

export function today(): number {
  return realDay() + garden.dayOffset;
}

export function persistGarden(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(garden));
  } catch {
    // The demo still works without storage.
  }
}

export function resetGarden(): void {
  Object.assign(garden, fresh());
  persistGarden();
}
