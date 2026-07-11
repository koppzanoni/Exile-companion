import { describe, expect, it } from 'vitest';
import { evaluateItem } from './quality.js';
import { compareItems } from './itemComparison.js';
import type { ItemStats } from './types.js';

const base: ItemStats = { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', itemLevel: 78, customMods: [] };

describe('item quality and build fit', () => {
  it('recognises strong life, movement and resistance boots', () => {
    const evaluation = evaluateItem({ ...base, armour: 268, life: 76, fireResistance: 31, coldResistance: 27, movementSpeed: 25 });
    expect(evaluation.score).toBeGreaterThanOrEqual(55);
    expect(evaluation.grade).toMatch(/good|excellent/);
    expect(evaluation.strengths.join(' ')).toMatch(/movement speed/i);
    expect(evaluation.buildFits[0].name).toMatch(/life-based melee/i);
    expect(evaluation.upgradePriorities.join(' ')).toMatch(/30–35% movement speed/i);
    expect(evaluation.marketability).toBe('broad');
    expect(evaluation.weaknesses.join(' ')).toMatch(/premium 30–35%/i);
  });

  it('heavily penalises rare boots with no movement or defensive identity', () => {
    const evaluation = evaluateItem({ ...base, movementSpeed: 0 });
    expect(evaluation.grade).toBe('poor');
    expect(evaluation.weaknesses.join(' ')).toMatch(/No movement speed/i);
  });

  it('identifies Energy Shield caster and minion identities', () => {
    const caster = evaluateItem({ ...base, energyShield: 190, intelligence: 42, mana: 90, movementSpeed: 30, customMods: ['Minions deal 25% increased Damage'], spirit: 30 });
    expect(caster.buildFits.some((fit) => fit.name.includes('Minion') && fit.fit === 'strong')).toBe(true);
    expect(caster.strengths.join(' ')).toMatch(/Spirit/);
  });

  it('credits cold plus chaos resistance without claiming chaos is missing', () => {
    const evaluation = evaluateItem({ itemType: 'Helmet', baseType: 'Ancestral Tiara', rarity: 'rare', itemLevel: 81, energyShield: 109, life: 100, mana: 71, coldResistance: 34, chaosResistance: 19, customMods: [] });
    expect(evaluation.grade).toBe('good');
    expect(evaluation.strengths.join(' ')).toMatch(/chaos resistance \(\+19%\)/i);
    expect(evaluation.weaknesses.join(' ')).not.toMatch(/no.*chaos resistance/i);
  });

  it('evaluates a physical crossbow by offense instead of missing defences', () => {
    const evaluation = evaluateItem({
      itemType: 'Weapon', baseType: 'Siege Crossbow', rarity: 'rare', itemLevel: 79,
      physicalDamageMin: 132, physicalDamageMax: 377, attacksPerSecond: 1.65, criticalHitChance: 5,
      customMods: ['Grenade Skills Fire an additional Projectile', '43(35-44)% increased Physical Damage', '+96(73-97) to Accuracy Rating', '40(40-49)% increased Physical Damage', 'Adds 43(37-55) to 91(63-94) Physical Damage', 'Leeches 7.43(7-7.9)% of Physical Damage as Life'],
    });
    expect(evaluation.score).toBeGreaterThanOrEqual(55);
    expect(evaluation.grade).toMatch(/good|excellent|elite/);
    expect(evaluation.strengths.join(' ')).toMatch(/weapon DPS/i);
    expect(evaluation.buildFits[0]).toMatchObject({ name: 'Physical projectile attack', fit: 'strong' });
    expect(evaluation.weaknesses.join(' ')).not.toMatch(/life|energy shield|resistance/i);
    expect(evaluation.upgradePriorities.join(' ')).not.toMatch(/life|energy shield|resistance/i);
  });

  it('penalises defensive affixes that consume weapon mod slots', () => {
    const evaluation = evaluateItem({ itemType: 'Weapon', baseType: 'Gemini Bow', rarity: 'rare', physicalDamageMin: 80, physicalDamageMax: 150, attacksPerSecond: 1.2, customMods: ['+70 to maximum Life', '+30% to Fire Resistance'] });
    expect(evaluation.weaknesses.join(' ')).toMatch(/2 defensive affixes consume weapon mod space/i);
    expect(evaluation.upgradePriorities.join(' ')).toMatch(/replace defensive weapon affixes/i);
  });

  it('scores an item against the active build without replacing universal quality', () => {
    const evaluation = evaluateItem({ ...base, armour: 300, life: 82, fireResistance: 32, coldResistance: 31, movementSpeed: 30 }, {
      name: 'Molten Warrior', className: 'Warrior', ascendancy: 'Titan', mainSkill: 'Molten Crash', stage: 'endgame', defenceStyle: 'life-armour',
      priorities: [{ stat: 'life', level: 'required', minimum: 75 }, { stat: 'armour', level: 'high' }, { stat: 'movementSpeed', level: 'high', minimum: 30 }, { stat: 'fireResistance', level: 'high' }],
      requiredMods: ['[weapon] level of all melee skills'], desiredMods: [],
    });
    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.personalized).toMatchObject({ buildName: 'Molten Warrior', className: 'Warrior · Titan' });
    expect(evaluation.personalized?.score).toBeGreaterThanOrEqual(65);
    expect(evaluation.personalized?.matched.join(' ')).toMatch(/movement speed/i);
    expect(evaluation.personalized?.missing.join(' ')).not.toMatch(/melee skills/i);
  });

  it('marks missing build-enabling modifiers as a poor fit', () => {
    const evaluation = evaluateItem({ itemType: 'Amulet', baseType: 'Solar Amulet', rarity: 'rare', itemLevel: 80, life: 70, customMods: [] }, {
      name: 'Spirit Minions', className: 'Witch', stage: 'endgame', defenceStyle: 'hybrid', priorities: [{ stat: 'spirit', level: 'required', minimum: 30 }],
      requiredMods: ['level of all minion skills'], desiredMods: ['minions deal'],
    });
    expect(evaluation.personalized?.fit).toBe('poor');
    expect(evaluation.personalized?.missing.join(' ')).toMatch(/30 Spirit.*level of all minion skills/i);
  });

  it('enforces required defensive floors in Hardcore / Gauntlet mode', () => {
    const evaluation = evaluateItem({ ...base, life: 85, armour: 300, movementSpeed: 0 }, {
      name: 'Safe melee', className: 'Warrior', stage: 'campaign', evaluationStyle: 'hardcore-gauntlet', defenceStyle: 'life-armour',
      priorities: [{ stat: 'life', level: 'required', minimum: 70 }, { stat: 'movementSpeed', level: 'required', minimum: 20 }, { stat: 'armour', level: 'high' }], requiredMods: [], desiredMods: [],
    });
    expect(evaluation.personalized?.score).toBeLessThanOrEqual(34);
    expect(evaluation.personalized?.conflicts.join(' ')).toMatch(/safety gate.*movement speed/i);
  });

  it('gives campaign movement more influence in Campaign Race mode', () => {
    const item = { ...base, movementSpeed: 30 };
    const profile = { name: 'Fast campaign', className: 'Ranger', stage: 'campaign' as const, defenceStyle: 'life-evasion' as const, priorities: [{ stat: 'movementSpeed' as const, level: 'high' as const }, { stat: 'life' as const, level: 'high' as const }, { stat: 'fireResistance' as const, level: 'high' as const }], requiredMods: [], desiredMods: [] };
    const balanced = evaluateItem(item, { ...profile, evaluationStyle: 'balanced' }).personalized!;
    const racing = evaluateItem(item, { ...profile, evaluationStyle: 'campaign-race' }).personalized!;
    expect(racing.score).toBeGreaterThan(balanced.score);
  });

  it('uses shield-only block and local defence scoring', () => {
    const strong = evaluateItem({ itemType:'Shield', baseType:'Tower Shield', rarity:'rare', blockChance:30, increasedBlockChance:25, armour:900, life:80, customMods:[] });
    const weak = evaluateItem({ itemType:'Shield', baseType:'Tower Shield', rarity:'rare', blockChance:18, armour:100, life:80, customMods:[] });
    expect(strong.category?.key).toBe('shield');
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.strengths.join(' ')).toMatch(/block chance/i);
  });

  it('separates category analysis and compares only the same equipped slot', () => {
    const candidate = { ...base, movementSpeed:30, life:90, fireResistance:35 };
    const equipped = { ...base, movementSpeed:20, life:60 };
    const comparison = compareItems(candidate,equipped);
    expect(comparison).toMatchObject({ compatible:true, candidateCategory:{ key:'boots' } });
    expect(comparison.improvements.join(' ')).toMatch(/movement speed/i);
    const mismatch = compareItems(candidate,{ itemType:'Shield',baseType:'Tower Shield',rarity:'rare',customMods:[] });
    expect(mismatch.compatible).toBe(false);
  });
});
