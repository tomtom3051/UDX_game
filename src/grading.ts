import {
  BED_PENALTY,
  GRADE_MULTIPLIER,
  GRADE_THRESHOLDS,
  MAX_TIME_BONUS,
  PASS_COVERAGE,
  PASSING_GRADES,
  type Grade,
  type MapDef,
} from './config';

export type EndReason = 'time' | 'finished' | 'pool' | 'quit';

export interface JobOutcome {
  mapId: string;
  coverage: number; // percent, 0 to 100
  bedsDestroyed: number;
  timeLeft: number; // seconds
  reason: EndReason;
  /** Played without the job timer (relaxed mode). There is no time bonus. */
  relaxed?: boolean;
}

export interface JobReport extends JobOutcome {
  score: number;
  grade: Grade;
  payout: number;
  passed: boolean;
}

export function gradeFromScore(score: number): Grade {
  for (const [grade, min] of GRADE_THRESHOLDS) {
    if (score >= min) return grade;
  }
  return 'F';
}

export function isPass(grade: Grade | undefined): boolean {
  return grade !== undefined && PASSING_GRADES.includes(grade);
}

const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A'];

export function betterGrade(a: Grade | undefined, b: Grade): Grade {
  if (!a) return b;
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

export function gradeJob(outcome: JobOutcome, map: MapDef): JobReport {
  const failed = outcome.reason === 'pool' || outcome.reason === 'quit' || outcome.coverage < PASS_COVERAGE;
  if (failed) {
    return { ...outcome, score: 0, grade: 'F', payout: 0, passed: false };
  }
  const timeBonus = MAX_TIME_BONUS * Math.max(0, Math.min(1, outcome.timeLeft / map.timeLimit));
  const score = outcome.coverage - BED_PENALTY * outcome.bedsDestroyed + timeBonus;
  const grade = gradeFromScore(score);
  return {
    ...outcome,
    score,
    grade,
    payout: Math.round(map.basePayout * GRADE_MULTIPLIER[grade]),
    passed: isPass(grade),
  };
}
