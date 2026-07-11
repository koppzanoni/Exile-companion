import { assessCraftingPotential } from './craftingPotential.js';
import { itemActionLabels } from './itemActionLabels.js';
import { chooseItemAction, type RecommendationContext } from './recommendationRules.js';
import { isLiveVerifiedSource, type DecisionConfidence, type ItemRecommendation } from './types.js';

export function decideItem(context: Omit<RecommendationContext, 'craftingPotential'>, providedCraftingPotential?:ReturnType<typeof assessCraftingPotential>): ItemRecommendation {
  const craftingPotential = providedCraftingPotential||assessCraftingPotential(context.item, context.evaluation);
  const selected = chooseItemAction({ ...context, craftingPotential });
  const fit = context.evaluation.buildFitAnalysis;
  const category = context.evaluation.categoryAnalysis;
  const liveVerified = isLiveVerifiedSource(context.dataSource) && Boolean(context.estimate);
  const manualPriceCheck = selected.action === 'Price Check' || selected.action === 'Sell' || selected.hiddenValueFlags.length > 0;
  const warnings = unique([
    ...(!liveVerified ? ['No live official Trade2 price was verified; do not treat the recommendation as a confirmed sale price.'] : []),
    ...(context.item.corrupted ? ['The item is corrupted, so normal crafting options are restricted.'] : []),
    ...(context.warning ? [context.warning] : []),
    ...((fit?.warnings || []).slice(0, 2)),
  ]);
  const confidence = decisionConfidence(context, selected.safeToVendor);
  const upgrades = unique([...(category?.missingImportantStats || []), ...(fit?.missingImportantStats || []), ...context.evaluation.upgradePriorities]).slice(0, 6);
  const checkBeforeSelling = unique([
    ...(selected.hiddenValueFlags.length ? ['Search the build-enabling or high-tier modifiers individually on Trade2.'] : []),
    'Confirm the item base, item level, corruption state, and roll ranges in the official search.',
    ...(!liveVerified ? ['Obtain live comparable listings before setting a sale price.'] : ['Compare the lowest relevant live listings, not only the cheapest broad-base results.']),
  ]);
  const doThisNext = unique([
    itemActionLabels[selected.action].next,
    ...(selected.action === 'Replace Soon' && upgrades.length ? [`Prioritise ${upgrades.slice(0, 2).join(' and ')} on the replacement.`] : []),
    ...(selected.action === 'Craft' && upgrades.length ? [`Target ${upgrades.slice(0, 2).join(' or ')} without risking the strong existing rolls.`] : []),
    ...(manualPriceCheck ? ['Review the generated official Trade2 search before selling or vendoring.'] : []),
  ]);
  return {
    action: selected.action,
    confidence,
    shortReason: selected.shortReason,
    detailedReason: context.statValuation && context.statValuation.contributions.length ? [...selected.reasons, `Stat-by-stat valuation scored ${context.statValuation.overallScore}/100 (offence ${context.statValuation.offenceScore}, defence ${context.statValuation.defenceScore}, utility ${context.statValuation.utilityScore}) and was blended into this decision.`] : selected.reasons,
    secondaryAction: selected.secondaryAction,
    doThisNext,
    warnings,
    hiddenValueFlags: selected.hiddenValueFlags,
    craftingPotential,
    whatWouldMakeBetter: upgrades,
    checkBeforeSelling,
    safeToVendor: selected.safeToVendor,
    manualPriceCheck,
    mayHaveHiddenValue: selected.hiddenValueFlags.length > 0,
    bestUseCase: fit?.bestUseCase || (context.evaluation.score >= 70 ? 'endgame' : context.evaluation.score >= 45 ? 'early maps' : 'campaign'),
  };
}

function decisionConfidence(context: Omit<RecommendationContext, 'craftingPotential'>, safeToVendor: boolean): DecisionConfidence {
  const categoryConfidence = context.evaluation.categoryAnalysis?.confidence ?? 55;
  const buildConfidence = context.evaluation.buildFitAnalysis?.confidence ?? 55;
  const knowledgeConfidence = context.evaluation.knowledge?.confidence.score ?? 55;
  let score = (categoryConfidence + buildConfidence + knowledgeConfidence) / 3;
  if (isLiveVerifiedSource(context.dataSource) && context.estimate) score += context.estimate.confidence === 'high' ? 12 : context.estimate.confidence === 'medium' ? 6 : 0;
  else score -= 8;
  if (safeToVendor) score += 5;
  if (context.item.rarity === 'unique') score -= 12;
  return score >= 78 ? 'High' : score >= 52 ? 'Medium' : 'Low';
}

const unique = <T>(values: T[]) => [...new Set(values)];
