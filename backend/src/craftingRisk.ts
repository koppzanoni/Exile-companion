import type { CraftingSettings, ItemEvaluation, ItemStats } from './types.js';
import type { CraftingFacts } from './craftingRules.js';

export interface CraftingRiskAssessment {
  risks: string[];
  penalty: number;
  scoreCap: number;
  riskLabel: 'Low' | 'Medium' | 'High' | 'Extreme';
}

export function assessCraftingRisk(
  item: ItemStats,
  evaluation: ItemEvaluation,
  facts: CraftingFacts,
  settings: CraftingSettings,
): CraftingRiskAssessment {
  const risks: string[] = [];
  let penalty = 0;
  let scoreCap = 100;
  if (item.corrupted) {
    risks.push('The item is corrupted; normal crafting actions are unavailable or severely restricted.');
    penalty += 55;
    scoreCap = 15;
  }
  if (item.rarity === 'unique') {
    risks.push('Unique items are interaction and price checks, not normal affix-crafting projects.');
    penalty += 45;
    scoreCap = Math.min(scoreCap, 20);
  }
  if (facts.baseQuality.score < 30) {
    risks.push('The base is too weak to justify meaningful currency investment.');
    penalty += 18;
    scoreCap = Math.min(scoreCap, 28);
  }
  if (facts.missing.length >= 4) {
    risks.push('Too many core stats are missing for one or two currency actions to fix.');
    penalty += 18;
    scoreCap = Math.min(scoreCap, 38);
  } else if (facts.missing.length === 3) {
    risks.push('Three important stats are missing, making the craft highly uncertain.');
    penalty += 9;
  }
  if (facts.wasted.length >= 3) {
    risks.push('Several wasted modifiers occupy affix space.');
    penalty += 18;
    scoreCap = Math.min(scoreCap, 35);
  } else if (facts.wasted.length === 2) {
    risks.push('Two weak or wasted modifiers reduce crafting efficiency.');
    penalty += 8;
  }
  if (facts.strongRolls.length === 1 && facts.weakRolls.length + facts.missing.length >= 4) {
    risks.push('One excellent roll is carrying an otherwise weak item.');
    penalty += 12;
    scoreCap = Math.min(scoreCap, 42);
  }
  if (
    facts.category === 'boots' &&
    !(item.movementSpeed || 0) &&
    !((item.life || 0) >= 90 && resistanceTotal(item) >= 90)
  ) {
    risks.push('Boots without movement speed are usually a poor currency investment.');
    penalty += 12;
    scoreCap = Math.min(scoreCap, 37);
  }
  if (['leveling', 'campaign'].includes(facts.bestUseCase)) {
    risks.push('This is mainly a leveling/campaign item; expensive crafting is inefficient.');
    penalty += 8;
    if (settings.conservativeCraftingRecommendations) scoreCap = Math.min(scoreCap, 48);
  }
  if (!item.itemLevel) risks.push('Unknown item level makes affix-tier planning unreliable.');
  if (settings.craftingRiskTolerance === 'Low') penalty += 5;
  else if (settings.craftingRiskTolerance === 'High') penalty = Math.max(0, penalty - 3);
  if (settings.conservativeCraftingRecommendations && facts.rollQuality.score < 35) {
    penalty += 5;
    scoreCap = Math.min(scoreCap, 32);
  }
  const severity =
    item.corrupted || item.rarity === 'unique' ? 'Extreme' : penalty >= 25 ? 'High' : penalty >= 10 ? 'Medium' : 'Low';
  return { risks: unique(risks), penalty, scoreCap, riskLabel: severity };
}
const unique = <T>(values: T[]) => [...new Set(values)];
const resistanceTotal = (item: ItemStats) =>
  (item.fireResistance || 0) +
  (item.coldResistance || 0) +
  (item.lightningResistance || 0) +
  (item.chaosResistance || 0);
