import { describe, expect, it } from 'vitest';
import { recommendUse } from './buildRecommendations.js';
import type { ItemEvaluation } from './types.js';

const evaluation = (score: number, grade: ItemEvaluation['grade']): ItemEvaluation => ({
  score,
  grade,
  label: 'test',
  verdict: 'test',
  marketability: 'niche',
  strengths: [],
  weaknesses: [],
  buildFits: [],
  upgradePriorities: [],
});

describe('recommendUse', () => {
  it('labels a build-mismatched but genuinely strong item as niche, not leveling', () => {
    const result = recommendUse(36, evaluation(51, 'basic'), 0);
    expect(result.bestUseCase).toBe('niche');
  });

  it('still labels a build-mismatched and genuinely poor item as leveling', () => {
    const result = recommendUse(36, evaluation(20, 'poor'), 0);
    expect(result.bestUseCase).toBe('leveling');
  });

  it('labels a build-mismatched item with real conflicts as niche regardless of quality', () => {
    const result = recommendUse(36, evaluation(20, 'poor'), 2);
    expect(result.bestUseCase).toBe('niche');
  });
});
