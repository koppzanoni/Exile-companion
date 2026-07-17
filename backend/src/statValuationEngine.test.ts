import { describe, expect, it } from 'vitest';
import { valueItemStats } from './statValuationEngine.js';
import type { ItemStats } from './types.js';
const item = (values: Partial<ItemStats>) =>
  ({
    itemType: 'Ring',
    baseType: 'Ring',
    rarity: 'rare',
    customMods: [],
    ...values,
  }) as ItemStats;
describe('StatValuationEngine', () => {
  it('values resistance only until the cap', () => {
    const result = valueItemStats(item({ fireResistance: 40 }), {
      slot: 'ring',
      critical: false,
      damageTags: [],
      current: { fireResistance: 70 },
    });
    expect(result.contributions[0]).toMatchObject({ wasted: true });
    expect(result.contributions[0].reason).toMatch(/5% helps.*35%.*over cap/i);
  });
  it('treats Spirit as a hard breakpoint', () => {
    const result = valueItemStats(item({ spirit: 20 }), {
      slot: 'amulet',
      critical: false,
      damageTags: [],
      current: { spirit: 90 },
      requirements: { spirit: 100 },
    });
    expect(result.contributions[0].score).toBe(100);
    expect(result.contributions[0].reason).toMatch(/Reaches/);
  });
  it('rejects critical stats for non-critical builds', () => {
    const result = valueItemStats(item({ customMods: ['40% increased Critical Damage'] }), {
      slot: 'ring',
      critical: false,
      damageTags: [],
      current: {},
    });
    expect(result.contributions[0]).toMatchObject({ score: 0, wasted: true });
  });
  it('scores Deflection and Runic Ward as local defensive stats instead of leaving them at zero', () => {
    const result = valueItemStats(item({ deflection: 200, runicWard: 120, itemType: 'Focus' }), {
      slot: 'focus',
      critical: false,
      damageTags: [],
      current: {},
    });
    const deflection = result.contributions.find((c) => c.stat === 'Deflection');
    const runicWard = result.contributions.find((c) => c.stat === 'Runic Ward');
    expect(deflection).toMatchObject({ local: true, category: 'defence' });
    expect(deflection!.score).toBeGreaterThan(0);
    expect(runicWard).toMatchObject({ local: true, category: 'defence' });
    expect(runicWard!.score).toBeGreaterThan(0);
  });
  it('scores life against a level-scaled target instead of a flat constant', () => {
    const lowLevel = valueItemStats(item({ life: 60, itemLevel: 20 }), {
      slot: 'ring',
      critical: false,
      damageTags: [],
      current: {},
    });
    const highLevel = valueItemStats(item({ life: 60, itemLevel: 90 }), {
      slot: 'ring',
      critical: false,
      damageTags: [],
      current: {},
    });
    const lifeAt = (result: ReturnType<typeof valueItemStats>) =>
      result.contributions.find((c) => c.stat === 'Maximum Life')!.score;
    expect(lifeAt(lowLevel)).toBeGreaterThan(lifeAt(highLevel));
  });
  it('scores local defences against a slot-aware target instead of one flat constant for every slot', () => {
    const bodyArmour = valueItemStats(item({ armour: 800, itemType: 'Body Armour' }), {
      slot: 'body-armour',
      critical: false,
      damageTags: [],
      current: {},
    });
    const belt = valueItemStats(item({ armour: 800, itemType: 'Belt' }), {
      slot: 'belt',
      critical: false,
      damageTags: [],
      current: {},
    });
    const armourScore = (result: ReturnType<typeof valueItemStats>) =>
      result.contributions.find((c) => c.stat === 'Armour')!.score;
    expect(armourScore(belt)).toBeGreaterThan(armourScore(bodyArmour));
  });
  it('scores physical DPS against a level-scaled target instead of a flat constant', () => {
    const stats = { physicalDamageMin: 90, physicalDamageMax: 90, attacksPerSecond: 1 };
    const lowLevel = valueItemStats(item({ ...stats, itemLevel: 20 }), {
      slot: 'one-handed-melee',
      critical: false,
      damageTags: ['physical'],
      current: {},
    });
    const highLevel = valueItemStats(item({ ...stats, itemLevel: 95 }), {
      slot: 'one-handed-melee',
      critical: false,
      damageTags: ['physical'],
      current: {},
    });
    const dpsAt = (result: ReturnType<typeof valueItemStats>) =>
      result.contributions.find((c) => c.stat === 'Physical DPS')!.score;
    expect(dpsAt(lowLevel)).toBeGreaterThan(dpsAt(highLevel));
  });
  it('uses build and slot priorities in the final score', () => {
    const candidate = item({ life: 10, fireResistance: 35 });
    const base = {
      slot: 'ring' as const,
      critical: false,
      damageTags: [],
      current: { fireResistance: 40 },
    };
    const lifePriority = valueItemStats(candidate, {
      ...base,
      buildWeight: { 'Maximum Life': 3 },
    });
    const resistancePriority = valueItemStats(candidate, {
      ...base,
      buildWeight: { fireResistance: 3 },
      slotWeight: { fireResistance: 2 },
    });
    expect(resistancePriority.overallScore).toBeGreaterThan(lifePriority.overallScore);
  });
});
