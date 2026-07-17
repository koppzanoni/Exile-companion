import type { BuildFitProfile, ItemCategory, ItemEvaluation, ItemStats } from './types.js';
import type { ScoringContext } from './buildScoringContext.js';
import { scoreResistanceAgainstCap } from './resistanceCapScoring.js';
import {
  ATTRIBUTE_TARGET,
  CRITICAL_DAMAGE_TARGET,
  RESISTANCE_CAP_DEFAULT,
  criticalValue,
  defensiveTarget,
  deflectionTarget,
  elementalDpsTarget,
  energyShieldTarget,
  flatAddedDamageTarget,
  lifeTarget,
  physicalDpsTarget,
  resolveItemLevel,
  runicWardTarget,
  weaponDamageTarget,
} from './statTargets.js';

export interface BuildFitScoreBreakdown {
  score: number;
  fits: string[];
  conflicts: string[];
  missing: string[];
  wasted: string[];
  confidence: number;
  warnings: string[];
}

const weaponCategories: ItemCategory[] = [
  'bow',
  'crossbow',
  'one-handed-melee',
  'two-handed-melee',
  'staff',
  'quarterstaff',
  'wand',
  'sceptre',
];
const offensiveSlots: ItemCategory[] = [...weaponCategories, 'quiver', 'focus', 'gloves', 'ring', 'amulet'];

export function scoreBuildFit(
  item: ItemStats,
  evaluation: ItemEvaluation,
  profile: BuildFitProfile,
  context: ScoringContext,
): BuildFitScoreBreakdown {
  const category = evaluation.categoryAnalysis?.detectedCategory.key || evaluation.category?.key || 'other';
  const text = `${item.rawText || ''}\n${(item.customMods || []).join('\n')}`;
  const fits: string[] = [];
  const conflicts: string[] = [];
  const missing: string[] = [];
  const wasted: string[] = [];
  const warnings: string[] = [];
  let earned = 0;
  let possible = 0;
  const isWeapon = weaponCategories.includes(category);
  const offensiveSlot = offensiveSlots.includes(category);

  if (isWeapon && profile.preferredWeaponTypes.length) {
    possible += 12;
    if (profile.preferredWeaponTypes.includes(category)) {
      earned += 12;
      fits.push(`Correct weapon base: ${evaluation.categoryAnalysis?.detectedCategory.label || category}`);
    } else {
      conflicts.push(`Build prefers ${profile.preferredWeaponTypes.join(' / ')}, not ${category}`);
    }
  }
  if (profile.valuableSlots.includes(category)) {
    earned += 2;
    possible += 2;
  }

  if (offensiveSlot)
    scoreGroup(
      profile.offensiveStats,
      38,
      item,
      text,
      category,
      context,
      (earnedValue) => (earned += earnedValue),
      (value) => (possible += value),
      fits,
      missing,
    );
  if (!isWeapon)
    scoreGroup(
      profile.defensiveStats,
      34,
      item,
      text,
      category,
      context,
      (earnedValue) => (earned += earnedValue),
      (value) => (possible += value),
      fits,
      missing,
    );
  scoreGroup(
    profile.attributes,
    8,
    item,
    text,
    category,
    context,
    (earnedValue) => (earned += earnedValue),
    (value) => (possible += value),
    fits,
    missing,
    false,
  );
  scoreGroup(
    profile.utilityStats,
    12,
    item,
    text,
    category,
    context,
    (earnedValue) => (earned += earnedValue),
    (value) => (possible += value),
    fits,
    missing,
    false,
  );

  const categoryPriority = profile.categoryPriorities[category] || [];
  if (categoryPriority.length)
    scoreGroup(
      categoryPriority,
      18,
      item,
      text,
      category,
      context,
      (earnedValue) => (earned += earnedValue),
      (value) => (possible += value),
      fits,
      missing,
    );
  possible += 6;
  earned += ((evaluation.categoryAnalysis?.categoryScore || evaluation.score) / 100) * 6;

  let wastedMatches = 0;
  for (const stat of profile.wastedStats) {
    if (statStrength(stat, item, text, category, context) > 0.15) {
      wasted.push(stat);
      wastedMatches++;
    }
  }
  for (const line of evaluation.categoryAnalysis?.weakOrWastedStats || []) {
    if (!wasted.some((entry) => line.toLowerCase().includes(entry.toLowerCase()))) wasted.push(line);
  }
  if (
    isWeapon &&
    (item.life || item.fireResistance || item.coldResistance || item.lightningResistance || item.chaosResistance)
  ) {
    wasted.push('Defensive weapon affixes do not improve build damage');
  }

  if (profile.source === 'generic')
    warnings.push('No specific build was selected; fit uses general category usefulness and market coherence.');
  if (!profile.offensiveStats.length && !profile.defensiveStats.length)
    warnings.push('This build profile has limited stat priorities.');
  if ((evaluation.knowledge?.confidence.score || 0) < 55)
    warnings.push('Item parsing confidence is limited; enable Advanced Item Descriptions and paste the complete item.');
  if (category === 'other') warnings.push('Unknown item category reduces build-fit accuracy.');

  const raw = (earned / Math.max(1, possible)) * 100 - wastedMatches * 5 - conflicts.length * 14;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const completeness = [
    profile.preferredWeaponTypes.length,
    profile.defensiveLayers.length,
    profile.offensiveStats.length + profile.defensiveStats.length,
    profile.attributes.length + profile.utilityStats.length,
  ].filter(Boolean).length;
  const confidence = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        (evaluation.knowledge?.confidence.score || 55) * 0.55 +
          (completeness / 4) * 35 +
          (category !== 'other' ? 10 : 0),
      ),
    ),
  );
  return {
    score,
    fits: unique(fits).slice(0, 8),
    conflicts: unique(conflicts).slice(0, 6),
    missing: unique(missing).slice(0, 7),
    wasted: unique(wasted).slice(0, 7),
    confidence,
    warnings: unique(warnings),
  };
}

