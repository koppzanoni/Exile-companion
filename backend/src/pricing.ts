import type { ItemStats, Listing } from './types.js';

const numericKeys: Array<[keyof ItemStats, number]> = [
  ['energyShield', 1.25], ['armour', 0.65], ['evasion', 0.65], ['deflection', 0.65], ['runicWard', 0.9], ['life', 1.4], ['mana', 0.35],
  ['fireResistance', 0.75], ['coldResistance', 0.75], ['lightningResistance', 0.75], ['chaosResistance', 1.05],
  ['intelligence', 0.45], ['strength', 0.4], ['dexterity', 0.4], ['rarityFind', 0.75], ['spirit', 1.3], ['stunThreshold', 0.25],
  ['physicalDamageMin', 1.1], ['physicalDamageMax', 1.1], ['fireDamageMin', 0.65], ['fireDamageMax', 0.65],
  ['coldDamageMin', 0.65], ['coldDamageMax', 0.65], ['lightningDamageMin', 0.65], ['lightningDamageMax', 0.65],
  ['chaosDamageMin', 0.65], ['chaosDamageMax', 0.65], ['attacksPerSecond', 1.2], ['criticalHitChance', 0.9],
];

export function scoreSimilarity(target: ItemStats, listing: Listing): number {
  let score = 0;
  let max = 0;
  const exactBase = normalize(target.baseType) === normalize(listing.baseType);
  max += 35;
  score += exactBase ? 35 : normalize(listing.baseType).includes(normalize(target.baseType)) || normalize(target.baseType).includes(normalize(listing.baseType)) ? 18 : 0;

  max += 12;
  const rarityUnknown = listing.rarity === 'unknown';
  score += target.rarity === listing.rarity ? 12 : rarityUnknown ? 5 : 0;
  if (target.rarity === 'rare' && !rarityUnknown && listing.rarity !== 'rare') return 0;

  const weaponTarget = target.itemType.toLowerCase() === 'weapon';
  if (weaponTarget && !hasComparableWeaponDamage(target, listing.stats)) return exactBase ? 15 : 0;

  for (const [key, weight] of numericKeys) {
    const targetValue = target[key];
    if (typeof targetValue !== 'number') continue;
    max += weight * 5;
    const listed = listing.stats[key];
    if (typeof listed === 'number') score += weight * 5 * closeness(targetValue, listed);
  }

  const boots = /boots/i.test(target.itemType) || /boots|greaves|shoes|slippers|treads|sabaton/i.test(target.baseType);
  if (boots) {
    max += 28;
    const a = target.movementSpeed || 0;
    const b = Number(listing.stats.movementSpeed || 0);
    score += a === 0 && b === 0 ? 16 : 28 * closeness(a, b, 10);
  } else if (typeof target.movementSpeed === 'number') {
    max += 8;
    score += 8 * closeness(target.movementSpeed, Number(listing.stats.movementSpeed || 0), 10);
  }

  if (typeof target.itemLevel === 'number' && typeof listing.stats.itemLevel === 'number') {
    max += 5; score += 5 * closeness(target.itemLevel, listing.stats.itemLevel, 10);
  }
  if (target.customMods.length && Array.isArray(listing.stats.customMods) && listing.stats.customMods.length) {
    for (const mod of target.customMods) {
      const useful = /life|mana|resistance|spirit|movement|damage|attack|cast|critical|skill|rarity/i.test(mod);
      const weight = useful ? 1.5 : 0.35;
      max += weight;
      if (listing.stats.customMods.some((other) => modSignature(other) === modSignature(mod))) score += weight;
    }
  }
  return max ? Math.round((score / max) * 100) : 0;
}

const normalize = (value?: string) => String(value || '').trim().toLowerCase();
function hasComparableWeaponDamage(target: Partial<ItemStats>, candidate: Partial<ItemStats>) {
  const targetPhysical = typeof target.physicalDamageMin === 'number' || typeof target.physicalDamageMax === 'number';
  const candidatePhysical = typeof candidate.physicalDamageMin === 'number' || typeof candidate.physicalDamageMax === 'number';
  const elementalKeys: Array<keyof ItemStats> = ['fireDamageMin', 'fireDamageMax', 'coldDamageMin', 'coldDamageMax', 'lightningDamageMin', 'lightningDamageMax', 'chaosDamageMin', 'chaosDamageMax'];
  const targetElemental = elementalKeys.some((key) => typeof target[key] === 'number');
  const candidateElemental = elementalKeys.some((key) => typeof candidate[key] === 'number');
  return (!targetPhysical || candidatePhysical) && (!targetElemental || candidateElemental);
}
const modSignature = (value: string) => normalize(value).replace(/[+-]?\d+(?:\.\d+)?%?/g, '#');
function closeness(a: number, b: number, floor = 5) {
  return Math.max(0, 1 - Math.abs(a - b) / Math.max(Math.abs(a), floor));
}

