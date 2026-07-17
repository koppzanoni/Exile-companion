import type { MarketAnalysisResult } from './marketPipeline.js';
import type {
  CraftingPotential,
  DataSource,
  DecisionConfidence,
  Estimate,
  EvaluationFactor,
  FourEvaluations,
  ItemComparison,
  ItemEvaluation,
  ItemRecommendation,
  MainDecision,
  MainDecisionAction,
} from './types.js';

export interface FourEvaluationsInput {
  evaluation: ItemEvaluation;
  comparison?: ItemComparison;
  craftingPotential: CraftingPotential;
  estimate: Estimate | null;
  marketAnalysis: MarketAnalysisResult;
  dataSource: DataSource;
  recommendation: ItemRecommendation;
}

const actionMap: Record<ItemRecommendation['action'], MainDecisionAction> = {
  Use: 'Use',
  Sell: 'Sell',
  Craft: 'Craft',
  Vendor: 'Discard',
  'Replace Soon': 'Keep',
  'Price Check': 'Keep',
  'Keep for Later': 'Keep',
};

export function buildFourEvaluations(input: FourEvaluationsInput): {
  evaluations: FourEvaluations;
  decision: MainDecision;
} {
  const buildFit = buildFitEvaluation(input.evaluation);
  const upgradeValue = upgradeValueEvaluation(input.comparison);
  const marketValue = marketValueEvaluation(input.estimate, input.marketAnalysis, input.dataSource);
  const craftPotential = craftPotentialEvaluation(input.craftingPotential);
  const evaluations: FourEvaluations = { buildFit, upgradeValue, marketValue, craftPotential };
  const decision = mainDecision(input.recommendation, evaluations);
  return { evaluations, decision };
}

function scoreConfidence(score: number): DecisionConfidence {
  return score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low';
}

function buildFitEvaluation(evaluation: ItemEvaluation): EvaluationFactor {
  const fit = evaluation.buildFitAnalysis;
  if (!fit) {
    return {
      score: 0,
      confidence: 'Low',
      summary: 'No build was selected, so build fit could not be judged.',
      positiveFactors: [],
      negativeFactors: [],
      dataUsed: [],
      limitations: ['Select a build to get a build-fit score.'],
    };
  }
  return {
    score: fit.score,
    confidence: scoreConfidence(fit.confidence),
    summary: `${fit.label} fit for ${fit.profileName}${fit.buildSpecific ? '' : ' (generic profile)'}.`,
    positiveFactors: fit.fitsBecause,
    negativeFactors: [...fit.doesNotFitBecause, ...fit.wastedStats.map((s) => `Wasted for this build: ${s}`)],
    dataUsed: ['selected build profile', 'category analysis', 'stat-by-stat valuation'],
    limitations: fit.warnings,
  };
}

function upgradeValueEvaluation(comparison?: ItemComparison): EvaluationFactor {
  if (!comparison) {
    return {
      score: 0,
      confidence: 'Low',
      summary: 'No equipped item was pasted, so upgrade value could not be measured.',
      positiveFactors: [],
      negativeFactors: [],
      dataUsed: [],
      limitations: ['Paste the currently equipped item to measure upgrade value.'],
    };
  }
  if (!comparison.comparable) {
    return {
      score: 0,
      confidence: 'Low',
      summary: comparison.explanation,
      positiveFactors: [],
      negativeFactors: [],
      dataUsed: ['candidate item', 'equipped item'],
      limitations: ['The pasted items are not in compatible slots.'],
    };
  }
  const score = Math.max(0, Math.min(100, Math.round(50 + comparison.scoreDelta * 2)));
  return {
    score,
    confidence: comparison.confidence,
    summary: `${comparison.verdict}: ${comparison.explanation}`,
    positiveFactors: comparison.gains,
    negativeFactors: [...comparison.losses, ...comparison.riskFlags],
    dataUsed: ['equipped item comparison', 'character totals', 'stat-by-stat valuation'],
    limitations: comparison.warnings,
  };
}

