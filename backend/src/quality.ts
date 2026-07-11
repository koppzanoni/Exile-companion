import type { BuildFit, BuildFitProfile, BuildPriority, BuildStat, ItemEvaluation, ItemStats, PersonalizedBuildFit } from './types.js';
import { detectItemCategory, evaluateSpecialSlot } from './slotQuality.js';
import { applyItemKnowledge } from './itemKnowledge.js';

interface Archetype {
  name: string;
  desired: Array<[keyof ItemStats, number, string]>;
  custom?: RegExp;
  conflict?: (item: ItemStats) => string[];
}

const archetypes: Archetype[] = [
  {
    name: 'Life-based melee / armour',
    desired: [['life', 22, 'high life'], ['armour', 16, 'armour'], ['movementSpeed', 20, 'movement speed'], ['strength', 7, 'strength'], ['fireResistance', 6, 'fire resistance'], ['coldResistance', 6, 'cold resistance'], ['lightningResistance', 6, 'lightning resistance']],
    custom: /melee|attack|physical damage|rage|stun/i,
  },
  {
    name: 'Life-based ranged / evasion',
    desired: [['life', 22, 'high life'], ['evasion', 16, 'evasion'], ['movementSpeed', 20, 'movement speed'], ['dexterity', 7, 'dexterity'], ['fireResistance', 6, 'fire resistance'], ['coldResistance', 6, 'cold resistance'], ['lightningResistance', 6, 'lightning resistance']],
    custom: /projectile|attack speed|bow|crossbow|accuracy/i,
  },
  {
    name: 'Energy Shield caster / CI',
    desired: [['energyShield', 25, 'energy shield'], ['intelligence', 8, 'intelligence'], ['mana', 10, 'mana'], ['movementSpeed', 18, 'movement speed'], ['chaosResistance', 3, 'chaos resistance'], ['fireResistance', 5, 'fire resistance'], ['coldResistance', 5, 'cold resistance'], ['lightningResistance', 5, 'lightning resistance']],
    custom: /spell|cast speed|energy shield|mana|critical/i,
    conflict: (item) => item.life && !item.energyShield ? ['Life without Energy Shield is usually inefficient for CI'] : [],
  },
  {
    name: 'Minion / Spirit summoner',
    desired: [['spirit', 25, 'spirit'], ['energyShield', 12, 'energy shield'], ['life', 12, 'life'], ['mana', 8, 'mana'], ['movementSpeed', 14, 'movement speed'], ['intelligence', 6, 'intelligence']],
    custom: /minion|spirit|reservation|ally|companion/i,
  },
  {
    name: 'Magic-find mapper',
    desired: [['rarityFind', 30, 'item rarity'], ['movementSpeed', 22, 'movement speed'], ['life', 12, 'life'], ['evasion', 8, 'evasion'], ['fireResistance', 5, 'fire resistance'], ['coldResistance', 5, 'cold resistance'], ['lightningResistance', 5, 'lightning resistance']],
    custom: /rarity|quantity/i,
  },
];

