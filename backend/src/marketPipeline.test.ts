import { describe, expect, it, vi } from 'vitest';
import { OfficialTradeMarketProvider } from './officialTradeMarketProvider.js';
import { deriveWeightedStats, manualMarketAnalysis, runMarketPipeline, toLegacyEstimate } from './marketPipeline.js';
import { buildItemAnalysis } from './normalizedItemParser.js';
import { genericBuildFitProfile, defaultBuildProfiles } from './buildProfiles.js';
import type { ItemStats, Listing } from './types.js';

const item: ItemStats = { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', itemLevel: 78, armour: 250, life: 70, movementSpeed: 25, fireResistance: 30, customMods: [] };
const itemAnalysis = buildItemAnalysis(item, '', { league: 'Standard' });

function payload(id: string, price: number, opts: { account?: string; armour?: number; life?: number; movementSpeed?: number; baseType?: string } = {}) {
  return {
    id,
    listing: { price: { amount: price, currency: 'exalted' }, indexed: new Date().toISOString(), account: { name: opts.account || `seller-${id}` } },
    item: {
      name: id, typeLine: opts.baseType || 'Stone Greaves', baseType: opts.baseType || 'Stone Greaves', rarity: 'Rare', ilvl: 78,
      properties: [{ name: '[Armour]', values: [[String(opts.armour ?? 245), 0]] }],
      explicitMods: [{ description: `+${opts.life ?? 68} to maximum Life` }, { description: `${opts.movementSpeed ?? 25}% increased Movement Speed` }, { description: '+28% to Fire Resistance' }],
    },
  };
}

function providerWithSequence(...batches: unknown[][]) {
  const search = vi.fn();
  for (const batch of batches) search.mockResolvedValueOnce(batch);
  return new OfficialTradeMarketProvider({ search }, { timeoutMs: 100, cacheMs: 0, minIntervalMs: 0, retries: 0 });
}

describe('deriveWeightedStats', () => {
  it('weights stats that matter for the build and slot above stats the item merely happens to have', () => {
    const build = defaultBuildProfiles.find((b) => b.id === 'evasion-ranger')!;
    const weighted = deriveWeightedStats(item, build);
    expect(weighted.some((w) => w.stat === 'movementSpeed')).toBe(true);
    expect(weighted.length).toBeGreaterThan(0);
  });
});

describe('runMarketPipeline', () => {
  it('uses the first strategy without relaxing when it already has enough comparables', async () => {
    const batch = Array.from({ length: 6 }, (_, i) => payload(`m${i}`, 20 + i));
    const provider = providerWithSequence(batch);
    const result = await runMarketPipeline({ item, itemAnalysis, build: genericBuildFitProfile, league: 'Standard', divineRate: 65, provider });
    expect(result.relaxed).toBe(false);
    expect(result.relaxationSteps).toEqual(['Same base and important stats']);
    expect(result.dataSource).toBe('live');
    expect(result.usedCount).toBeGreaterThanOrEqual(5);
    expect(result.strategyUsed).toBe('Same base and important stats');
  });

  it('relaxes progressively when the exact-base strategy does not produce enough comparables', async () => {
    const tooFew = [payload('only1', 20), payload('only2', 21)];
    const enough = Array.from({ length: 6 }, (_, i) => payload(`b${i}`, 18 + i));
    const provider = providerWithSequence(tooFew, enough);
    const result = await runMarketPipeline({ item, itemAnalysis, build: genericBuildFitProfile, league: 'Standard', divineRate: 65, provider });
    expect(result.relaxed).toBe(true);
    expect(result.relaxationSteps.length).toBeGreaterThanOrEqual(2);
    expect(result.dataSource).toBe('relaxed-live');
    expect(result.strategyUsed).not.toBe('Same base and important stats');
  });

  it('never invents a price when every strategy fails to find comparables', async () => {
    const provider = providerWithSequence([], [], [], [], []);
    const result = await runMarketPipeline({ item, itemAnalysis, build: genericBuildFitProfile, league: 'Standard', divineRate: 65, provider });
    expect(result.dataSource).toBe('none');
    expect(result.usedCount).toBe(0);
    expect(result.valuation.fairPrice).toBe(0);
    expect(toLegacyEstimate(result, item, 65)).toBeNull();
  });

  it('reports discard reasons for listings below the similarity threshold', async () => {
    const mismatched = Array.from({ length: 6 }, (_, i) => payload(`x${i}`, 20 + i, { armour: 5, life: 5, movementSpeed: 0, baseType: 'Other Boots' }));
    const provider = providerWithSequence(mismatched, mismatched, mismatched, mismatched, mismatched);
    const result = await runMarketPipeline({ item, itemAnalysis, build: genericBuildFitProfile, league: 'Standard', divineRate: 65, provider });
    expect(result.usedCount).toBe(0);
    expect(Object.keys(result.discardReasons).length).toBeGreaterThan(0);
  });
});

describe('manualMarketAnalysis', () => {
  it('scores, values, and exposes rejected outliers for pasted listings', () => {
    const listings: Listing[] = [20, 21, 22, 23, 24, 900].map((price, i) => ({
      id: String(i), name: 'Stone Greaves', baseType: 'Stone Greaves', rarity: 'rare', price, currency: 'exalted', exaltedPrice: price,
      source: 'manual', account: `seller-${i}`, stats: { armour: 250, life: 70, movementSpeed: 25, fireResistance: 30 },
    }));
    const result = manualMarketAnalysis(item, listings, 65);
    expect(result.dataSource).toBe('manual');
    expect(result.foundCount).toBe(6);
    expect(result.comparablesRejected.some((row) => row.excludedReason?.match(/outlier/))).toBe(true);
    expect(result.valuation.fairPrice).toBeLessThan(50);
    const estimate = toLegacyEstimate(result, item, 65);
    expect(estimate).not.toBeNull();
    expect(estimate!.usedCount).toBe(result.usedCount);
  });

  it('does not invent a price with no pasted listings', () => {
    const result = manualMarketAnalysis(item, [], 65);
    expect(result.dataSource).toBe('none');
    expect(toLegacyEstimate(result, item, 65)).toBeNull();
  });
});
