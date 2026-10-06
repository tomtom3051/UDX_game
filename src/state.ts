import { COOLDOWN_MS, STARTING_MONEY, type Grade } from './config';
import type { JobReport } from './grading';

const KEY = 'pocket-jobs-save-v1';

export interface Save {
  money: number;
  speedTier: number;
  widthTier: number;
  /** Best grade per map id. */
  best: Record<string, Grade>;
  /** Timestamp (ms) when the cooldown ends. 0 means no cooldown. */
  cooldownEnd: number;
  muted: boolean;
}

function fresh(): Save {
  return { money: STARTING_MONEY, speedTier: 0, widthTier: 0, best: {}, cooldownEnd: 0, muted: false };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return fresh();
}

export const save: Save = load();

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // The demo still works without storage, it just will not survive a reload.
  }
}

export function resetProgress(): void {
  const muted = save.muted;
  Object.assign(save, fresh(), { muted });
  persist();
}

export function cooldownRemaining(): number {
  return Math.max(0, save.cooldownEnd - Date.now());
}

export function startCooldown(): void {
  save.cooldownEnd = Date.now() + COOLDOWN_MS;
  persist();
}

/** Result of the job that just ended, shown on the results page. Not persisted. */
export let lastReport: JobReport | null = null;

export function setLastReport(report: JobReport | null): void {
  lastReport = report;
}
