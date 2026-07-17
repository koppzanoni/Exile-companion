import { describe, expect, it } from 'vitest';
import { Poe2CraftingEngine } from './craftingEngine.js';
import type { ItemAnalysisInput } from './engineContracts.js';
const item = (rarity: string, itemLevel = 80, prefixes: ItemAnalysisInput['prefixes'] = []): ItemAnalysisInput => ({
  game: 'poe2',
  league: '',
  patch: '0.5.4',
  itemClass: 'Boots',
  baseType: 'Wrapped Boots',
  rarity,
  itemLevel,
  quality: 0,
  corrupted: false,
  identified: true,
  sockets: [],
  implicitModifiers: [],
  prefixes,
  suffixes: [],
  unknownModifiers: [],
  baseDefences: { armour: 0, evasion: 0, energyShield: 0, deflection: 0, runicWard: 0 },
});
const affix = (id: string, group: string) => ({
  id,
  text: id,
  type: 'prefix' as const,
  group,
  tags: [],
  local: false,
  crafted: false,
  desecrated: false,
  source: 'x',
});
describe('CraftingEngine', () => {
  it('creates budget routes only from legal actions', async () => {
    const engine = new Poe2CraftingEngine();
    const result = (await engine.plan(engine.inspect(item('rare')), {
      description: 'Movement speed and resistances',
      minimumItemLevel: 70,
    })) as any;
    expect(result.routes.find((route: any) => route.budget === 'intermediate').steps[0].action).toBe('Exalted Orb');
    expect(result.stopConditions.length).toBeGreaterThan(2);
  });
  it('blocks the graph when item level is insufficient', async () => {
    const engine = new Poe2CraftingEngine();
    const result = (await engine.plan(engine.inspect(item('rare', 40)), {
      description: 'High tier boots',
      minimumItemLevel: 75,
    })) as any;
    expect(result.status).toBe('blocked');
    expect(
      result.routes
        .flatMap((route: any) => route.blocked)
        .some((entry: any) => entry.reasons.join(' ').includes('does not meet')),
    ).toBe(true);
  });
  it('does not invent success probabilities', async () => {
    const engine = new Poe2CraftingEngine();
    const result = (await engine.plan(engine.inspect(item('rare', 80, [affix('p1', 'Life')])), {
      description: 'Any upgrade',
    })) as any;
    expect(result.warning).toMatch(/probability is unknown/i);
  });
});