function scoreGroup(
  stats: string[],
  weight: number,
  item: ItemStats,
  text: string,
  category: ItemCategory,
  context: ScoringContext,
  addEarned: (value: number) => void,
  addPossible: (value: number) => void,
  fits: string[],
  missing: string[],
  important = true,
) {
  const relevant = stats.filter((stat) => statRelevantToSlot(stat, category));
  if (!relevant.length) return;
  const per = weight / relevant.length;
  for (const stat of relevant) {
    const strength = statStrength(stat, item, text, category, context);
    addPossible(per);
    addEarned(per * strength);
    if (strength >= 0.2)
      fits.push(
        `${stat} — ${strength >= 0.85 ? 'excellent' : strength >= 0.6 ? 'strong' : strength >= 0.35 ? 'moderate' : 'low'} (${Math.round(strength * 100)}% of target)`,
      );
    else if (important) missing.push(stat);
  }
}

const NEUTRAL_CONTEXT: ScoringContext = { critical: false, damageTags: [], current: {} };

export function statStrength(
  raw: string,
  item: ItemStats,
  text: string,
  category: ItemCategory = 'other',
  context: ScoringContext = NEUTRAL_CONTEXT,
): number {
  const stat = raw.toLowerCase().replace(/[_-]/g, ' ').trim();
  const level = resolveItemLevel(item);
  const ratio = (value: number, target: number) => Math.max(0, Math.min(1, value / Math.max(1, target)));
  const number = (pattern: RegExp) => Number(text.match(pattern)?.[1] || 0);
  const average = (min?: number, max?: number) => (min === undefined || max === undefined ? 0 : (min + max) / 2);
  const aps = item.attacksPerSecond || 1;
  const physicalDps = average(item.physicalDamageMin, item.physicalDamageMax) * aps;
  const coldDps = average(item.coldDamageMin, item.coldDamageMax) * aps;
  const fireDps = average(item.fireDamageMin, item.fireDamageMax) * aps;
  const lightningDps = average(item.lightningDamageMin, item.lightningDamageMax) * aps;
  const elementalDps = coldDps + fireDps + lightningDps + average(item.chaosDamageMin, item.chaosDamageMax) * aps;
  const fallback = (pattern: RegExp) => (pattern.test(text) ? 0.35 : 0);
  if (stat.includes('weapon damage')) return ratio(physicalDps + elementalDps, weaponDamageTarget(level));
  if (stat.includes('physical damage')) {
    const measured = Math.max(
      ratio(physicalDps, physicalDpsTarget(level)),
      ratio(number(/(\d+)% increased Physical Damage/i), 120),
    );
    return measured || fallback(/Physical Damage/i);
  }
  if (stat.includes('added cold') || stat === 'cold damage') {
    const measured = Math.max(
      ratio(coldDps, elementalDpsTarget(level)),
      ratio(number(/Adds \d+(?:\([^)]*\))? to (\d+)(?:\([^)]*\))? Cold Damage/i), flatAddedDamageTarget(level)),
    );
    return measured || fallback(/Cold Damage/i);
  }
  if (stat.includes('added fire') || stat === 'fire damage') {
    const measured = Math.max(
      ratio(fireDps, elementalDpsTarget(level)),
      ratio(number(/Adds \d+(?:\([^)]*\))? to (\d+)(?:\([^)]*\))? Fire Damage/i), flatAddedDamageTarget(level)),
    );
    return measured || fallback(/Fire Damage/i);
  }
  if (stat.includes('added lightning') || stat === 'lightning damage') {
    const measured = Math.max(
      ratio(lightningDps, elementalDpsTarget(level)),
      ratio(number(/Adds \d+(?:\([^)]*\))? to (\d+)(?:\([^)]*\))? Lightning Damage/i), flatAddedDamageTarget(level)),
    );
    return measured || fallback(/Lightning Damage/i);
  }
  if (stat.includes('projectile damage')) {
    const measured = Math.max(
      ratio(number(/(\d+)% increased Projectile Damage/i), 40),
      ratio(item.projectileSkillLevels || 0, 3),
    );
    return measured || fallback(/Projectile|Bow Damage/i);
  }
  if (stat.includes('melee damage')) {
    const measured = Math.max(
      ratio(number(/(\d+)% increased (?:Melee|Damage with.*Melee)/i), 40),
      ratio(item.meleeSkillLevels || 0, 3),
    );
    return measured || fallback(/Melee/i);
  }
  if (stat.includes('spell damage')) {
    const measured = ratio(item.spellDamage || number(/(\d+)% increased Spell Damage/i), 85);
    return measured || fallback(/Spell Damage/i);
  }
  if (stat.includes('minion damage')) {
    const measured = ratio(number(/(\d+)% increased Minion Damage/i), 50);
    return measured || fallback(/Minions? deal/i);
  }
  if (stat.includes('minion stats'))
    return Math.max(
      ratio(item.minionSkillLevels || 0, 3),
      ratio(number(/(\d+)% increased Minion Damage/i), 50),
      fallback(/Minion/i),
    );
  if (stat.includes('spell stats'))
    return Math.max(
      statStrength('spell damage', item, text, category, context),
      statStrength('cast speed', item, text, category, context),
      ratio(item.spellSkillLevels || 0, 3),
    );
  if (stat.includes('attack stats'))
    return Math.max(
      statStrength('attack speed', item, text, category, context),
      statStrength('accuracy', item, text, category, context),
      ratio(physicalDps + elementalDps, weaponDamageTarget(level)),
    );
  if (stat.includes('minion skill')) return Math.max(ratio(item.minionSkillLevels || 0, 3), fallback(/Minion Skills/i));
  if (stat.includes('skill level'))
    return Math.max(
      ratio(
        Math.max(
          item.projectileSkillLevels || 0,
          item.meleeSkillLevels || 0,
          item.spellSkillLevels || 0,
          item.minionSkillLevels || 0,
        ),
        3,
      ),
      fallback(/level of all .*Skills/i),
    );
  if (stat.includes('attack speed'))
    return Math.max(
      ratio(item.attackSpeedBonus || number(/(\d+)% increased Attack Speed/i), 20),
      ratio(Math.max(0, aps - 1.2), 0.65) * 0.65,
    );
  if (stat.includes('cast speed'))
    return Math.max(ratio(item.castSpeed || number(/(\d+)% increased Cast Speed/i), 20), fallback(/Cast Speed/i));
  if (stat.includes('critical')) return context.critical ? ratio(criticalValue(item), CRITICAL_DAMAGE_TARGET) : 0;
  if (stat.includes('accuracy')) {
    const measured = ratio(number(/\+?(\d+) to Accuracy Rating/i), 350);
    return measured || fallback(/Accuracy/i);
  }
  if (stat === 'life') return ratio(item.life || 0, lifeTarget(level));
  if (stat === 'armour' || stat === 'defence') return ratio(item.armour || 0, defensiveTarget('armour', category));
  if (stat === 'evasion') return ratio(item.evasion || 0, defensiveTarget('evasion', category));
  if (stat.includes('energy shield')) return ratio(item.energyShield || 0, energyShieldTarget(category));
  if (stat.includes('deflection')) return ratio(item.deflection || 0, deflectionTarget(category));
  if (stat.includes('runic ward')) return ratio(item.runicWard || 0, runicWardTarget(category));
  if (stat.includes('resistance')) {
    const resistanceStats: Array<'fireResistance' | 'coldResistance' | 'lightningResistance' | 'chaosResistance'> = [
      'fireResistance',
      'coldResistance',
      'lightningResistance',
      'chaosResistance',
    ];
    const present = resistanceStats.filter((key) => item[key]);
    if (!present.length) return 0;
    const scores = present.map(
      (key) =>
        scoreResistanceAgainstCap(
          item[key] || 0,
          context.caps?.[key] ?? RESISTANCE_CAP_DEFAULT,
          context.current[key] || 0,
        ).score / 100,
    );
    return scores.reduce((sum, value) => sum + value, 0) / scores.length;
  }
  if (stat.includes('stun threshold') || stat === 'stun')
    return Math.max(ratio(item.stunThreshold || 0, 300), fallback(/Stun/i));
  if (stat === 'strength') return ratio(item.strength || 0, ATTRIBUTE_TARGET);
  if (stat === 'dexterity') return ratio(item.dexterity || 0, ATTRIBUTE_TARGET);
  if (stat === 'intelligence') return ratio(item.intelligence || 0, ATTRIBUTE_TARGET);
  if (stat.includes('movement speed')) return ratio(item.movementSpeed || 0, 30);
  if (stat === 'mana') return ratio(item.mana || 0, 100);
  if (stat === 'spirit') return ratio(item.spirit || 0, ATTRIBUTE_TARGET);
  if (stat === 'leech') return fallback(/Leech/i);
  if (stat === 'reload') return Math.max(ratio(number(/(\d+)% increased Reload Speed/i), 25), fallback(/Reload/i));
  if (stat === 'rarity') return ratio(item.rarityFind || 0, 30);
  if (stat.includes('attack damage'))
    return Math.max(
      ratio(number(/(\d+)% increased Attack Damage/i), 45),
      ratio(physicalDps + elementalDps, Math.max(55, level * 5)),
      fallback(/Damage to Attacks/i),
    );
  if (stat.includes('block')) return ratio((item.blockChance || 0) + (item.increasedBlockChance || 0), 35);
  return fallback(new RegExp(escapeRegex(raw), 'i'));
}

