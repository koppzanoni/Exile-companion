import { describe, expect, it } from 'vitest';
import { assessCraftingPotential } from './craftingPotential.js';
import { decideItem } from './itemDecision.js';
import type { Estimate, ItemCategory, ItemEvaluation, ItemStats } from './types.js';

const liveEstimate: Estimate = {
  quickSell: 20,
  fair: 25,
  high: 30,
  divine: { quickSell: 0.3, fair: 0.38, high: 0.46 },
  confidence: 'medium',
  positiveMods: [],
  negativeMods: [],
  explanation: [],
  usedCount: 5,
  excludedCount: 0,
};

describe('automatic item decision', () => {
  it('recommends Use for a strong selected-build fit', () => {
    const result = decideItem(context(item('bow', { itemLevel: 78 }), evaluation('bow', 76, 82, 88)));
    expect(result.action).toBe('Use');
    expect(result.safeToVendor).toBe(false);
  });

  it('recommends Sell for a good live-verified item with poor build fit', () => {
    const result = decideItem(
      context(item('ring'), evaluation('ring', 78, 80, 12), { estimate: liveEstimate, dataSource: 'live' }),
    );
    expect(result.action).toBe('Sell');
  });

  it('recommends Craft for a good rare base with one realistic improvement', () => {
    const value = item('body-armour', { itemLevel: 81, armour: 1000, life: 82, fireResistance: 35 });
    const assessed = evaluation('body-armour', 68, 74, 58, { missing: ['cold resistance'] });
    assessed.buildFitAnalysis!.bestUseCase = 'endgame';
    const result = decideItem(context(value, assessed));
    expect(result.craftingPotential.score).toBeGreaterThanOrEqual(64);
    expect(result.action).toBe('Craft');
  });

  it('recommends Replace Soon for usable Boots without movement speed', () => {
    const result = decideItem(
      context(
        item('boots', { life: 70, fireResistance: 30, coldResistance: 30 }),
        evaluation('boots', 48, 52, 42, { missing: ['movement speed'] }),
      ),
    );
    expect(result.action).toBe('Replace Soon');
    expect(result.shortReason).toMatch(/movement speed/i);
  });

  it('recommends Price Check for hidden value or failed live verification', () => {
    const result = decideItem(
      context(
        item('amulet', { rarity: 'unique', customMods: ['+2 to Level of all Cold Skills'] }),
        evaluation('amulet', 65, 68, 20),
      ),
    );
    expect(result.action).toBe('Price Check');
    expect(result.mayHaveHiddenValue).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/no live official/i);
  });

  it('recommends Vendor only for an unambiguously bad item', () => {
    const result = decideItem(
      context(item('one-handed-melee'), evaluation('one-handed-melee', 8, 10, 4, { marketability: 'low' })),
    );
    expect(result.action).toBe('Vendor');
    expect(result.safeToVendor).toBe(true);
  });

  it('substantially reduces crafting potential for a corrupted item', () => {
    const assessed = evaluation('body-armour', 68, 74, 58, { missing: ['cold resistance'] });
    assessed.buildFitAnalysis!.bestUseCase = 'endgame';
    const clean = assessCraftingPotential(
      item('body-armour', { itemLevel: 82, armour: 1000, life: 82, fireResistance: 35 }),
      assessed,
    );
    const corrupted = assessCraftingPotential(
      item('body-armour', { itemLevel: 82, armour: 1000, life: 82, fireResistance: 35, corrupted: true }),
      assessed,
    );
    expect(clean.score - corrupted.score).toBeGreaterThanOrEqual(40);
  });

  it('never treats Boots without movement speed as a strong Use', () => {
    const result = decideItem(
      context(item('boots', { life: 90 }), evaluation('boots', 70, 72, 90, { missing: ['movement speed'] })),
    );
    expect(result.action).not.toBe('Use');
  });

  it('does not vendor a strong defensive Shield', () => {
    const result = decideItem(
      context(
        item('shield', { blockChance: 35, life: 90, fireResistance: 35, coldResistance: 35 }),
        evaluation('shield', 75, 84, 55),
      ),
    );
    expect(result.action).not.toBe('Vendor');
  });

  it('does not penalize a high-DPS weapon for missing defensive stats', () => {
    const result = decideItem(
      context(
        item('crossbow', {
          physicalDamageMin: 210,
          physicalDamageMax: 430,
          attacksPerSecond: 1.7,
          attackSpeedBonus: 18,
        }),
        evaluation('crossbow', 82, 88, 86),
      ),
    );
    expect(result.action).toBe('Use');
    expect(result.detailedReason.join(' ')).not.toMatch(/defensive/i);
  });
});

function item(category: ItemCategory, extra: Partial<ItemStats> = {}): ItemStats {
  return { itemType: category, itemClass: category, baseType: category, rarity: 'rare', customMods: [], ...extra };
}

function evaluation(
  category: ItemCategory,
  quality: number,
  categoryScore: number,
  fitScore: number,
  options: { missing?: string[]; wasted?: string[]; marketability?: ItemEvaluation['marketability'] } = {},
): ItemEvaluation {
  return {
    score: quality,
    grade: quality >= 74 ? 'excellent' : quality >= 55 ? 'good' : quality >= 34 ? 'basic' : 'poor',
    label: 'Test item',
    verdict: 'Test item',
    marketability: options.marketability || (quality >= 55 ? 'broad' : 'low'),
    strengths: [],
    weaknesses: [],
    buildFits: [],
    upgradePriorities: options.missing || [],
    categoryAnalysis: {
      detectedCategory: { key: category, label: category, priorities: [] },
      detectionReason: 'test',
      categoryScore,
      positiveStats: [],
      weakOrWastedStats: options.wasted || [],
      missingImportantStats: options.missing || [],
      marketRelevantStats: [],
      buildRelevantStats: [],
      tradeSearchPriorities: [],
      confidence: 90,
      warnings:
        category === 'boots' && options.missing?.includes('movement speed')
          ? ['Movement speed is missing; this is a major Boots weakness.']
          : [],
      parsedLines: [],
    },
    buildFitAnalysis: {
      profileId: 'test-build',
      profileName: 'Test Build',
      buildSpecific: true,
      score: fitScore,
      label:
        fitScore >= 85
          ? 'Build-defining'
          : fitScore >= 65
            ? 'Great'
            : fitScore >= 45
              ? 'Good'
              : fitScore >= 25
                ? 'Usable'
                : 'Bad',
      fitsBecause: [],
      doesNotFitBecause: [],
      bestUseCase: fitScore >= 65 ? 'endgame' : 'campaign',
      missingImportantStats: options.missing || [],
      wastedStats: options.wasted || [],
      recommendedAction: 'Use',
      confidence: 90,
      warnings: [],
    },
    knowledge: {
      ruleset: 'test',
      confidence: { score: 90, level: 'high', reasons: [], warnings: [] },
      rolls: [],
      recognizedModifiers: 0,
      totalModifiers: 0,
      itemLevelNote: '',
      craftingNotes: [],
    },
  };
}

function context(
  value: ItemStats,
  assessed: ItemEvaluation,
  overrides: Partial<Parameters<typeof decideItem>[0]> = {},
): Parameters<typeof decideItem>[0] {
  return {
    item: value,
    evaluation: assessed,
    estimate: null,
    dataSource: 'none',
    warning: 'Live Trade2 verification failed.',
    ...overrides,
  };
}
