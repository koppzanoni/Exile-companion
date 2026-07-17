import type { MarketAnalysisResult } from './marketPipeline.js';
import { valueItemStats, type StatValuationContext } from './statValuationEngine.js';
import type { CraftingPotential, Estimate, ItemComparison, ItemStats, Listing } from './types.js';

export interface AlternativeListing {
  listing: Listing;
  qualityScore: number;
  extraCost: number;
  reason: string;
}
export interface OpportunityAnalysis {
  betterAlternativeSamePrice?: AlternativeListing;
  betterAlternativeForMore?: AlternativeListing;
  amountNeededForRelevantJump?: { extraCost: number; qualityGain: number; listing: Listing } | null;
  buyVsCraft: { verdict: 'buy' | 'craft' | 'unknown'; reason: string };
  wastedExpensiveStats: string[];
  sellingWouldEnableBetterPurchase: { possible: boolean; reason: string };
  bestAlternativeSearchUrl?: string;
  gainVsEquipped: { scoreDelta: number; verdict: string } | null;
  limitations: string[];
}

export function analyzeOpportunity(input: {
  item: ItemStats;
  statContext: StatValuationContext;
  candidateOverallScore: number;
  estimate: Estimate | null;
  marketAnalysis: MarketAnalysisResult;
  comparison?: ItemComparison;
  craftingPotential: CraftingPotential;
  wastedStats: string[];
}): OpportunityAnalysis {
  const limitations: string[] = [
    'Comparable stat data is parsed from Trade2 listing summaries and may be less complete than the analyzed item, so quality scores for alternatives are approximate.',
  ];
  const candidates = input.marketAnalysis.comparablesUsed
    .map((listing) => ({
      listing,
      qualityScore: valueItemStats(listing.stats as ItemStats, input.statContext).overallScore,
    }))
    .sort((a, b) => a.listing.exaltedPrice - b.listing.exaltedPrice);

  const fairPrice = input.estimate?.fair ?? 0;
  const RELEVANT_JUMP = 12;

  const samePrice = candidates.find(
    (c) => c.listing.exaltedPrice <= fairPrice * 1.05 && c.qualityScore > input.candidateOverallScore + RELEVANT_JUMP,
  );
  const forMore = candidates.find(
    (c) => c.listing.exaltedPrice > fairPrice * 1.05 && c.qualityScore > input.candidateOverallScore + RELEVANT_JUMP,
  );
  const jump = candidates.find(
    (c) => c.listing.exaltedPrice > fairPrice && c.qualityScore > input.candidateOverallScore + RELEVANT_JUMP,
  );

  const craftingKnown = input.craftingPotential.score > 0;
  const buyVsCraft: OpportunityAnalysis['buyVsCraft'] = !input.estimate
    ? { verdict: 'unknown', reason: 'No live market price is available to compare against crafting.' }
    : input.craftingPotential.score < 40
      ? {
          verdict: 'buy',
          reason: `Buying is safer: crafting potential is low (${input.craftingPotential.score}/100) and a market price of ~${fairPrice} Exalted already exists.`,
        }
      : craftingKnown && input.craftingPotential.score >= 70
        ? {
            verdict: 'unknown',
            reason: `Crafting potential is high (${input.craftingPotential.score}/100), but no quantified currency cost model exists yet (see the crafting tools) to compare against the ~${fairPrice} Exalted market price.`,
          }
        : {
            verdict: 'unknown',
            reason:
              'Crafting cost is not yet quantified precisely enough to compare against the market price without inventing numbers.',
          };

  const bestAlternative = samePrice || forMore;
  const sellingWouldEnableBetterPurchase =
    bestAlternative && input.estimate
      ? {
          possible: input.estimate.fair >= bestAlternative.listing.exaltedPrice * 0.85,
          reason:
            input.estimate.fair >= bestAlternative.listing.exaltedPrice * 0.85
              ? `Selling this item (~${input.estimate.fair} Exalted) would cover most or all of the ${bestAlternative.listing.exaltedPrice} Exalted alternative.`
              : `Selling this item (~${input.estimate.fair} Exalted) would not cover the ${bestAlternative.listing.exaltedPrice} Exalted alternative; extra currency would be needed.`,
        }
      : {
          possible: false,
          reason:
            'No priced alternative with a meaningfully better quality score was found among the current comparables.',
        };

  if (!input.marketAnalysis.usedCount)
    limitations.push('No market comparables were available, so alternative-item opportunities could not be searched.');

  return {
    betterAlternativeSamePrice: samePrice
      ? {
          listing: samePrice.listing,
          qualityScore: samePrice.qualityScore,
          extraCost: 0,
          reason: `Similar price (${samePrice.listing.exaltedPrice} Exalted) but a ${samePrice.qualityScore - input.candidateOverallScore} point higher stat-valuation score.`,
        }
      : undefined,
    betterAlternativeForMore: forMore
      ? {
          listing: forMore.listing,
          qualityScore: forMore.qualityScore,
          extraCost: Math.round((forMore.listing.exaltedPrice - fairPrice) * 10) / 10,
          reason: `Pay ${Math.round((forMore.listing.exaltedPrice - fairPrice) * 10) / 10} Exalted more for a ${forMore.qualityScore - input.candidateOverallScore} point higher stat-valuation score.`,
        }
      : undefined,
    amountNeededForRelevantJump: jump
      ? {
          extraCost: Math.round((jump.listing.exaltedPrice - fairPrice) * 10) / 10,
          qualityGain: jump.qualityScore - input.candidateOverallScore,
          listing: jump.listing,
        }
      : null,
    buyVsCraft,
    wastedExpensiveStats: input.wastedStats,
    sellingWouldEnableBetterPurchase,
    bestAlternativeSearchUrl: input.marketAnalysis.officialUrl || undefined,
    gainVsEquipped: input.comparison?.comparable
      ? { scoreDelta: input.comparison.scoreDelta, verdict: input.comparison.verdict }
      : null,
    limitations,
  };
}
