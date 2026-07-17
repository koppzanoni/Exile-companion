import { describe, expect, it } from 'vitest';
import { buildFourEvaluations } from './fourEvaluations.js';
import type { CraftingPotential, Estimate, ItemEvaluation, ItemRecommendation } from './types.js';
import type { MarketAnalysisResult } from './marketPipeline.js';

const evaluation: ItemEvaluation = {
  score: 70,
  grade: 'good',
  label: 'Good, build-usable item',
  verdict: 'ok',
  marketability: 'niche',
  strengths: [],
  weaknesses: [],
  buildFits: [],
  upgradePriorities: [],
  buildFitAnalysis: {
    profileId: 'x',
    profileName: 'Ice Shot Deadeye',
    buildSpecific: true,
    score: 72,
    label: 'Great',
    fitsBecause: ['fits'],
    doesNotFitBecause: [],
    bestUseCase: 'endgame',
    missingImportantStats: [],
    wastedStats: [],
    recommendedAction: 'Use',
    confidence: 80,
    warnings: [],
  },
};

const craftingPotential: CraftingPotential = {
  score: 55,
  label: 'Maybe Craft',
  confidence: 'Medium',
  recommendation: 'Consider crafting',
  reasons: ['decent base'],
  risks: ['currency risk'],
  bestPossibleImprovements: [],
  avoidActions: [],
  suggestedCurrencyUse: [],
  currencyWarnings: ['expensive'],
  baseQuality: { score: 60, label: 'Usable Base', reasons: [] },
  rollQuality: { score: 50, label: 'Average', strongRolls: [], weakRolls: [], missingRolls: [] },
};

const estimate: Estimate = {
  quickSell: 8,
  fair: 10,
  high: 12,
  divine: { quickSell: 0.1, fair: 0.15, high: 0.2 },
  confidence: 'medium',
  positiveMods: ['good life'],
  negativeMods: [],
  explanation: [],
  usedCount: 5,
  excludedCount: 1,
};

const marketAnalysis = {
  strategyUsed: 'Same base and important stats',
  relaxed: false,
  relaxationSteps: [],
  foundCount: 6,
  discardedCount: 1,
  usedCount: 5,
  averageSimilarity: 82,
  medianListingAgeDays: 1,
  distinctSellers: 4,
  discardReasons: {},
  comparablesUsed: [],
  comparablesRejected: [],
  valuation: { confidenceScore: 78, confidence: 'High' } as any,
  dataSource: 'live',
  officialUrl: '',
  warning: 'ok',
} as unknown as MarketAnalysisResult;

const recommendation: ItemRecommendation = {
  action: 'Use',
  confidence: 'High',
  shortReason: 'Great fit',
  detailedReason: [],
  doThisNext: [],
  warnings: [],
  hiddenValueFlags: [],
  craftingPotential,
  whatWouldMakeBetter: [],
  checkBeforeSelling: [],
  safeToVendor: false,
  manualPriceCheck: false,
  mayHaveHiddenValue: false,
  bestUseCase: 'endgame',
};

describe('buildFourEvaluations', () => {
  it('produces four independent evaluations with scores, confidence, and data used', () => {
    const { evaluations } = buildFourEvaluations({
      evaluation,
      craftingPotential,
      estimate,
      marketAnalysis,
      dataSource: 'live',
      recommendation,
    });
    expect(evaluations.buildFit.score).toBe(72);
    expect(evaluations.marketValue.score).toBe(78);
    expect(evaluations.craftPotential.score).toBe(55);
    expect(evaluations.upgradeValue.score).toBe(0);
    expect(evaluations.upgradeValue.limitations.length).toBeGreaterThan(0);
    for (const key of ['buildFit', 'upgradeValue', 'marketValue', 'craftPotential'] as const) {
      expect(evaluations[key].dataUsed).toBeInstanceOf(Array);
      expect(['High', 'Medium', 'Low']).toContain(evaluations[key].confidence);
    }
  });

  it('maps the seven-state recommendation onto the five-state main decision', () => {
    const { decision } = buildFourEvaluations({
      evaluation,
      craftingPotential,
      estimate,
      marketAnalysis,
      dataSource: 'live',
      recommendation,
    });
    expect(decision.action).toBe('Use');
    expect(decision.conditionsToChange.length).toBeGreaterThan(0);
  });

  it('maps Vendor to Discard and Replace Soon / Price Check / Keep for Later to Keep', () => {
    const vendor = buildFourEvaluations({
      evaluation,
      craftingPotential,
      estimate,
      marketAnalysis,
      dataSource: 'live',
      recommendation: { ...recommendation, action: 'Vendor' },
    });
    expect(vendor.decision.action).toBe('Discard');
    for (const action of ['Replace Soon', 'Price Check', 'Keep for Later'] as const) {
      const result = buildFourEvaluations({
        evaluation,
        craftingPotential,
        estimate,
        marketAnalysis,
        dataSource: 'live',
        recommendation: { ...recommendation, action },
      });
      expect(result.decision.action).toBe('Keep');
    }
  });

  it('never invents an upgrade score without an equipped-item comparison', () => {
    const { evaluations } = buildFourEvaluations({
      evaluation,
      comparison: undefined,
      craftingPotential,
      estimate,
      marketAnalysis,
      dataSource: 'live',
      recommendation,
    });
    expect(evaluations.upgradeValue.score).toBe(0);
    expect(evaluations.upgradeValue.summary).toMatch(/No equipped item/i);
  });
});
