import type { ItemCategory, ItemStats } from './types.js';

export function resolveItemLevel(item: ItemStats): number {
  const level = item.requiredLevel || item.itemLevel || 80;
  return Math.max(10, Math.min(100, level));
}

export function lifeTarget(level: number): number {
  return Math.min(100, 25 + level);
}

export function defensiveTarget(stat: 'armour' | 'evasion', slot: ItemCategory): number {
  return slot === 'body-armour' ? 1200 : slot === 'shield' ? 700 : 400;
}

export function energyShieldTarget(slot: ItemCategory): number {
  return slot === 'body-armour' ? 500 : 220;
}

export function deflectionTarget(slot: ItemCategory): number {
  return slot === 'body-armour' ? 500 : 220;
}

export function runicWardTarget(slot: ItemCategory): number {
  return slot === 'focus' ? 300 : 150;
}

export const RESISTANCE_CAP_DEFAULT = 75;
export const RESISTANCE_STEP = 35;

export const ATTRIBUTE_TARGET = 40;

export function weaponDamageTarget(level: number): number {
  return Math.max(55, level * 5);
}

export function physicalDpsTarget(level: number): number {
  return Math.max(40, level * 3.6);
}

export function elementalDpsTarget(level: number): number {
  return Math.max(25, level * 1.8);
}

export function flatAddedDamageTarget(level: number): number {
  return level * 2.4;
}

export const CRITICAL_DAMAGE_TARGET = 30;

export const BLOCK_CHANCE_TARGET = 35;

export function criticalValue(item: ItemStats): number {
  const text = (item.customMods || []).join('\n');
  return Number(text.match(/(\d+)% increased Critical/i)?.[1] || item.criticalDamageBonus || 0);
}
