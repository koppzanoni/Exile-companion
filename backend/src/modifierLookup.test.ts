import { describe, expect, it } from 'vitest';
import { defaultModifierCatalog } from './modifierCatalog.js';
import { lookupModifier, loadModifierCatalog } from './modifierLookup.js';

describe('modifier catalog lookup', () => {
  it('classifies a known global modifier with medium confidence and no invented tier', () => {
    const result = lookupModifier(defaultModifierCatalog, '+45 to maximum Life');
    expect(result).toMatchObject({ id: 'life', group: 'MaximumLife', type: 'prefix', local: false, method: 'catalog', confidence: 'Medium' });
  });

  it('classifies known local weapon modifiers as local, not global', () => {
    const physical = lookupModifier(defaultModifierCatalog, '35% increased Physical Damage', 'weapon');
    expect(physical).toMatchObject({ id: 'physical-damage-percent-local', local: true, type: 'prefix' });
    const attackSpeed = lookupModifier(defaultModifierCatalog, '12% increased Attack Speed', 'weapon');
    expect(attackSpeed).toMatchObject({ id: 'attack-speed-local', local: true, type: 'suffix' });
  });

  it('flags a hybrid modifier instead of splitting it into two affixes', () => {
    const result = lookupModifier(defaultModifierCatalog, '+40 to maximum Life and 25 to maximum Mana');
    expect(result).toMatchObject({ id: 'life-mana-hybrid', hybrid: true, statKeys: ['life', 'mana'] });
  });

  it('marks unrecognized text as an explicit low-confidence regex fallback instead of inventing an identity', () => {
    const result = lookupModifier(defaultModifierCatalog, 'Culling Strike');
    expect(result).toMatchObject({ id: 'unknown', type: 'unknown', method: 'regex-fallback', confidence: 'Low' });
  });

  it('flags a modifier as invalid for a class it should not appear on', () => {
    const result = lookupModifier(defaultModifierCatalog, '15% increased Movement Speed', 'ring');
    expect(result.validForClass).toBe(false);
  });

  it('loads the catalog from the database once it has been seeded', () => {
    const rows = defaultModifierCatalog.map((entry) => ({ modifier_json: JSON.stringify(entry) }));
    const fakeDb = { prepare: () => ({ all: () => rows }) };
    const loaded = loadModifierCatalog(fakeDb);
    expect(loaded.length).toBe(defaultModifierCatalog.length);
    expect(loaded.some((entry) => entry.id === 'deflection-local')).toBe(true);
  });
});
