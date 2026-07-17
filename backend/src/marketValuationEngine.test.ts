import { describe, expect, it } from 'vitest';
import { valueMarket } from './marketValuationEngine.js';
const row = (price: number, id = String(price)) => ({
  id,
  price,
  currency: 'exalted' as const,
  divineRate: 65,
  similarity: 0.9,
  indexedAt: new Date().toISOString(),
  baseType: 'Wrapped Boots',
  listingType: 'asking' as const,
});
describe('MarketValuationEngine', () => {
  it('removes extreme outliers and returns three prices', () => {
    const result = valueMarket(
      [8, 9, 10, 11, 12, 999].map((v) => row(v)),
      'Wrapped Boots',
    );
    expect(result.fairPrice).toBeLessThan(20);
    expect(result.quickSell).toBeLessThan(result.fairPrice);
    expect(result.listingPrice).toBeGreaterThan(result.fairPrice);
    expect(result.sampleSize).toBe(5);
  });
  it('normalizes divine listings', () => {
    const result = valueMarket([{ ...row(1), currency: 'divine', divineRate: 65 }, row(64, 'ex')]);
    expect(result.fairPrice).toBeGreaterThanOrEqual(64);
  });
  it('states when evidence is asking prices', () =>
    expect(valueMarket([row(10)]).warning).toMatch(/asking prices.*not completed sales/i));
  it('returns low confidence without evidence', () =>
    expect(valueMarket([])).toMatchObject({ confidence: 'Low', sampleSize: 0 }));
});
