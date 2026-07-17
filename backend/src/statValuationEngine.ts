import type { ItemCategory, ItemStats } from './types.js';
import {
  ATTRIBUTE_TARGET,
  BLOCK_CHANCE_TARGET,
  CRITICAL_DAMAGE_TARGET,
  RESISTANCE_CAP_DEFAULT,
  criticalValue,
  defensiveTarget,
  deflectionTarget,
  elementalDpsTarget,
  energyShieldTarget,
  lifeTarget,
  physicalDpsTarget,
  resolveItemLevel,
  runicWardTarget,
} from './statTargets.js';
import { scoreResistanceAgainstCap } from './resistanceCapScoring.js';
export { deriveBuildWeights, deriveCritical, deriveDamageTags, deriveSlotWeights } from './buildScoringContext.js';

export interface StatValuationContext {
  slot: ItemCategory;
  critical: boolean;
  damageTags: string[];
  current: {
    life?: number;
    mana?: number;
    spirit?: number;
    fireResistance?: number;
    coldResistance?: number;
    lightningResistance?: number;
    chaosResistance?: number;
    strength?: number;
    dexterity?: number;
    intelligence?: number;
  };
  requirements?: Partial<Record<'spirit' | 'strength' | 'dexterity' | 'intelligence', number>>;
  caps?: Partial<Record<'fireResistance' | 'coldResistance' | 'lightningResistance' | 'chaosResistance', number>>;
  buildWeight?: Partial<Record<string, number>>;
  slotWeight?: Partial<Record<string, number>>;
}
export interface StatContribution {
  stat: string;
  value: number;
  score: number;
  category: 'offence' | 'defence' | 'utility';
  reason: string;
  conditional: boolean;
  wasted: boolean;
  source: 'parsed' | 'derived';
  local: boolean;
  tier?: number;
  buildWeight: number;
  slotWeight: number;
  effectiveBeforeCap: number;
  effectiveAfterCap: number;
  offenceContribution: number;
  defenceContribution: number;
  utilityContribution: number;
  requirementContribution: number;
}
export interface StatValuation {
  offenceScore: number;
  defenceScore: number;
  utilityScore: number;
  overallScore: number;
  contributions: StatContribution[];
  warnings: string[];
}

const DEFAULT_WEIGHT = 1;