export function evaluateItem(item: ItemStats, profile?: BuildFitProfile | null): ItemEvaluation {
  const category = detectItemCategory(item);
  const special = evaluateSpecialSlot(item, category);
  if (special) return applyItemKnowledge(withPersonalized({ ...special, category }, item, profile), item, category, profile);
  const slot = item.itemType.toLowerCase();
  const isBoots = slot === 'boots' || /boots|greaves|shoes|slippers|sabatons|treads/i.test(item.baseType);
  const isWeapon = slot === 'weapon' || /bow|crossbow|wand|sceptre|staff|mace|sword|axe|dagger|quarterstaff/i.test(item.baseType);
  if (isWeapon) return applyItemKnowledge(withPersonalized({ ...evaluateWeapon(item), category }, item, profile), item, category, profile);
  const totalElementalRes = sum(item.fireResistance, item.coldResistance, item.lightningResistance);
  const totalRes = totalElementalRes + (item.chaosResistance || 0);
  const resCount = [item.fireResistance, item.coldResistance, item.lightningResistance, item.chaosResistance].filter((v) => (v || 0) > 0).length;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const upgrades: string[] = [];
  let score = item.rarity === 'rare' ? 8 : item.rarity === 'unique' ? 10 : 3;

  if (isBoots) {
    const speed = item.movementSpeed || 0;
    if (speed >= 35) { score += 28; strengths.push(`Elite ${speed}% movement speed`); }
    else if (speed >= 30) { score += 24; strengths.push(`Premium ${speed}% movement speed`); }
    else if (speed >= 25) { score += 19; strengths.push(`Good ${speed}% movement speed`); weaknesses.push('Below the premium 30–35% movement-speed tier'); upgrades.push('30–35% movement speed for premium endgame boots'); }
    else if (speed >= 20) { score += 13; strengths.push(`Usable ${speed}% movement speed`); upgrades.push('25%+ movement speed'); }
    else if (speed > 0) { score += 6; weaknesses.push(`Low movement speed (${speed}%)`); upgrades.push('25%+ movement speed'); }
    else { weaknesses.push('No movement speed—a major problem on boots'); upgrades.push('Movement speed is the first required upgrade'); }
  }

  const life = item.life || 0;
  if (life >= 85) { score += 20; strengths.push(`Excellent life (+${life})`); }
  else if (life >= 70) { score += 17; strengths.push(`High life (+${life})`); }
  else if (life >= 60) { score += 13; strengths.push(`Good life (+${life})`); }
  else if (life >= 40) { score += 8; strengths.push(`Moderate life (+${life})`); upgrades.push('70+ maximum life'); }
  else if (life > 0) { score += 3; weaknesses.push(`Low life (+${life})`); upgrades.push('70+ maximum life'); }
  else if (item.rarity === 'rare' && !item.energyShield) { weaknesses.push('No life or Energy Shield defensive identity'); upgrades.push('A strong life or Energy Shield roll'); }

  if ((item.energyShield || 0) >= 180) { score += 18; strengths.push(`Excellent Energy Shield (${item.energyShield})`); }
  else if ((item.energyShield || 0) >= 100) { score += 12; strengths.push(`Strong Energy Shield (${item.energyShield})`); }
  else if ((item.energyShield || 0) > 0) score += 4;
  if ((item.armour || 0) >= 400) { score += 12; strengths.push(`High armour (${item.armour})`); }
  else if ((item.armour || 0) >= 200) { score += 8; strengths.push(`Solid armour (${item.armour})`); }
  else if ((item.armour || 0) > 0) score += 3;
  if ((item.evasion || 0) >= 400) { score += 12; strengths.push(`High evasion (${item.evasion})`); }
  else if ((item.evasion || 0) >= 200) { score += 8; strengths.push(`Solid evasion (${item.evasion})`); }
  else if ((item.evasion || 0) > 0) score += 3;
  if ((item.deflection || 0) >= 400) { score += 12; strengths.push(`High Deflection (${item.deflection})`); }
  else if ((item.deflection || 0) >= 200) { score += 8; strengths.push(`Solid Deflection (${item.deflection})`); }
  else if ((item.deflection || 0) > 0) score += 3;
  if ((item.runicWard || 0) >= 150) { score += 10; strengths.push(`Strong Runic Ward (${item.runicWard})`); }
  else if ((item.runicWard || 0) > 0) { score += 4; strengths.push(`Runic Ward (${item.runicWard})`); }

  if (totalRes >= 100 && resCount >= 3) { score += 18; strengths.push(`Excellent resistance package (+${totalRes}% across ${resCount})`); }
  else if (totalRes >= 70 && resCount >= 2) { score += 14; strengths.push(`Strong resistances (+${totalRes}% across ${resCount})`); }
  else if (totalRes >= 45 && resCount >= 2) { score += 10; strengths.push(`Useful dual resistances (+${totalRes}%)`); weaknesses.push(item.chaosResistance ? 'Only two resistance rolls; elemental coverage is narrow' : 'Only two resistance rolls; no third or chaos resistance'); upgrades.push('A third resistance or higher resistance rolls'); }
  else if (totalRes > 0) { score += 4; weaknesses.push(`Thin resistance coverage (+${totalRes}%)`); upgrades.push('Two or three strong resistance rolls'); }
  else if (item.rarity === 'rare') { weaknesses.push('No resistances'); upgrades.push('Two or three strong resistance rolls'); }
  if ((item.chaosResistance || 0) >= 20) { score += 5; strengths.push(`Valuable chaos resistance (+${item.chaosResistance}%)`); }
  else if ((item.chaosResistance || 0) >= 15) { score += 4; strengths.push(`Useful chaos resistance (+${item.chaosResistance}%)`); }
  if ((item.spirit || 0) >= 20) { score += 10; strengths.push(`Build-enabling Spirit (+${item.spirit})`); }
  if ((item.rarityFind || 0) >= 20) { score += 8; strengths.push(`Meaningful item rarity (${item.rarityFind}%)`); }
  const attributes = sum(item.strength, item.dexterity, item.intelligence);
  if (attributes >= 60) { score += 7; strengths.push(`Strong attribute support (+${attributes} total)`); }
  else if (attributes >= 30) { score += 4; strengths.push(`Useful attributes (+${attributes} total)`); }

  const buildFits = archetypes.map((a) => scoreArchetype(item, a, isBoots)).sort((a, b) => b.score - a.score).slice(0, 3);
  const best = buildFits[0];
  const capped = Math.max(0, Math.min(100, Math.round(score)));
  const grade = capped >= 88 ? 'elite' : capped >= 74 ? 'excellent' : capped >= 55 ? 'good' : capped >= 34 ? 'basic' : 'poor';
  const label = grade === 'elite' ? 'Elite endgame item' : grade === 'excellent' ? 'Excellent endgame item' : grade === 'good' ? 'Good, build-usable item' : grade === 'basic' ? 'Usable but replaceable' : 'Low-value / early upgrade';
  const universalBoots = isBoots && (item.movementSpeed || 0) >= 25 && life >= 60 && totalRes >= 45;
  const marketability = universalBoots || (best.score >= 70 && buildFits[1]?.score >= 55) ? 'broad' : best.score >= 55 ? 'niche' : 'low';
  const verdict = verdictFor(item, grade, best, isBoots, totalRes);
  if (!upgrades.length) upgrades.push('Only specialised build mods or a stronger base would materially improve it');
  return applyItemKnowledge(withPersonalized({ score: capped, grade, label, verdict, marketability, strengths: unique(strengths).slice(0, 6), weaknesses: unique(weaknesses).slice(0, 5), buildFits, upgradePriorities: unique(upgrades).slice(0, 4), category }, item, profile), item, category, profile);
}

