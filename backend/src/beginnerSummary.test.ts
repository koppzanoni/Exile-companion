import { describe, expect, it } from 'vitest';
import { buildBeginnerSummary } from './beginnerSummary.js';
import type { ItemComparison, ItemEvaluation, MainDecision } from './types.js';

const evaluation: ItemEvaluation = { score: 60, grade: 'good', label: 'test', verdict: 'This item is a solid, usable upgrade.', marketability: 'broad', strengths: [], weaknesses: [], buildFits: [], upgradePriorities: [] };
const decision: MainDecision = { action: 'Use', reason: 'Use it: strong build fit and no verified better alternative.', conditionsToChange: [] };

function comparison(overrides: Partial<ItemComparison> = {}): ItemComparison {
  return { enabled: true, comparable: true, compatible: true, candidateCategory: { key: 'boots', label: 'Boots', priorities: [] }, equippedCategory: { key: 'boots', label: 'Boots', priorities: [] }, verdict: 'Small Upgrade', explanation: 'Small Upgrade for the Boots slot.', confidence: 'High', scoreDelta: 12, gains: [], improvements: [], losses: [], warnings: [], riskFlags: [], statDeltas: {}, betterFor: [], worseFor: [], recommendationImpact: 'Use it.', ...overrides };
}

describe('buildBeginnerSummary', () => {
  it('states a plain-language gain and loss when both are known, matching the spec example pattern', () => {
    const summary = buildBeginnerSummary({ comparison: comparison({ gains: ['+22% Cold Resistance'], losses: ['-25 Dexterity'] }), decision, evaluation });
    expect(summary).toMatch(/improves 22% Cold Resistance/i);
    expect(summary).toMatch(/lowers 25 Dexterity/i);
  });

  it('falls back to the comparison explanation when the item is not comparable, without inventing gains', () => {
    const summary = buildBeginnerSummary({ comparison: comparison({ comparable: false, explanation: 'Cannot compare Boots against Shield.' }), decision, evaluation });
    expect(summary).toBe('Cannot compare Boots against Shield.');
  });

  it('falls back to the main decision reason when there is no equipped-item comparison', () => {
    const summary = buildBeginnerSummary({ comparison: undefined, decision, evaluation });
    expect(summary).toBe(decision.reason);
  });

  it('falls back to the evaluation verdict when neither comparison nor decision is available', () => {
    const summary = buildBeginnerSummary({ evaluation });
    expect(summary).toBe(evaluation.verdict);
  });
});
