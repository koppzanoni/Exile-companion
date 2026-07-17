import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildLevelingSearchPlan,
  milestoneFor,
  nextMilestoneLevel,
  searchLevelingItems,
  selectPriceDiverseIds,
  TRADE2_MAX_FETCH_RESULTS,
  whatChangesAtNextMilestone,
} from './leveling.js';
import type { BuildProfile } from './types.js';

const iceShot: BuildProfile = {
  name: 'Ice Shot Deadeye',
  className: 'Ranger',
  ascendancy: 'Deadeye',
  mainSkill: 'Ice Shot',
  stage: 'campaign',
  defenceStyle: 'life-evasion',
  priorities: [],
  requiredMods: [],
  desiredMods: [],
};

describe('leveling search plan', () => {
  it('keeps listing detail batches within the official Trade2 limit', () => {
    expect(TRADE2_MAX_FETCH_RESULTS).toBe(10);
  });

  it('searches every supported equipment slot by default', () => {
    const plan = buildLevelingSearchPlan(iceShot, 32, 4);
    expect(plan).toHaveLength(8);
    expect(new Set(plan.map((entry) => entry.slot))).toEqual(
      new Set(['weapon', 'boots', 'body-armour', 'helmet', 'gloves', 'ring', 'amulet', 'belt']),
    );
    expect(plan[0].category).toBe('weapon.bow');
    expect(plan[0].priorities.join(' ')).toMatch(/Cold Damage/);
    for (const slot of plan) {
      const query = slot.query as any;
      expect(query.query.filters.req_filters.filters.lvl.max).toBe(32);
      expect(query.query.filters.trade_filters.filters.price.max).toBeLessThanOrEqual(4);
      expect(query.query.filters.type_filters.filters.rarity.option).toBe('rare');
    }
  });

  it('searches the given weakest slots instead of a generic stage ranking when they are provided', () => {
    const plan = buildLevelingSearchPlan(iceShot, 32, 4, { weakestSlots: ['helmet', 'belt'] });
    expect(plan.slice(0, 3).map((p) => p.slot)).toEqual(['weapon', 'helmet', 'belt']);
    expect(plan).toHaveLength(8);
  });

  it('raises the boot movement target as the character levels', () => {
    const low = buildLevelingSearchPlan(iceShot, 12, 2).find((entry) => entry.slot === 'boots')!.query as any;
    const high = buildLevelingSearchPlan(iceShot, 55, 2).find((entry) => entry.slot === 'boots')!.query as any;
    const movement = (query: any) =>
      query.query.stats[0].filters.find((filter: any) => filter.id === 'explicit.stat_2250533757').value.min;
    expect(movement(low)).toBe(10);
    expect(movement(high)).toBe(20);
  });
});

describe('price-diverse id selection', () => {
  it('reaches the full target count instead of silently under-fetching for common list lengths', () => {
    for (let len = 3; len <= 30; len += 1) {
      const ids = Array.from({ length: len }, (_, index) => `id-${index}`);
      const selected = selectPriceDiverseIds(ids, TRADE2_MAX_FETCH_RESULTS);
      expect(selected.length).toBe(Math.min(len, TRADE2_MAX_FETCH_RESULTS));
      expect(new Set(selected).size).toBe(selected.length);
    }
  });
});

describe('leveling search fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries once against a Trade2 429 instead of immediately giving up', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) return new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } });
        return new Response(JSON.stringify({ id: 'search-1', result: [] }), { status: 200 });
      }),
    );
    const [result] = await searchLevelingItems(iceShot, 32, 'Standard', 3, { maxSlots: 1 });
    expect(calls).toBeGreaterThan(1);
    expect(result.warning).toBe('No matching online listings were found.');
  });

  it('builds the manual-search fallback link with the caller-selected currency instead of always exalted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network unreachable');
      }),
    );
    const [result] = await searchLevelingItems(iceShot, 32, 'Standard', 3, { currency: 'chaos', maxSlots: 1 });
    const encoded = new URL(result.officialUrl).searchParams.get('q')!;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    expect(decoded.query.filters.trade_filters.filters.price.option).toBe('chaos');
  });
});

describe('progression milestones', () => {
  it('derives the current milestone and the next one from level', () => {
    expect(milestoneFor(15)).toBe('10');
    expect(milestoneFor(35)).toBe('30');
    expect(milestoneFor(62)).toBe('advanced-campaign');
    expect(nextMilestoneLevel(15)).toBe(20);
    expect(nextMilestoneLevel(62)).toBe(65);
  });

  it('explains what changes at the next milestone instead of reusing endgame text for every stage', () => {
    const early = whatChangesAtNextMilestone(15);
    const late = whatChangesAtNextMilestone(62);
    expect(early).not.toBe(late);
    expect(early).toMatch(/20/);
  });
});