function evaluateWeapon(item: ItemStats): ItemEvaluation {
  const mods = item.customMods.length ? item.customMods.join('\n') : item.rawText || '';
  const base = item.baseType.toLowerCase();
  const isProjectile = /bow|crossbow/.test(base) || /projectile|grenade|arrow/i.test(mods);
  const isCaster = /spell damage|cast speed|level of (?:all )?.*spell|spell skills?/i.test(mods) || /wand|sceptre/.test(base) || (/\bstaff\b/.test(base) && !/quarterstaff/.test(base));
  const attacksPerSecond = item.attacksPerSecond || 1;
  const physicalDps = average(item.physicalDamageMin, item.physicalDamageMax) * attacksPerSecond;
  const elementalDps = (
    average(item.fireDamageMin, item.fireDamageMax) +
    average(item.coldDamageMin, item.coldDamageMax) +
    average(item.lightningDamageMin, item.lightningDamageMax) +
    average(item.chaosDamageMin, item.chaosDamageMax)
  ) * attacksPerSecond;
  const totalDps = physicalDps + elementalDps;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const upgrades: string[] = [];
  let score = item.rarity === 'rare' ? 8 : item.rarity === 'unique' ? 10 : 3;

  const physicalPercentRolls = [...mods.matchAll(/^\d+(?:\.\d+)?(?:\([^)]*\))?% increased Physical Damage/gim)].length;
  const hasFlatPhysical = /Adds \d+(?:\([^)]*\))? to \d+(?:\([^)]*\))? Physical Damage/i.test(mods);
  const hasElementalDamage = /Adds \d+(?:\([^)]*\))? to \d+(?:\([^)]*\))? (?:Fire|Cold|Lightning|Chaos) Damage/i.test(mods);
  const hasAttackSpeed = /increased Attack Speed/i.test(mods);
  const hasCastSpeed = /increased Cast Speed/i.test(mods);
  const hasCritical = /Critical Hit Chance|Critical Damage|Critical Strike/i.test(mods);
  const hasAccuracy = /Accuracy Rating/i.test(mods);
  const hasProjectileUtility = /additional (?:Projectile|Arrow)|projectile skills?|grenade skills?/i.test(mods);
  const hasLeech = /Leeches? .* Damage as (?:Life|Mana)/i.test(mods);
  const hasSpellDamage = /increased Spell Damage/i.test(mods);
  const hasSkillLevels = /(?:\+\d+|increased) .*level.*skills?/i.test(mods);
  const defensiveLines = unique(mods.split('\n').filter((line) => /to maximum Life|to .*Resistance|increased Energy Shield|increased Armour|increased Evasion/i.test(line) && !/Leech/i.test(line)));

  if (isCaster) {
    if (hasSpellDamage) { score += 22; strengths.push('Strong spell-damage direction'); }
    if (hasCastSpeed) { score += 16; strengths.push('Cast speed multiplies spell output'); }
    if (hasSkillLevels) { score += 22; strengths.push('Valuable skill-level modifier'); }
    if (hasCritical) { score += 10; strengths.push('Useful caster critical modifier'); }
    if (/mana|spirit|reservation/i.test(mods)) { score += 7; strengths.push('Relevant caster resource support'); }
    if (!hasSpellDamage && !hasSkillLevels) { weaknesses.push('No strong spell-damage or skill-level prefix'); upgrades.push('Spell damage or levels to relevant skills'); }
    if (!hasCastSpeed) upgrades.push('Cast speed or a relevant critical suffix');
  } else {
    const damageTier = weaponDamageTier(totalDps, base);
    score += damageTier.score;
    if (totalDps > 0) strengths.push(`${damageTier.label} weapon DPS (~${Math.round(totalDps)})`);
    if (physicalPercentRolls >= 2) { score += 10; strengths.push('Stacked physical-damage prefixes'); }
    else if (physicalPercentRolls === 1) { score += 5; strengths.push('Physical-damage prefix'); }
    if (hasFlatPhysical) { score += 8; strengths.push('Strong local added physical damage'); }
    if (hasElementalDamage) { score += 6; strengths.push('Local added elemental damage'); }
    if (hasAttackSpeed) { score += 9; strengths.push('Attack-speed suffix'); }
    if (hasCritical || (item.criticalHitChance || 0) >= 7) { score += 8; strengths.push(`Critical scaling${item.criticalHitChance ? ` (${item.criticalHitChance}%)` : ''}`); }
    if (hasProjectileUtility) { score += 8; strengths.push('Build-relevant extra projectile utility'); }
    if (hasAccuracy) score += 2;
    if (hasLeech) { score += 3; strengths.push('Attack leech utility'); }
    if (!totalDps) { weaknesses.push('Weapon damage could not be read'); upgrades.push('A clear local physical or elemental damage package'); }
    else if (damageTier.score <= 8) { weaknesses.push(`Low weapon DPS for this base (~${Math.round(totalDps)})`); upgrades.push('Higher local flat and percentage damage rolls'); }
    if (!hasAttackSpeed && !hasCritical && (item.attacksPerSecond || 0) < 1.5) {
      weaknesses.push('No attack-speed or critical-strike suffix');
      upgrades.push('Attack speed or critical scaling as a damage multiplier');
    }
  }

  if (defensiveLines.length) {
    score -= Math.min(10, defensiveLines.length * 3);
    weaknesses.push(`${defensiveLines.length} defensive affix${defensiveLines.length === 1 ? '' : 'es'} consume weapon mod space`);
    upgrades.push('Replace defensive weapon affixes with offensive damage, speed, critical, or skill modifiers');
  }

  const buildFits = weaponBuildFits({ isCaster, isProjectile, physicalDps, elementalDps, hasAttackSpeed, hasCastSpeed, hasCritical, hasProjectileUtility, hasSpellDamage, hasSkillLevels, hasLeech });
  const best = buildFits[0];
  const capped = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFor(capped);
  const label = labelFor(grade);
  const identity = isCaster ? 'caster' : physicalDps >= elementalDps ? 'physical attack' : 'elemental attack';
  const verdict = `This is ${articleFor(grade)} ${identity} weapon. ${best.score >= 42 ? `Its offensive package fits ${best.name.toLowerCase()} best.` : 'Its offensive modifiers do not yet form a strong build identity.'}${defensiveLines.length ? ' Defensive rolls reduce its value because weapon affixes should normally increase damage or build power.' : ''}`;
  const marketability = capped >= 55 && best.score >= 72 ? 'broad' : best.score >= 50 ? 'niche' : 'low';
  if (!upgrades.length) upgrades.push('A higher damage tier or specialised build-enabling modifier');
  return { score: capped, grade, label, verdict, marketability, strengths: unique(strengths).slice(0, 6), weaknesses: unique(weaknesses).slice(0, 5), buildFits, upgradePriorities: unique(upgrades).slice(0, 4) };
}

