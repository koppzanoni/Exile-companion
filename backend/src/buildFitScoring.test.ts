import { describe, expect, it } from 'vitest';
import { statStrength } from './buildFitScoring.js';
import type { ScoringContext } from './buildScoringContext.js';
import type { ItemStats } from './types.js';

const item = (overrides: Partial<ItemStats> = {}): ItemStats => ({
  itemType: 'Test',
  baseType: 'Test',
  rarity: 'rare',
  customMods: [],
  ...overrides,
});

const NEUTRAL: ScoringContext = { critical: false, damageTags: [], current: {} };
const CRITICAL: ScoringContext = { critical: true, damageTags: [], current: {} };

describe('buildFitScoring shared targets', () => {
  it('scores life against a level-scaled target instead of a flat constant', () => {
    const atLevel80 = statStrength('life', item({ life: 60 }), '', 'other', NEUTRAL);
    expect(atLevel80).toBeCloseTo(0.6, 5);
    const atLevel20 = statStrength('life', item({ life: 60, itemLevel: 20 }), '', 'other', NEUTRAL);
    expect(atLevel20).toBe(1);
  });

  it('scores armour against a slot-aware target (body-armour needs more than a generic slot)', () => {
    const bodyArmour = statStrength('armour', item({ armour: 600 }), '', 'body-armour', NEUTRAL);
    const shield = statStrength('armour', item({ armour: 600 }), '', 'shield', NEUTRAL);
    expect(bodyArmour).toBeCloseTo(0.5, 5);
    expect(shield).toBeGreaterThan(bodyArmour);
  });

  it('uses the shared generic attribute target', () => {
    expect(statStrength('strength', item({ strength: 20 }), '', 'other', NEUTRAL)).toBeCloseTo(0.5, 5);
    expect(statStrength('spirit', item({ spirit: 20 }), '', 'other', NEUTRAL)).toBeCloseTo(0.5, 5);
  });

  it('scores physical damage against a level-scaled DPS target', () => {
    const result = statStrength(
      'physical damage',
      item({ physicalDamageMin: 90, physicalDamageMax: 90, attacksPerSecond: 1, itemLevel: 50 }),
      '',
      'other',
      NEUTRAL,
    );
    expect(result).toBeCloseTo(0.5, 5);
  });

  it('only credits critical-stat value when the selected build is critical', () => {
    const critItem = item({ criticalDamageBonus: 15 });
    expect(statStrength('critical', critItem, '', 'other', CRITICAL)).toBeCloseTo(0.5, 5);
    expect(statStrength('critical', critItem, '', 'other', NEUTRAL)).toBe(0);
  });

  it("scores a resistance roll relative to the build's cap and the character's current total", () => {
    const roll = item({ fireResistance: 20 });
    const freshCharacter: ScoringContext = {
      ...NEUTRAL,
      current: { fireResistance: 0 },
    };
    const alreadyCappedCharacter: ScoringContext = {
      ...NEUTRAL,
      current: { fireResistance: 75 },
    };
    const fresh = statStrength('resistance', roll, '', 'other', freshCharacter);
    const alreadyCapped = statStrength('resistance', roll, '', 'other', alreadyCappedCharacter);
    expect(fresh).toBeGreaterThan(alreadyCapped);
  });

  it('respects an explicit build resistance cap instead of always defaulting to 75', () => {
    const roll = item({ fireResistance: 20 });
    const lowCapCharacter: ScoringContext = {
      ...NEUTRAL,
      current: { fireResistance: 0 },
      caps: { fireResistance: 20 },
    };
    const highCapCharacter: ScoringContext = {
      ...NEUTRAL,
      current: { fireResistance: 0 },
      caps: { fireResistance: 75 },
    };
    const lowCap = statStrength('resistance', roll, '', 'other', lowCapCharacter);
    const highCap = statStrength('resistance', roll, '', 'other', highCapCharacter);
    expect(lowCap).toBeGreaterThan(highCap);
  });
});
