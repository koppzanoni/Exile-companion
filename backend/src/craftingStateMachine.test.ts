import { describe, expect, it } from 'vitest';
import { CraftingStateMachine, applyAction, compareContinueSellBuy, evaluateAction, stateFromItem } from './craftingStateMachine.js';
import type { ItemAnalysisInput } from './engineContracts.js';

const baseItem = (overrides: Partial<ItemAnalysisInput> = {}): ItemAnalysisInput => ({
  game: 'poe2', league: '', patch: '', itemClass: 'Boots', baseType: 'Wrapped Boots', rarity: 'normal', itemLevel: 80, quality: 0,
  corrupted: false, identified: true, sockets: [], implicitModifiers: [], prefixes: [], suffixes: [], unknownModifiers: [],
  baseDefences: { armour: 0, evasion: 0, energyShield: 0, deflection: 0, runicWard: 0 }, ...overrides,
});

describe('craftingStateMachine currency validation', () => {
  it('rejects currency that does not match the item rarity', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare' }));
    const result = evaluateAction(state, 'orb-of-augmentation');
    expect(result.legal).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/requires a magic item/i);
  });

  it('rejects currency on corrupted items', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare', corrupted: true }));
    expect(evaluateAction(state, 'exalted-orb').legal).toBe(false);
  });

  it('rejects adding an affix when there is no open slot', () => {
    const full = baseItem({ rarity: 'rare', prefixes: [{ id: 'p1', text: 'a', type: 'prefix', group: 'A', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }, { id: 'p2', text: 'b', type: 'prefix', group: 'B', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }, { id: 'p3', text: 'c', type: 'prefix', group: 'C', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }], suffixes: [{ id: 's1', text: 'd', type: 'suffix', group: 'D', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }, { id: 's2', text: 'e', type: 'suffix', group: 'E', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }, { id: 's3', text: 'f', type: 'suffix', group: 'F', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }] });
    const state = stateFromItem(full);
    const result = evaluateAction(state, 'exalted-orb');
    expect(result.legal).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/no open affix slot/i);
  });

  it('rejects actions when item level is below the goal minimum', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare', itemLevel: 40 }), { description: 'x', minimumItemLevel: 75 });
    expect(evaluateAction(state, 'exalted-orb').legal).toBe(false);
  });

  it('flags an existing duplicate modifier group as a conflict instead of silently allowing it', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare', prefixes: [{ id: 'p1', text: 'a', type: 'prefix', group: 'Life', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }, { id: 'p2', text: 'b', type: 'prefix', group: 'Life', tags: [], local: false, crafted: false, desecrated: false, source: 'x' }] }));
    expect(evaluateAction(state, 'exalted-orb').reasons.join(' ')).toMatch(/already has two modifiers from the "Life" group/i);
  });

  it('marks reversibility as false for every currency and never invents a chance for random-from-pool outcomes', () => {
    const state = stateFromItem(baseItem({ rarity: 'magic' }));
    const result = evaluateAction(state, 'divine-orb');
    expect(result.reversible).toBe(false);
    expect(result.outcomeCertainty).toBe('random-from-pool');
    expect(result.knownChance).toBeUndefined();
  });

  it('marks the mechanical certainty of guaranteed actions without claiming to know the specific roll', () => {
    const state = stateFromItem(baseItem({ rarity: 'normal' }));
    const result = evaluateAction(state, 'orb-of-transmutation');
    expect(result.outcomeCertainty).toBe('guaranteed');
    expect(result.knownChance).toBe(1);
  });
});

describe('applyAction', () => {
  it('adds a placeholder affix without inventing which modifier was rolled', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare' }));
    const { state: next, evaluation } = applyAction(state, 'exalted-orb');
    expect(evaluation.legal).toBe(true);
    const added = [...next.prefixes, ...next.suffixes].find((m) => m.source === 'crafting-simulation');
    expect(added).toBeTruthy();
    expect(added!.text).toMatch(/unknown/i);
    expect(next.currencySpent).toHaveLength(1);
  });

  it('does not mutate the state when the action is illegal', () => {
    const state = stateFromItem(baseItem({ rarity: 'normal' }));
    const { state: next, evaluation } = applyAction(state, 'exalted-orb');
    expect(evaluation.legal).toBe(false);
    expect(next).toBe(state);
  });
});

describe('compareContinueSellBuy', () => {
  it('never claims buy-vs-craft when no market price is known', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare' }));
    expect(compareContinueSellBuy(state).recommendation).toBe('unknown');
  });

  it('recommends buying instead once invested value reaches the ready-made price', () => {
    const state = stateFromItem(baseItem({ rarity: 'rare' }), undefined, 40);
    expect(compareContinueSellBuy(state, { buyPrice: 35 }).recommendation).toBe('buy-instead');
  });
});

describe('CraftingStateMachine history and undo', () => {
  it('tracks accumulated cost and allows a pointer-only undo without pretending currency is refunded', () => {
    const machine = new CraftingStateMachine(stateFromItem(baseItem({ rarity: 'normal' })));
    machine.apply('orb-of-transmutation');
    machine.apply('orb-of-augmentation');
    expect(machine.current.currencySpent).toHaveLength(2);
    expect(machine.log).toHaveLength(2);
    machine.undo();
    expect(machine.current.currencySpent).toHaveLength(1);
    expect(machine.log).toHaveLength(2); // the historical log stays intact; undo only moves the viewing pointer
  });

  it('does not advance state or record history for illegal actions', () => {
    const machine = new CraftingStateMachine(stateFromItem(baseItem({ rarity: 'normal' })));
    const { evaluation } = machine.apply('exalted-orb');
    expect(evaluation.legal).toBe(false);
    expect(machine.log).toHaveLength(0);
  });
});
