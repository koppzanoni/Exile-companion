import { describe, expect, it } from 'vitest';
import { convertCurrency, describeMainDifference, scoreSimilarity } from './pricing.js';
import type { ItemStats, Listing } from './types.js';

const target: ItemStats = { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', armour: 250, life: 75, fireResistance: 30, coldResistance: 28, movementSpeed: 25, customMods: [] };
const listing = (id: string, price: number, movementSpeed = 25, account = `seller-${id}`): Listing => ({ id, name: `Rare ${id}`, baseType: 'Stone Greaves', rarity: 'rare', price, currency: 'exalted', exaltedPrice: price, account, source: 'manual', stats: { armour: 245, life: 70, fireResistance: 28, coldResistance: 25, movementSpeed } });

describe('pricing', () => {
  it('weights movement speed heavily for boots', () => {
    expect(scoreSimilarity(target, listing('fast', 20, 25))).toBeGreaterThan(scoreSimilarity(target, listing('slow', 20, 0)) + 10);
  });

  it('converts Exalted to Divine using the manual rate', () => {
    expect(convertCurrency(130, 65)).toBe(2);
    expect(() => convertCurrency(10, 0)).toThrow();
  });

  it('rejects weapon comparables whose damage properties are missing', () => {
    const weapon: ItemStats = { itemType: 'Weapon', baseType: 'Siege Crossbow', rarity: 'rare', physicalDamageMin: 132, physicalDamageMax: 377, attacksPerSecond: 1.65, criticalHitChance: 5, customMods: [] };
    const incomplete: Listing = { id: 'legacy-cache', name: 'Old Cache', baseType: 'Siege Crossbow', rarity: 'rare', price: 10, currency: 'exalted', exaltedPrice: 10, source: 'cache', stats: { coldDamageMin: 30, coldDamageMax: 50, attacksPerSecond: 1.7 } };
    const complete: Listing = { ...incomplete, id: 'complete', stats: { physicalDamageMin: 125, physicalDamageMax: 360, attacksPerSecond: 1.6, criticalHitChance: 5 } };
    expect(scoreSimilarity(weapon, incomplete)).toBeLessThan(20);
    expect(scoreSimilarity(weapon, complete)).toBeGreaterThan(50);
  });

  it('describes the single most impactful stat difference for a comparable', () => {
    const strongerLife = listing('a', 20, 25); strongerLife.stats.life = 130;
    expect(describeMainDifference(target, strongerLife)).toMatch(/\+55 ?Life/i);
    const identical = listing('b', 20, 25); identical.stats = { ...target };
    expect(describeMainDifference(target, identical)).toMatch(/No notable stat difference/i);
  });
});