interface WeaponFitInput {
  isCaster: boolean; isProjectile: boolean; physicalDps: number; elementalDps: number;
  hasAttackSpeed: boolean; hasCastSpeed: boolean; hasCritical: boolean; hasProjectileUtility: boolean;
  hasSpellDamage: boolean; hasSkillLevels: boolean; hasLeech: boolean;
}

function weaponBuildFits(input: WeaponFitInput): BuildFit[] {
  const projectile = input.isProjectile ? 'projectile' : 'melee';
  const rows: Array<[string, number, string[]]> = input.isCaster ? [
    ['Spell damage caster', (input.hasSpellDamage ? 38 : 0) + (input.hasCastSpeed ? 26 : 0) + (input.hasSkillLevels ? 30 : 0) + (input.hasCritical ? 10 : 0), compactReasons([input.hasSpellDamage && 'spell damage', input.hasCastSpeed && 'cast speed', input.hasSkillLevels && 'skill levels', input.hasCritical && 'critical scaling'])],
    ['Critical spell caster', (input.hasSpellDamage ? 25 : 0) + (input.hasCastSpeed ? 20 : 0) + (input.hasCritical ? 40 : 0) + (input.hasSkillLevels ? 15 : 0), compactReasons([input.hasSpellDamage && 'spell damage', input.hasCastSpeed && 'cast speed', input.hasCritical && 'critical scaling'])],
    ['Minion / Spirit caster', input.hasSkillLevels ? 35 : 5, compactReasons([input.hasSkillLevels && 'skill levels'])],
  ] : [
    [`Physical ${projectile} attack`, Math.min(100, (input.physicalDps > 0 ? 38 : 0) + (input.physicalDps >= input.elementalDps * 1.5 ? 22 : 0) + (input.hasAttackSpeed ? 14 : 0) + (input.hasProjectileUtility ? 16 : 0) + (input.hasLeech ? 8 : 0)), compactReasons([input.physicalDps > 0 && 'physical weapon damage', input.hasAttackSpeed && 'attack speed', input.hasProjectileUtility && 'projectile utility', input.hasLeech && 'leech'])],
    [`Elemental ${projectile} attack`, Math.min(100, (input.elementalDps > 0 ? 45 : 0) + (input.hasAttackSpeed ? 20 : 0) + (input.hasProjectileUtility ? 15 : 0) + (input.hasCritical ? 15 : 0)), compactReasons([input.elementalDps > 0 && 'elemental weapon damage', input.hasAttackSpeed && 'attack speed', input.hasProjectileUtility && 'projectile utility', input.hasCritical && 'critical scaling'])],
    [`Critical ${projectile} attack`, Math.min(100, (input.hasCritical ? 50 : 0) + (input.hasAttackSpeed ? 22 : 0) + (input.hasProjectileUtility ? 12 : 0) + (input.physicalDps + input.elementalDps > 0 ? 12 : 0)), compactReasons([input.hasCritical && 'critical scaling', input.hasAttackSpeed && 'attack speed', input.hasProjectileUtility && 'projectile utility'])],
  ];
  return rows.map(([name, score, reasons]) => ({ name, score, fit: score >= 68 ? 'strong' : score >= 42 ? 'possible' : 'weak', reasons, conflicts: [] } as BuildFit)).sort((a, b) => b.score - a.score);
}

