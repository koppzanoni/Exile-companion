import { scoreForCategory } from './categoryScoring.js';
import { detectItemCategoryDetailed } from './categoryDetection.js';
import { getCategoryKnowledge } from './itemCategoryKnowledge.js';
import type { CategoryAnalysis, ItemEvaluation, ItemStats } from './types.js';

export function analyzeItemCategory(item: ItemStats, evaluation: ItemEvaluation): CategoryAnalysis {
  const detection = detectItemCategoryDetailed(item);
  const knowledge = getCategoryKnowledge(detection.category.key);
  const scored = scoreForCategory(item, knowledge, evaluation);
  const warnings: string[] = [];
  if (detection.confidence < 70)
    warnings.push('Category detection is uncertain; paste the complete in-game item text including Item Class.');
  if (!item.itemLevel) warnings.push('Item level is missing, so affix and Trade2 comparisons are less precise.');
  if (!(item.parsedLines || []).length)
    warnings.push('No parser-debug mappings are available because the item was entered manually.');
  if (
    ['bow', 'crossbow', 'one-handed-melee', 'two-handed-melee', 'quarterstaff'].includes(detection.category.key) &&
    item.physicalDamageMin === undefined &&
    item.fireDamageMin === undefined &&
    item.coldDamageMin === undefined &&
    item.lightningDamageMin === undefined
  )
    warnings.push('Displayed weapon damage was not parsed; offensive DPS scoring is incomplete.');
  if (detection.category.key === 'boots' && !item.movementSpeed)
    warnings.push('Movement speed is missing; this is a major Boots weakness.');
  if (detection.category.key === 'shield' && !item.blockChance)
    warnings.push('Base block chance was not parsed; Shield scoring is incomplete.');
  if (item.rarity === 'unique')
    warnings.push('Unique-item interactions can require build-specific interpretation beyond generic affix value.');
  const knowledgeConfidence = evaluation.knowledge?.confidence.score ?? 60;
  return {
    detectedCategory: detection.category,
    detectionReason: detection.reason,
    categoryScore: scored.score,
    positiveStats: scored.positiveStats.length
      ? scored.positiveStats
      : ['No category-defining positive stat was detected'],
    weakOrWastedStats: scored.weakOrWastedStats,
    missingImportantStats: scored.missingImportantStats,
    marketRelevantStats: scored.marketRelevantStats,
    buildRelevantStats: unique([...(evaluation.personalized?.matched || []), ...scored.buildRelevantStats]).slice(0, 7),
    tradeSearchPriorities: knowledge.tradePriorities,
    confidence: Math.round((detection.confidence + knowledgeConfidence) / 2),
    warnings: unique(warnings),
    parsedLines: item.parsedLines || [],
  };
}
const unique = <T>(values: T[]) => [...new Set(values)];
