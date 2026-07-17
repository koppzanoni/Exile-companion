import { statValues } from './statDelta.js';
import type { ScoringContext } from './buildScoringContext.js';
import { scoreResistanceAgainstCap } from './resistanceCapScoring.js';
import { RESISTANCE_CAP_DEFAULT, criticalValue } from './statTargets.js';
import type { ItemCategory, ItemEvaluation, ItemStats } from './types.js';

export interface ComparisonDimensions {
  offensive: number;
  defensive: number;
  utility: number;
  category: number;
  buildFit: number;
  overall: number;
}

export function scoreComparisonDimensions(
  item: ItemStats,
  category: ItemCategory,
  evaluation: ItemEvaluation,
  context: ScoringContext,
): ComparisonDimensions {
  const v = statValues(item, category);
  const weapon = [
    'bow',
    'crossbow',
    'one-handed-melee',
    'two-handed-melee',
    'quarterstaff',
    'staff',
    'wand',
    'sceptre',
  ].includes(category);
  const crit = context.critical ? criticalValue(item) : 0;
  let offensive = 0;
  if (['bow', 'crossbow', 'one-handed-melee', 'two-handed-melee', 'quarterstaff'].includes(category))
    offensive =
      (v.totalDps || 0) / 10 +
      (v.attacksPerSecond || 0) * 7 +
      crit * 1.5 +
      (v.attackSpeedBonus || 0) * 0.35 +
      (v.projectileDamage || 0) * 0.25 +
      (v.accuracy || 0) * 0.018 +
      (v.skillLevels || 0) * 10;
  else if (['staff', 'wand', 'sceptre', 'focus'].includes(category))
    offensive = (v.spellDamage || 0) * 0.45 + (v.castSpeed || 0) * 0.55 + crit * 1.5 + (v.skillLevels || 0) * 13;
  else if (category === 'quiver')
    offensive =
      (v.flatDamage || 0) * 1.2 +
      (v.projectileDamage || 0) * 0.5 +
      (v.attackSpeedBonus || 0) * 0.7 +
      crit * 0.45 +
      (v.accuracy || 0) * 0.02 +
      (v.skillLevels || 0) * 12;
  else if (['ring', 'amulet', 'gloves'].includes(category))
    offensive =
      (v.flatDamage || 0) * 0.8 +
      (v.attackSpeedBonus || 0) * 0.5 +
      (v.castSpeed || 0) * 0.5 +
      crit * 0.35 +
      (v.spellDamage || 0) * 0.3 +
      (v.skillLevels || 0) * 12;
  const defensive = weapon
    ? 0
    : (v.life || 0) * 0.32 +
      effectiveResistanceTotal(v, context) * 0.24 +
      Math.sqrt(Math.max(0, (v.armour || 0) + (v.evasion || 0) + (v.energyShield || 0))) * 1.25 +
      (category === 'shield'
        ? (v.blockChance || 0) * 1.8 + (v.increasedBlockChance || 0) * 0.8 + (v.stunThreshold || 0) * 0.25
        : 0);
  let utility =
    (v.mana || 0) * 0.08 +
    (v.spirit || 0) * 0.7 +
    ((v.strength || 0) + (v.dexterity || 0) + (v.intelligence || 0)) * 0.12 +
    (v.rarityFind || 0) * 0.25 +
    (v.skillLevels || 0) * 5 +
    (v.lifeRegeneration || 0) * 0.4 +
    (v.manaRegeneration || 0) * 0.25;
  if (category === 'boots') utility += (v.movementSpeed || 0) * 1.8;
  if (category === 'belt')
    utility += (v.charmSlots || 0) * 14 + (v.flaskChargesGained || 0) * 0.35 - (v.reducedFlaskChargesUsed || 0) * 0.35;
  const categoryScore = evaluation.categoryAnalysis?.categoryScore ?? evaluation.score;
  const buildFit = evaluation.buildFitAnalysis?.score ?? evaluation.personalized?.score ?? 0;
  return {
    offensive: round(offensive),
    defensive: round(defensive),
    utility: round(utility),
    category: categoryScore,
    buildFit,
    overall: evaluation.score,
  };
}

export function dimensionDeltas(candidate: ComparisonDimensions, equipped: ComparisonDimensions) {
  return {
    offensive: round(candidate.offensive - equipped.offensive),
    defensive: round(candidate.defensive - equipped.defensive),
    utility: round(candidate.utility - equipped.utility),
    category: round(candidate.category - equipped.category),
    buildFit: round(candidate.buildFit - equipped.buildFit),
    overall: round(candidate.overall - equipped.overall),
  };
}
const resistanceStats = ['fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance'] as const;
const effectiveResistanceTotal = (v: Record<string, number>, context: ScoringContext) =>
  resistanceStats.reduce(
    (sum, stat) =>
      sum +
      scoreResistanceAgainstCap(
        v[stat] || 0,
        context.caps?.[stat] ?? RESISTANCE_CAP_DEFAULT,
        context.current[stat] || 0,
      ).effectiveAfterCap,
    0,
  );
const round = (value: number) => Math.round(value * 100) / 100;