function weaponDamageTier(dps: number, base: string) {
  const thresholds = /crossbow/.test(base) ? [500, 350, 240, 150] : /bow/.test(base) ? [400, 280, 190, 120] : [550, 400, 275, 170];
  if (dps >= thresholds[0]) return { score: 32, label: 'Elite' };
  if (dps >= thresholds[1]) return { score: 26, label: 'Excellent' };
  if (dps >= thresholds[2]) return { score: 19, label: 'Strong' };
  if (dps >= thresholds[3]) return { score: 12, label: 'Usable' };
  return { score: dps > 0 ? 5 : 0, label: 'Low' };
}

function average(min?: number, max?: number) { return min === undefined || max === undefined ? 0 : (min + max) / 2; }
function compactReasons(values: Array<string | false>) { return values.filter((value): value is string => Boolean(value)).slice(0, 4); }
function gradeFor(score: number): ItemEvaluation['grade'] { return score >= 88 ? 'elite' : score >= 74 ? 'excellent' : score >= 55 ? 'good' : score >= 34 ? 'basic' : 'poor'; }
function labelFor(grade: ItemEvaluation['grade']) { return grade === 'elite' ? 'Elite endgame item' : grade === 'excellent' ? 'Excellent endgame item' : grade === 'good' ? 'Good, build-usable item' : grade === 'basic' ? 'Usable but replaceable' : 'Low-value / early upgrade'; }
function articleFor(grade: ItemEvaluation['grade']) { return grade === 'elite' ? 'an elite' : grade === 'excellent' ? 'an excellent' : grade === 'good' ? 'a good' : grade === 'basic' ? 'a usable but replaceable' : 'a weak'; }

