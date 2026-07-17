import type { ItemComparison, ItemEvaluation, MainDecision } from './types.js';

function plain(statLine: string): string {
  return statLine.replace(/^[+-]\s*/, '').trim();
}

export function buildBeginnerSummary(params: {
  comparison?: ItemComparison;
  decision?: MainDecision;
  evaluation: ItemEvaluation;
}): string {
  const { comparison, decision, evaluation } = params;
  if (comparison?.enabled) {
    if (!comparison.comparable) return comparison.explanation;
    const gain = comparison.gains[0];
    const lossOrRisk = comparison.losses[0] || comparison.riskFlags[0];
    if (gain && lossOrRisk)
      return `This item improves ${plain(gain)}, but ${lossOrRisk.startsWith('-') ? `lowers ${plain(lossOrRisk)}` : lossOrRisk.charAt(0).toLowerCase() + lossOrRisk.slice(1)}.`;
    if (gain) return `This item improves ${plain(gain)} compared to what you have equipped, with no measured downside.`;
    if (lossOrRisk)
      return `Compared to your equipped item, this one ${lossOrRisk.startsWith('-') ? `lowers ${plain(lossOrRisk)}` : lossOrRisk.charAt(0).toLowerCase() + lossOrRisk.slice(1)}.`;
    return comparison.explanation;
  }
  if (decision) return decision.reason;
  return evaluation.verdict;
}