export function valueItemStats(item: ItemStats, context: StatValuationContext): StatValuation {
  const contributions: StatContribution[] = [];
  const warnings: string[] = [];
  const weightFor = (stat: string) => context.buildWeight?.[stat] ?? DEFAULT_WEIGHT;
  const slotWeightFor = (stat: string) => context.slotWeight?.[stat] ?? DEFAULT_WEIGHT;
  const add = (
    entry: Omit<
      StatContribution,
      | 'buildWeight'
      | 'slotWeight'
      | 'offenceContribution'
      | 'defenceContribution'
      | 'utilityContribution'
      | 'requirementContribution'
    > & { requirementDriven?: boolean },
  ) => {
    const buildWeight = weightFor(entry.stat);
    const slotWeight = slotWeightFor(entry.stat);
    const requirementDriven = Boolean(entry.requirementDriven);
    contributions.push({
      ...entry,
      buildWeight,
      slotWeight,
      offenceContribution: entry.category === 'offence' ? entry.score : 0,
      defenceContribution: entry.category === 'defence' ? entry.score : 0,
      utilityContribution: entry.category === 'utility' && !requirementDriven ? entry.score : 0,
      requirementContribution: requirementDriven ? entry.score : 0,
    });
  };
  const diminishing = (value: number, target: number) =>
    Math.round(100 * (1 - Math.exp(-Math.max(0, value) / Math.max(1, target))));
  const level = resolveItemLevel(item);

  if (item.life)
    add({
      stat: 'Maximum Life',
      value: item.life,
      score: diminishing(item.life, lifeTarget(level)),
      category: 'defence',
      reason: 'Increases the life pool with diminishing returns at high rolls.',
      conditional: false,
      wasted: false,
      source: 'parsed',
      local: false,
      effectiveBeforeCap: item.life,
      effectiveAfterCap: item.life,
    });

  const localDefences: Array<[keyof ItemStats, string, number]> = [
    ['armour', 'Armour', defensiveTarget('armour', context.slot)],
    ['evasion', 'Evasion', defensiveTarget('evasion', context.slot)],
    ['energyShield', 'Energy Shield', energyShieldTarget(context.slot)],
    ['deflection', 'Deflection', deflectionTarget(context.slot)],
    ['runicWard', 'Runic Ward', runicWardTarget(context.slot)],
  ];
  for (const [key, label, target] of localDefences) {
    const value = item[key] as number | undefined;
    if (!value) continue;
    add({
      stat: label,
      value,
      score: diminishing(value, target),
      category: 'defence',
      reason: `Local defensive value on this item's own base (${label.toLowerCase()} is not shared across the character).`,
      conditional: false,
      wasted: false,
      source: 'parsed',
      local: true,
      effectiveBeforeCap: value,
      effectiveAfterCap: value,
    });
  }

  if (context.slot === 'shield') {
    const block = (item.blockChance || 0) + (item.increasedBlockChance || 0);
    if (block)
      add({
        stat: 'Block chance',
        value: block,
        score: diminishing(block, BLOCK_CHANCE_TARGET),
        category: 'defence',
        reason: 'Chance to fully avoid a hit; combines base and increased block chance.',
        conditional: false,
        wasted: false,
        source: 'parsed',
        local: true,
        effectiveBeforeCap: block,
        effectiveAfterCap: block,
      });
  }

  for (const stat of ['fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance'] as const) {
    const value = item[stat] || 0;
    if (!value) continue;
    const cap = context.caps?.[stat] ?? RESISTANCE_CAP_DEFAULT;
    const current = context.current[stat] || 0;
    const result = scoreResistanceAgainstCap(value, cap, current);
    add({
      stat,
      value,
      score: result.score,
      category: 'defence',
      reason: result.reason,
      conditional: true,
      wasted: result.wasted,
      source: 'parsed',
      local: false,
      effectiveBeforeCap: value,
      effectiveAfterCap: result.effectiveAfterCap,
    });
  }

  for (const stat of ['strength', 'dexterity', 'intelligence', 'spirit'] as const) {
    const value = item[stat] || 0;
    if (!value) continue;
    const requirement = context.requirements?.[stat];
    const current = context.current[stat] || 0;
    const gap = requirement ? Math.max(0, requirement - current) : 0;
    const solves = requirement ? Math.min(value, gap) : 0;
    const score = requirement
      ? gap === 0
        ? 10
        : Math.min(100, Math.round((100 * solves) / Math.max(1, gap)))
      : diminishing(value, ATTRIBUTE_TARGET);
    add({
      stat,
      value,
      score,
      category: 'utility',
      reason: requirement
        ? gap === 0
          ? 'Requirement is already met; this value is mostly surplus.'
          : solves >= gap
            ? 'Reaches the required breakpoint.'
            : `Still ${gap - solves} short of the required breakpoint.`
        : 'Provides general requirement flexibility.',
      conditional: Boolean(requirement),
      wasted: Boolean(requirement && gap === 0),
      source: 'parsed',
      local: false,
      effectiveBeforeCap: value,
      effectiveAfterCap: value,
      requirementDriven: Boolean(requirement),
    });
  }

  const crit = criticalValue(item);
  if (crit)
    add({
      stat: 'Critical scaling',
      value: crit,
      score: context.critical ? diminishing(crit, CRITICAL_DAMAGE_TARGET) : 0,
      category: 'offence',
      reason: context.critical ? 'Scales the selected critical build.' : 'The selected build is non-critical.',
      conditional: true,
      wasted: !context.critical,
      source: 'parsed',
      local: true,
      effectiveBeforeCap: crit,
      effectiveAfterCap: context.critical ? crit : 0,
    });

  const physical = avg(item.physicalDamageMin, item.physicalDamageMax) * (item.attacksPerSecond || 1);
  const elemental =
    (avg(item.fireDamageMin, item.fireDamageMax) +
      avg(item.coldDamageMin, item.coldDamageMax) +
      avg(item.lightningDamageMin, item.lightningDamageMax)) *
    (item.attacksPerSecond || 1);
  if (physical) {
    const matches = context.damageTags.some((tag) => /physical/i.test(tag));
    add({
      stat: 'Physical DPS',
      value: physical,
      score: diminishing(physical, physicalDpsTarget(level)),
      category: 'offence',
      reason: matches ? 'Matches the build damage source.' : 'Physical damage is not a primary selected tag.',
      conditional: true,
      wasted: !matches,
      source: 'parsed',
      local: true,
      effectiveBeforeCap: physical,
      effectiveAfterCap: physical,
    });
  }
  if (elemental) {
    const matches = context.damageTags.some((tag) => /cold|fire|lightning|elemental/i.test(tag));
    add({
      stat: 'Elemental DPS',
      value: elemental,
      score: diminishing(elemental, elementalDpsTarget(level)),
      category: 'offence',
      reason: matches ? 'Matches the build damage tags.' : 'Elemental damage is not a selected damage source.',
      conditional: true,
      wasted: !matches,
      source: 'parsed',
      local: true,
      effectiveBeforeCap: elemental,
      effectiveAfterCap: elemental,
    });
  }

  const score = (category: StatContribution['category']) =>
    weightedAverage(contributions.filter((entry) => entry.category === category && !entry.wasted));
  const offenceScore = score('offence'),
    defenceScore = score('defence'),
    utilityScore = score('utility');
  const groups = [offenceScore, defenceScore, utilityScore].filter((value) => value > 0);
  if (!contributions.length) warnings.push('No supported numeric stats were available for valuation.');
  return {
    offenceScore,
    defenceScore,
    utilityScore,
    overallScore: groups.length ? Math.round(groups.reduce((a, b) => a + b, 0) / groups.length) : 0,
    contributions,
    warnings,
  };
}
const avg = (min?: number, max?: number) => (min === undefined || max === undefined ? 0 : (min + max) / 2);
const weightedAverage = (rows: StatContribution[]) => {
  if (!rows.length) return 0;
  const weighted = rows.map((row) => ({
    score: row.score,
    weight: Math.max(0.1, row.buildWeight * row.slotWeight),
  }));
  const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  return Math.round(weighted.reduce((sum, row) => sum + row.score * row.weight, 0) / totalWeight);
};