function scoreArchetype(item: ItemStats, archetype: Archetype, isBoots: boolean): BuildFit {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];
  for (const [key, weight, label] of archetype.desired) {
    if (key === 'movementSpeed' && !isBoots) continue;
    possible += weight;
    const value = item[key];
    if (typeof value !== 'number' || value <= 0) continue;
    const ratio = statRatio(key, value);
    earned += weight * ratio;
    if (ratio >= 0.55) reasons.push(label);
  }
  const custom = item.customMods.join(' ');
  if (archetype.custom?.test(custom)) { earned += 12; possible += 12; reasons.push('matching specialised modifier'); }
  const conflicts = archetype.conflict?.(item) || [];
  earned -= conflicts.length * 8;
  const score = Math.max(0, Math.min(100, Math.round((earned / Math.max(1, possible)) * 100)));
  return { name: archetype.name, score, fit: score >= 68 ? 'strong' : score >= 42 ? 'possible' : 'weak', reasons: unique(reasons).slice(0, 4), conflicts };
}

function statRatio(key: keyof ItemStats, value: number) {
  const targets: Partial<Record<keyof ItemStats, number>> = { life: 85, armour: 450, evasion: 450, energyShield: 180, movementSpeed: 30, fireResistance: 35, coldResistance: 35, lightningResistance: 35, chaosResistance: 25, strength: 40, dexterity: 40, intelligence: 40, mana: 80, spirit: 30, rarityFind: 25 };
  return Math.min(1, value / (targets[key] || Math.max(1, value)));
}

function verdictFor(item: ItemStats, grade: ItemEvaluation['grade'], best: BuildFit, isBoots: boolean, totalRes: number) {
  const quality = grade === 'elite' ? 'an elite' : grade === 'excellent' ? 'an excellent' : grade === 'good' ? 'a good' : grade === 'basic' ? 'a usable but replaceable' : 'a weak';
  const slot = isBoots ? 'pair of boots' : item.itemType || item.baseType || 'item';
  const build = best.score >= 42 ? ` It fits ${best.name.toLowerCase()} best.` : ' It lacks a clear build identity.';
  const bootsNote = isBoots && (item.movementSpeed || 0) < 30 ? ' Premium endgame boots usually want 30–35% movement speed.' : '';
  const resNote = totalRes < 45 && item.rarity === 'rare' ? ' Resistance coverage also limits demand.' : '';
  return `This is ${quality} ${slot.toLowerCase()}.${build}${bootsNote}${resNote}`;
}

const sum = (...values: Array<number | undefined>) => values.reduce<number>((total, value) => total + (value || 0), 0);
const unique = (values: string[]) => [...new Set(values)];

export const priorityLabels: Record<BuildStat, string> = {
  life: 'maximum life', mana: 'maximum mana', energyShield: 'Energy Shield', armour: 'armour', evasion: 'evasion',
  movementSpeed: 'movement speed', fireResistance: 'fire resistance', coldResistance: 'cold resistance',
  lightningResistance: 'lightning resistance', chaosResistance: 'chaos resistance', strength: 'strength', dexterity: 'dexterity',
  intelligence: 'intelligence', spirit: 'Spirit', rarityFind: 'item rarity', attacksPerSecond: 'attack speed',
  criticalHitChance: 'critical chance', physicalDps: 'physical DPS', elementalDps: 'elemental DPS',
};

