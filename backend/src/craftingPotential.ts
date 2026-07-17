import { craftingRecommendation } from './craftingRecommendations.js';
import { analyzeCraftingRules } from './craftingRules.js';
import { assessCraftingRisk } from './craftingRisk.js';
import { buildCurrencyAdvice } from './currencyAdvice.js';
import type { CraftingPotential, CraftingSettings, DecisionConfidence, ItemEvaluation, ItemStats } from './types.js';

export interface CraftingContext extends Partial<CraftingSettings> {
  marketVerified?: boolean;
}

const defaults: CraftingSettings = {
  craftingRiskTolerance: 'Medium',
  showCurrencyWarnings: true,
  conservativeCraftingRecommendations: true,
};

export function assessCraftingPotential(
  item: ItemStats,
  evaluation: ItemEvaluation,
  context: CraftingContext = {},
): CraftingPotential {
  const settings = { ...defaults, ...context };
  const facts = analyzeCraftingRules(item, evaluation);
  const risk = assessCraftingRisk(item, evaluation, facts, settings);
  let score =
    facts.baseQuality.score * 0.32 +
    facts.rollQuality.score * 0.38 +
    facts.categoryScore * 0.2 +
    facts.buildFitScore * 0.1;
  if (item.rarity === 'rare') score += 5;
  else if (item.rarity === 'magic') score += 1;
  else if (item.rarity === 'normal') score -= 5;
  else if (item.rarity === 'unique') score -= 20;
  if (facts.missing.length === 1 && facts.wasted.length <= 1) score += 9;
  else if (facts.missing.length === 2 && facts.wasted.length <= 1) score += 4;
  score = Math.min(risk.scoreCap, Math.max(0, Math.round(score - risk.penalty)));
  const recommendation = craftingRecommendation(item, evaluation, facts, risk, score);
  const currency = buildCurrencyAdvice(item, facts, score, settings, Boolean(context.marketVerified));
  const reasons = unique([
    ...facts.baseQuality.reasons.slice(0, 3),
    `${facts.rollQuality.label} (${facts.rollQuality.score}/100) with ${facts.strongRolls.length} strong and ${facts.weakRolls.length} weak/wasted detected rolls.`,
    ...(facts.missing.length === 1
      ? [`One key improvement is missing: ${facts.missing[0]}.`]
      : facts.missing.length > 1
        ? [`${facts.missing.length} important improvements are missing.`]
        : ['No major category requirement is currently missing.']),
    ...(facts.categoryScore >= 65
      ? [`Strong category score (${facts.categoryScore}/100).`]
      : facts.categoryScore < 30
        ? [`Low category score (${facts.categoryScore}/100).`]
        : []),
    ...(facts.buildFitScore >= 65 ? [`The item already fits the selected build (${facts.buildFitScore}/100).`] : []),
  ]);
  return {
    score,
    label: recommendation.label,
    confidence: confidenceFor(item, evaluation),
    recommendation: recommendation.recommendation,
    reasons: reasons.slice(0, 7),
    risks: risk.risks,
    bestPossibleImprovements: recommendation.bestPossibleImprovements,
    avoidActions: unique([
      ...recommendation.avoidActions,
      ...(score < 35 ? ['Do not chase this item with additional expensive currency.'] : []),
    ]),
    suggestedCurrencyUse: currency.suggestedCurrencyUse,
    currencyWarnings: currency.currencyWarnings,
    baseQuality: facts.baseQuality,
    rollQuality: facts.rollQuality,
  };
}

function confidenceFor(item: ItemStats, evaluation: ItemEvaluation): DecisionConfidence {
  let score = ((evaluation.categoryAnalysis?.confidence || 55) + (evaluation.knowledge?.confidence.score || 55)) / 2;
  if (item.itemLevel) score += 6;
  if ((item.parsedLines || []).length) score += 5;
  if ((evaluation.knowledge?.rolls || []).length) score += 10;
  else score -= 6;
  if (!item.baseType) score -= 12;
  return score >= 82 ? 'High' : score >= 55 ? 'Medium' : 'Low';
}
const unique = <T>(values: T[]) => [...new Set(values)];