export function explainItemSignals(item: ItemStats) {
  const positive: string[] = [];
  const negative: string[] = [];
  const weapon = item.itemType.toLowerCase() === 'weapon';
  if (weapon) {
    const dps = weaponDps(item);
    const mods = item.customMods.join(' ');
    if (dps > 0) positive.push(`Weapon DPS (~${Math.round(dps)})`);
    if (/increased Physical Damage/i.test(mods)) positive.push('Local physical damage scaling');
    if (/increased Attack Speed/i.test(mods)) positive.push('Attack speed');
    if (/Critical Hit Chance|Critical Strike|Critical Damage/i.test(mods)) positive.push('Critical scaling');
    if (/additional (?:Projectile|Arrow)|grenade skills?/i.test(mods)) positive.push('Extra projectile utility');
    const defensive = item.customMods.filter((line) => /to maximum Life|to .*Resistance|increased Energy Shield|increased Armour|increased Evasion/i.test(line) && !/Leech/i.test(line));
    if (defensive.length) negative.push('Defensive affixes consume valuable weapon mod slots');
    if (!positive.length) positive.push('Exact weapon base/type match drives most of the comparison');
    return { positive, negative };
  }
  const boots = /boots/i.test(item.itemType) || /boots|greaves|shoes/i.test(item.baseType);
  if ((item.energyShield || 0) >= 100) positive.push(`Strong energy shield (${item.energyShield})`);
  if ((item.armour || 0) >= 200) positive.push(`Strong armour (${item.armour})`);
  if ((item.evasion || 0) >= 200) positive.push(`Strong evasion (${item.evasion})`);
  if ((item.life || 0) >= 60) positive.push(`High life (+${item.life})`); else if (item.rarity === 'rare' && !item.life) negative.push('No maximum life roll');
  const totalRes = (item.fireResistance || 0) + (item.coldResistance || 0) + (item.lightningResistance || 0) + (item.chaosResistance || 0);
  if (totalRes >= 70) positive.push(`Strong combined resistances (+${totalRes}%)`); else if (item.rarity === 'rare' && totalRes < 30) negative.push('Low combined resistances');
  if (boots && (item.movementSpeed || 0) >= 25) positive.push(`Valuable movement speed (${item.movementSpeed}%)`);
  if (boots && !item.movementSpeed) negative.unshift('Missing movement speed is a major drawback on boots');
  else if (boots && (item.movementSpeed || 0) < 20) negative.push('Low movement speed for boots');
  if ((item.spirit || 0) > 0) positive.push(`Spirit (+${item.spirit})`);
  if ((item.rarityFind || 0) >= 20) positive.push(`Item rarity (${item.rarityFind}%)`);
  if (!positive.length) positive.push('Exact base/type match drives most of the comparison');
  return { positive, negative };
}

function weaponDps(item: ItemStats) {
  const average = (min?: number, max?: number) => min === undefined || max === undefined ? 0 : (min + max) / 2;
  return (average(item.physicalDamageMin, item.physicalDamageMax) + average(item.fireDamageMin, item.fireDamageMax) + average(item.coldDamageMin, item.coldDamageMax) + average(item.lightningDamageMin, item.lightningDamageMax) + average(item.chaosDamageMin, item.chaosDamageMax)) * (item.attacksPerSecond || 1);
}

export function describeMainDifference(target: ItemStats, listing: Listing): string {
  let bestKey: keyof ItemStats | null = null;
  let bestWeightedDelta = 0;
  let bestDelta = 0;
  for (const [key, weight] of numericKeys) {
    const targetValue = target[key];
    const listedValue = listing.stats[key];
    if (typeof targetValue !== 'number' && typeof listedValue !== 'number') continue;
    const delta = (Number(listedValue) || 0) - (Number(targetValue) || 0);
    const weighted = Math.abs(delta) * weight;
    if (weighted > bestWeightedDelta) { bestWeightedDelta = weighted; bestDelta = delta; bestKey = key; }
  }
  if (!bestKey || Math.abs(bestDelta) < 0.5) return 'No notable stat difference';
  const label = String(bestKey).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
  const sign = bestDelta > 0 ? '+' : '';
  return `${sign}${Math.round(bestDelta * 10) / 10} ${label}`;
}

export function convertCurrency(exalted: number, divineRate: number) {
  if (!Number.isFinite(divineRate) || divineRate <= 0) throw new Error('Divine conversion rate must be greater than zero.');
  return Math.round((exalted / divineRate) * 100) / 100;
}