const buildTargets: Record<BuildStat, number> = {
  life: 85, mana: 80, energyShield: 180, armour: 450, evasion: 450, movementSpeed: 30, fireResistance: 35,
  coldResistance: 35, lightningResistance: 35, chaosResistance: 25, strength: 40, dexterity: 40, intelligence: 40,
  spirit: 30, rarityFind: 25, attacksPerSecond: 1.6, criticalHitChance: 8, physicalDps: 350, elementalDps: 280,
};

function withPersonalized(evaluation: ItemEvaluation, item: ItemStats, profile?: BuildFitProfile | null): ItemEvaluation {
  return profile ? { ...evaluation, personalized: evaluateForBuild(item, profile) } : evaluation;
}

export function evaluateForBuild(item: ItemStats, profile: BuildFitProfile): PersonalizedBuildFit {
  const slot = itemSlot(item);
  const priorities = profile.priorities.filter((priority) => priorityApplies(priority, slot));
  const text = `${item.customMods.join('\n')}\n${item.rawText || ''}`.toLowerCase();
  const stageScale = profile.stage === 'campaign' ? 0.55 : profile.stage === 'early-maps' ? 0.78 : 1;
  let earned = 0;
  let possible = 0;
  let missingRequired = false;
  const missingRequiredStats: string[] = [];
  const matched: string[] = [];
  const missing: string[] = [];

  for (const priority of priorities) {
    const baseWeight = priority.level === 'required' ? 5 : priority.level === 'high' ? 3 : 1.5;
    const weight = baseWeight * racerWeight(profile.evaluationStyle || 'balanced', priority.stat, priority.level);
    const value = buildStatValue(item, priority.stat);
    const target = priority.minimum || buildTargets[priority.stat] * stageScale;
    const ratio = Math.min(1, value / Math.max(1, target));
    earned += weight * ratio;
    possible += weight;
    const label = priorityLabels[priority.stat];
    if (ratio >= 0.65) matched.push(`${label}${value ? ` (${formatBuildValue(priority.stat, value)})` : ''}`);
    else if (priority.level !== 'useful') {
      missing.push(`${priority.minimum ? `${formatBuildValue(priority.stat, priority.minimum)} ` : ''}${label}`);
      if (priority.level === 'required') { missingRequired = true; missingRequiredStats.push(label); }
    }
  }

  for (const rawPhrase of profile.requiredMods.filter(Boolean)) {
    const { phrase, applies } = scopedModifier(rawPhrase, slot);
    if (!applies) continue;
    possible += 5;
    if (text.includes(phrase.toLowerCase())) { earned += 5; matched.push(phrase); }
    else { missing.push(phrase); missingRequired = true; }
  }
  for (const rawPhrase of profile.desiredMods.filter(Boolean)) {
    const { phrase, applies } = scopedModifier(rawPhrase, slot);
    if (!applies) continue;
    possible += 2;
    if (text.includes(phrase.toLowerCase())) { earned += 2; matched.push(phrase); }
  }

  const conflicts: string[] = [];
  if (profile.defenceStyle === 'energy-shield' && (item.life || 0) > 0 && !(item.energyShield || 0)) conflicts.push('Life roll without Energy Shield does not support the selected defence');
  if (profile.defenceStyle === 'life-armour' && (item.energyShield || 0) > 0 && !(item.life || 0) && !(item.armour || 0)) conflicts.push('Energy Shield-only defence does not support the selected life/armour setup');
  if (profile.defenceStyle === 'life-evasion' && (item.armour || 0) > 0 && !(item.life || 0) && !(item.evasion || 0)) conflicts.push('Armour-only defence does not support the selected life/evasion setup');
  if ((profile.evaluationStyle || 'balanced') === 'hardcore-gauntlet' && missingRequiredStats.length) conflicts.push(`Hardcore safety gate failed: missing required ${missingRequiredStats.join(', ')}`);
  earned -= conflicts.length * 1.5;

  let score = Math.max(0, Math.min(100, Math.round((earned / Math.max(1, possible)) * 100)));
  if ((profile.evaluationStyle || 'balanced') === 'hardcore-gauntlet' && missingRequired) score = Math.min(score, 34);
  const fit = score >= 85 && !missingRequired ? 'excellent' : score >= 65 ? 'strong' : score >= 35 ? 'partial' : 'poor';
  const identity = `${profile.name}${profile.mainSkill ? ` (${profile.mainSkill})` : ''}`;
  const verdict = fit === 'excellent' ? `Excellent fit for ${identity}; it hits nearly all of the priorities relevant to this slot.`
    : fit === 'strong' ? `Strong fit for ${identity}, with a few priority upgrades still available.`
      : fit === 'partial' ? `Partly useful for ${identity}, but important build priorities are missing.`
        : `Poor fit for ${identity}; this slot does not provide enough of the stats your build asks for.`;
  return { buildName: profile.name, className: [profile.className, profile.ascendancy].filter(Boolean).join(' · '), score, fit, verdict, matched: unique(matched).slice(0, 6), missing: unique(missing).slice(0, 6), conflicts };
}

