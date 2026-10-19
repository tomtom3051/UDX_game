import { STARTING_MONEY, type Grade } from './config';
import type { JobReport } from './grading';

const KEY = 'pocket-jobs-save-v1';

export interface Save {
  money: number;
  speedTier: number;
  widthTier: number;
  /** Best grade per map id. */
  best: Record<string, Grade>;
}

function fresh(): Save {
  return { money: STARTING_MONEY, speedTier: 0, widthTier: 0, best: {} };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Drop fields from older versions (the per-job cooldown and the mute flag).
      const { money, speedTier, widthTier, best } = { ...fresh(), ...JSON.parse(raw) };
      return { money, speedTier, widthTier, best };
    }
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
  Object.assign(save, fresh());
  persist();
}

/** Result of the job that just ended, shown on the results page. Not persisted. */
export let lastReport: JobReport | null = null;

export function setLastReport(report: JobReport | null): void {
  lastReport = report;
}