function marketValueEvaluation(
  estimate: Estimate | null,
  marketAnalysis: MarketAnalysisResult,
  dataSource: DataSource,
): EvaluationFactor {
  if (!estimate) {
    return {
      score: 0,
      confidence: 'Low',
      summary: marketAnalysis.warning || 'No market price could be estimated.',
      positiveFactors: [],
      negativeFactors: [],
      dataUsed: [`strategy: ${marketAnalysis.strategyUsed}`, `${marketAnalysis.foundCount} listings found`],
      limitations: ['No comparable listings passed the similarity threshold.'],
    };
  }
  const confidence: DecisionConfidence =
    estimate.confidence === 'high' ? 'High' : estimate.confidence === 'medium' ? 'Medium' : 'Low';
  const score = marketAnalysis.valuation.confidenceScore;
  const limitations = [
    ...(dataSource === 'manual' ? ['Estimate is based on manually pasted listings, not a live search.'] : []),
    ...(dataSource === 'cache' ? ['Live Trade2 was unavailable; showing a previously cached snapshot.'] : []),
    ...(dataSource === 'relaxed-live'
      ? [`Search was relaxed through: ${marketAnalysis.relaxationSteps.join(' -> ')}.`]
      : []),
    ...(dataSource === 'insufficient-live' ? ['Too few comparables were found even after relaxing the search.'] : []),
    ...(marketAnalysis.lowConfidenceReason ? [marketAnalysis.lowConfidenceReason] : []),
  ];
  return {
    score,
    confidence,
    summary: `Fair price ~${estimate.fair} Exalted from ${marketAnalysis.usedCount} comparables (${marketAnalysis.strategyUsed}).`,
    positiveFactors: estimate.positiveMods,
    negativeFactors: estimate.negativeMods,
    dataUsed: [
      `${marketAnalysis.usedCount} comparables used of ${marketAnalysis.foundCount} found`,
      `average similarity ${marketAnalysis.averageSimilarity}%`,
      `${marketAnalysis.distinctSellers} distinct sellers`,
    ],
    limitations,
  };
}

function craftPotentialEvaluation(craftingPotential: CraftingPotential): EvaluationFactor {
  return {
    score: craftingPotential.score,
    confidence: craftingPotential.confidence,
    summary: `${craftingPotential.label}: ${craftingPotential.recommendation}`,
    positiveFactors: craftingPotential.reasons,
    negativeFactors: craftingPotential.risks,
    dataUsed: [
      `base quality ${craftingPotential.baseQuality.score}/100`,
      `roll quality ${craftingPotential.rollQuality.score}/100`,
    ],
    limitations: craftingPotential.currencyWarnings,
  };
}

function mainDecision(recommendation: ItemRecommendation, evaluations: FourEvaluations): MainDecision {
  const action = actionMap[recommendation.action];
  const conditions: string[] = [];
  if (action !== 'Use' && evaluations.buildFit.score < 68)
    conditions.push(`If build fit rises from ${evaluations.buildFit.score}/100 to 68+, this would likely become Use.`);
  if (action !== 'Sell' && evaluations.marketValue.confidence !== 'High')
    conditions.push('If a higher-confidence live market price is confirmed, this could become Sell.');
  if (action !== 'Craft' && evaluations.craftPotential.score >= 45 && evaluations.craftPotential.score < 64)
    conditions.push(
      `If crafting potential rises from ${evaluations.craftPotential.score}/100 to 64+, this could become Craft.`,
    );
  if (action === 'Keep' && evaluations.upgradeValue.score === 0)
    conditions.push('Pasting the currently equipped item would sharpen this into Use or Sell.');
  if (!conditions.length)
    conditions.push('No specific condition was identified that would change this decision with the current evidence.');
  return { action, reason: recommendation.shortReason, conditionsToChange: conditions.slice(0, 4) };
}