function priorityApplies(priority: BuildPriority, slot: string) {
  const isWeapon = ['bow','crossbow','one-handed-melee','two-handed-melee','staff','quarterstaff','wand','sceptre'].includes(slot);
  if (priority.stat === 'movementSpeed') return slot === 'boots';
  if (['physicalDps', 'elementalDps', 'attacksPerSecond', 'criticalHitChance'].includes(priority.stat)) return isWeapon;
  if (['energyShield', 'armour', 'evasion'].includes(priority.stat)) return ['boots', 'helmet', 'gloves', 'body-armour','shield','focus'].includes(slot);
  if (priority.stat === 'spirit') return ['amulet', 'body-armour', 'sceptre','staff','wand','focus'].includes(slot);
  if (isWeapon && ['life', 'mana', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance', 'rarityFind'].includes(priority.stat)) return false;
  return true;
}

function itemSlot(item: ItemStats) {
  return detectItemCategory(item).key;
}

function scopedModifier(raw: string, slot: string) {
  const match = raw.match(/^\s*(?:\[([^\]]+)\]|(weapon|boots?|helmet|gloves?|body(?: armour)?|amulet|rings?|belt|jewell?ery))\s*:\s*(.+)$/i)
    || raw.match(/^\s*\[([^\]]+)\]\s*(.+)$/i);
  if (!match) return { phrase: raw.trim(), applies: true };
  const scope = (match[1] || match[2] || '').toLowerCase();
  const phrase = (match[3] || match[2] || '').trim();
  const weapons=['bow','crossbow','one-handed-melee','two-handed-melee','staff','quarterstaff','wand','sceptre'];
  const aliases: Record<string, string[]> = { weapon:weapons,boot: ['boots'], boots: ['boots'], glove: ['gloves'], gloves: ['gloves'], ring: ['ring'], rings: ['ring'], body: ['body-armour'], 'body armour': ['body-armour'], shield:['shield'],focus:['focus'],quiver:['quiver'], jewelry: ['ring', 'amulet', 'belt'], jewellery: ['ring', 'amulet', 'belt'] };
  return { phrase, applies: (aliases[scope] || [scope]).includes(slot) };
}

function buildStatValue(item: ItemStats, stat: BuildStat) {
  if (stat === 'physicalDps') return average(item.physicalDamageMin, item.physicalDamageMax) * (item.attacksPerSecond || 1);
  if (stat === 'elementalDps') return (average(item.fireDamageMin, item.fireDamageMax) + average(item.coldDamageMin, item.coldDamageMax) + average(item.lightningDamageMin, item.lightningDamageMax) + average(item.chaosDamageMin, item.chaosDamageMax)) * (item.attacksPerSecond || 1);
  return Number(item[stat as keyof ItemStats]) || 0;
}

function formatBuildValue(stat: BuildStat, value: number) {
  if (['movementSpeed', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance', 'rarityFind', 'criticalHitChance'].includes(stat)) return `${Math.round(value)}%`;
  return `${Math.round(value)}`;
}

function racerWeight(style: BuildFitProfile['evaluationStyle'], stat: BuildStat, level: BuildPriority['level']) {
  if (level === 'required') return 1;
  const offence = ['physicalDps', 'elementalDps', 'attacksPerSecond', 'criticalHitChance'].includes(stat);
  const defence = ['life', 'energyShield', 'armour', 'evasion', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance'].includes(stat);
  if (style === 'campaign-race') return stat === 'movementSpeed' ? 1.65 : offence ? 1.3 : defence ? 0.9 : 1;
  if (style === 'hardcore-gauntlet') return defence ? 1.45 : stat === 'rarityFind' ? 0.45 : offence ? 0.8 : 1;
  return 1;
}
