import { describe, expect, it } from 'vitest';
import { buildCurrencyAdvice } from './currencyAdvice.js';
import type { CraftingFacts } from './craftingRules.js';
import type { ItemStats } from './types.js';

const item = (overrides: Partial<ItemStats> = {}): ItemStats => ({
  itemType: 'Body Armour',
  baseType: 'Expert Body Armour',
  rarity: 'rare',
  customMods: [],
  quality: 0,
  ...overrides,
});

const facts = (overrides: Partial<CraftingFacts> = {}): CraftingFacts => ({
  category: 'body-armour',
  categoryScore: 60,
  buildFitScore: 60,
  bestUseCase: 'endgame',
  missing: [],
  wasted: [],
  strongRolls: [],
  weakRolls: [],
  lowNumericRolls: [],
  modCount: 3,
  baseQuality: { score: 62, label: 'Strong Base', reasons: [] },
  rollQuality: { score: 60, label: 'Mixed Rolls', strongRolls: [], weakRolls: [], missingRolls: [] },
  ...overrides,
});

const settings = {
  craftingRiskTolerance: 'Medium' as const,
  showCurrencyWarnings: true,
  conservativeCraftingRecommendations: true,
};

describe('buildCurrencyAdvice', () => {
  it('never suggests a quality improvement on a corrupted item', () => {
    const advice = buildCurrencyAdvice(item({ corrupted: true, quality: 0 }), facts(), 40, settings, false);
    expect(advice.suggestedCurrencyUse.join(' ')).not.toMatch(/quality improvement/i);
    expect(advice.suggestedCurrencyUse.join(' ')).toMatch(/do not spend meaningful currency/i);
  });

  it('suggests a quality improvement on a non-corrupted low-quality strong base', () => {
    const advice = buildCurrencyAdvice(item({ corrupted: false, quality: 0 }), facts(), 60, settings, false);
    expect(advice.suggestedCurrencyUse.join(' ')).toMatch(/quality improvement/i);
  });

  it('suggests a Chaos Orb for a full-affix rare item with exactly one wasted roll', () => {
    const advice = buildCurrencyAdvice(
      item(),
      facts({ modCount: 6, wasted: ['Rarity of Items Found'] }),
      60,
      settings,
      false,
    );
    expect(advice.suggestedCurrencyUse.join(' ')).toMatch(/chaos orb/i);
  });

  it('warns against a Chaos Orb when more than one affix is wasted', () => {
    const advice = buildCurrencyAdvice(
      item(),
      facts({ modCount: 6, wasted: ['Rarity of Items Found', 'Mana'] }),
      60,
      settings,
      false,
    );
    expect(advice.suggestedCurrencyUse.join(' ')).not.toMatch(/chaos orb/i);
    expect(advice.currencyWarnings.join(' ')).toMatch(/do not use a chaos orb/i);
  });

  it('suggests an Orb of Alchemy for a normal item with a solid base', () => {
    const advice = buildCurrencyAdvice(
      item({ rarity: 'normal', corrupted: false }),
      facts({ baseQuality: { score: 60, label: 'Strong Base', reasons: [] } }),
      40,
      settings,
      false,
    );
    expect(advice.suggestedCurrencyUse.join(' ')).toMatch(/orb of alchemy/i);
  });

  it('never suggests a Vaal Orb automatically, even on a strong item', () => {
    const advice = buildCurrencyAdvice(item(), facts({ modCount: 6, wasted: [] }), 90, settings, false);
    expect(advice.suggestedCurrencyUse.join(' ')).not.toMatch(/vaal orb/i);
  });
});
