import { describe, expect, it } from 'vitest';
import { scoreResistanceAgainstCap } from './resistanceCapScoring.js';

describe('scoreResistanceAgainstCap', () => {
  it('marks an over-cap roll as wasted and only credits the portion that closes the gap', () => {
    const result = scoreResistanceAgainstCap(40, 75, 60);
    expect(result.wasted).toBe(true);
    expect(result.effectiveAfterCap).toBe(15);
    expect(result.score).toBeGreaterThan(0);
  });

  it('scores an under-cap roll proportional to how much of the gap it closes', () => {
    const halfway = scoreResistanceAgainstCap(17.5, 75, 40);
    expect(halfway.wasted).toBe(false);
    expect(halfway.effectiveAfterCap).toBe(17.5);
    expect(halfway.score).toBe(50);
  });

  it('gives full credit once a roll closes the entire remaining gap', () => {
    const result = scoreResistanceAgainstCap(35, 75, 40);
    expect(result.wasted).toBe(false);
    expect(result.effectiveAfterCap).toBe(35);
    expect(result.score).toBe(100);
  });

  it('treats an already-capped character as having no more use for this resistance', () => {
    const result = scoreResistanceAgainstCap(20, 75, 75);
    expect(result.wasted).toBe(true);
    expect(result.effectiveAfterCap).toBe(0);
    expect(result.score).toBe(5);
  });

  it('treats an over-capped character (current already above cap) the same as fully capped', () => {
    const result = scoreResistanceAgainstCap(20, 75, 90);
    expect(result.wasted).toBe(true);
    expect(result.effectiveAfterCap).toBe(0);
    expect(result.score).toBe(5);
  });
});
