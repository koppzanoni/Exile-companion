import { RESISTANCE_STEP } from './statTargets.js';

export interface ResistanceCapResult {
  score: number;
  wasted: boolean;
  effectiveAfterCap: number;
  reason: string;
}

export function scoreResistanceAgainstCap(value: number, cap: number, current: number): ResistanceCapResult {
  const needed = Math.max(0, cap - current);
  const useful = Math.min(value, needed);
  const score = needed === 0 ? 5 : Math.round((100 * useful) / Math.max(1, Math.min(needed, RESISTANCE_STEP)));
  const wasted = value > useful;
  return {
    score: Math.min(100, score),
    wasted,
    effectiveAfterCap: useful,
    reason: wasted
      ? `${useful}% helps reach the cap; ${value - useful}% is currently over cap.`
      : `Closes ${useful}% of the resistance gap.`,
  };
}