export function signalPresent(raw: string, item: ItemStats, text: string) {
  return statStrength(raw, item, text) > 0.15;
}

function statRelevantToSlot(raw: string, category: ItemCategory) {
  const stat = raw.toLowerCase();
  const isWeapon = weaponCategories.includes(category);
  const armour = ['body-armour', 'helmet', 'gloves', 'boots', 'shield', 'focus'].includes(category);
  const jewellery = ['ring', 'amulet', 'belt'].includes(category);
  if (stat.includes('movement speed')) return category === 'boots';
  if (/weapon damage|physical damage/.test(stat)) return isWeapon;
  if (/attack speed|accuracy/.test(stat))
    return [
      'bow',
      'crossbow',
      'one-handed-melee',
      'two-handed-melee',
      'quarterstaff',
      'gloves',
      'quiver',
      'ring',
    ].includes(category);
  if (/cast speed|spell damage/.test(stat))
    return ['wand', 'staff', 'sceptre', 'focus', 'gloves', 'ring', 'amulet'].includes(category);
  if (
    /projectile damage|added cold|added fire|added lightning|cold damage|fire damage|lightning damage|critical|attack damage|melee damage/.test(
      stat,
    )
  )
    return offensiveSlots.includes(category);
  if (/minion/.test(stat))
    return ['sceptre', 'wand', 'staff', 'focus', 'helmet', 'amulet', 'body-armour'].includes(category);
  if (/skill level/.test(stat))
    return [
      'bow',
      'crossbow',
      'one-handed-melee',
      'two-handed-melee',
      'staff',
      'quarterstaff',
      'wand',
      'sceptre',
      'focus',
      'amulet',
    ].includes(category);
  if (/life|resistance/.test(stat)) return !isWeapon;
  if (/armour|evasion|energy shield|deflection|runic ward|defence|block|stun threshold/.test(stat)) return armour;
  if (/strength|dexterity|intelligence/.test(stat)) return !isWeapon;
  if (/mana|spirit/.test(stat)) return !isWeapon || ['wand', 'staff', 'sceptre', 'focus'].includes(category);
  if (/reload/.test(stat)) return ['crossbow', 'gloves', 'belt'].includes(category);
  if (/leech/.test(stat)) return isWeapon || jewellery;
  return true;
}
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = <T>(values: T[]) => [...new Set(values)];
