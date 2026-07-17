import { describe, expect, it } from 'vitest';
import { analyzeOpportunity } from './opportunityAnalysis.js';
import type { StatValuationContext } from './statValuationEngine.js';
import type { Estimate, ItemStats, Listing } from './types.js';
import type { MarketAnalysisResult } from './marketPipeline.js';

const item: ItemStats = {
  itemType: 'Boots',
  baseType: 'Stone Greaves',
  rarity: 'rare',
  life: 40,
  movementSpeed: 25,
  customMods: [],
};
const statContext: StatValuationContext = { slot: 'boots', critical: false, damageTags: [], current: {} };
const estimate: Estimate = {
  quickSell: 8,
  fair: 10,
  high: 12,
  divine: { quickSell: 0.1, fair: 0.15, high: 0.2 },
  confidence: 'medium',
  positiveMods: [],
  negativeMods: [],
  explanation: [],
  usedCount: 3,
  excludedCount: 0,
};

function listing(id: string, exaltedPrice: number, life: number): Listing {
  return {
    id,
    name: 'Stone Greaves',
    baseType: 'Stone Greaves',
    rarity: 'rare',
    price: exaltedPrice,
    currency: 'exalted',
    exaltedPrice,
    source: 'live',
    stats: { life, movementSpeed: 25 },
  };
}

function marketAnalysis(comparablesUsed: Listing[]): MarketAnalysisResult {
  return {
    strategyUsed: 'Same base and important stats',
    relaxed: false,
    relaxationSteps: [],
    foundCount: comparablesUsed.length,
    discardedCount: 0,
    usedCount: comparablesUsed.length,
    averageSimilarity: 80,
    medianListingAgeDays: 1,
    distinctSellers: comparablesUsed.length,
    discardReasons: {},
    comparablesUsed,
    comparablesRejected: [],
    valuation: {} as any,
    dataSource: 'live',
    officialUrl: 'https://www.pathofexile.com/trade2/search/poe2/Standard/xyz',
    warning: 'ok',
  };
}

describe('analyzeOpportunity', () => {
  it('finds a better alternative for about the same price', () => {
    const result = analyzeOpportunity({
      item,
      statContext,
      candidateOverallScore: 40,
      estimate,
      marketAnalysis: marketAnalysis([listing('a', 10.2, 130)]),
      craftingPotential: { score: 30 } as any,
      wastedStats: [],
    });
    expect(result.betterAlternativeSamePrice).toBeTruthy();
    expect(result.betterAlternativeSamePrice!.listing.id).toBe('a');
  });

  it('finds how much more is needed for a relevant jump when only pricier alternatives beat the item', () => {
    const result = analyzeOpportunity({
      item,
      statContext,
      candidateOverallScore: 40,
      estimate,
      marketAnalysis: marketAnalysis([listing('b', 25, 130)]),
      craftingPotential: { score: 30 } as any,
      wastedStats: [],
    });
    expect(result.betterAlternativeForMore).toBeTruthy();
    expect(result.amountNeededForRelevantJump).toBeTruthy();
    expect(result.amountNeededForRelevantJump!.extraCost).toBeGreaterThan(0);
  });

  it('never claims a buy-vs-craft verdict without a live estimate', () => {
    const result = analyzeOpportunity({
      item,
      statContext,
      candidateOverallScore: 40,
      estimate: null,
      marketAnalysis: marketAnalysis([]),
      craftingPotential: { score: 80 } as any,
      wastedStats: [],
    });
    expect(result.buyVsCraft.verdict).toBe('unknown');
    expect(result.buyVsCraft.reason).toMatch(/no live market price/i);
  });

  it('surfaces stats the StatValuationEngine already marked wasted for this build', () => {
    const result = analyzeOpportunity({
      item,
      statContext,
      candidateOverallScore: 40,
      estimate,
      marketAnalysis: marketAnalysis([]),
      craftingPotential: { score: 30 } as any,
      wastedStats: ['chaosResistance'],
    });
    expect(result.wastedExpensiveStats).toEqual(['chaosResistance']);
  });

  it('reuses the market search URL instead of inventing a new one', () => {
    const result = analyzeOpportunity({
      item,
      statContext,
      candidateOverallScore: 40,
      estimate,
      marketAnalysis: marketAnalysis([]),
      craftingPotential: { score: 30 } as any,
      wastedStats: [],
    });
    expect(result.bestAlternativeSearchUrl).toMatch(/pathofexile\.com\/trade2/);
  });
});
