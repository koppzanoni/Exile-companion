import { describe, expect, it } from 'vitest';
import { mergeItem, parseItemText } from './itemParser.js';

describe('item parser', () => {
  it('extracts identity, defences, levels and important mods from PoE 2 text', () => {
    const item = parseItemText(`Item Class: Boots
Rarity: Rare
Rune Pace
Stone Greaves
--------
Armour: 268
Requirements:
Level: 65
Item Level: 78
+76 to maximum Life
+31% to Fire Resistance
+27% to Cold Resistance
25% increased Movement Speed`);
    expect(item).toMatchObject({ rarity: 'rare', name: 'Rune Pace', baseType: 'Stone Greaves', itemType: 'Boots', armour: 268, requiredLevel: 65, itemLevel: 78, life: 76, fireResistance: 31, coldResistance: 27, movementSpeed: 25 });
  });

  it('lets explicit manual values override parsed values', () => {
    const merged = mergeItem(parseItemText('Rarity: Rare\nOld Name\nSilk Slippers\n--------\n+20 to maximum Life'), { life: 80, baseType: 'Silk Slippers' });
    expect(merged.life).toBe(80);
    expect(merged.itemType).toBe('Boots');
  });

  it('parses advanced-description rolls and item class from real PoE 2 text', () => {
    const raw = `Item Class: Helmets
Rarity: Rare
Dire Dome
Ancestral Tiara
--------
Energy Shield: 109
--------
Requires: Level 80, 115 (unmet) Int
--------
Item Level: 81
--------
{ Prefix Modifier "Virile" (Tier: 3) — Life }
+100(100-119) to maximum Life
{ Prefix Modifier "Hunter's" (Tier: 3) — Attack }
+333(237-346) to Accuracy Rating
{ Prefix Modifier "Aqua" (Tier: 5) — Mana }
+71(65-79) to maximum Mana
{ Suffix Modifier "of Buffering" (Tier: 1) — Energy Shield }
16(16-19)% increased Energy Shield Recharge Rate
{ Suffix Modifier "of Expulsion" (Tier: 3) — Chaos, Resistance }
+19(16-19)% to Chaos Resistance
{ Desecrated Suffix Modifier "of the Polar Bear" (Tier: 3) — Elemental, Cold, Resistance }
+34(31-35)% to Cold Resistance`;
    const parsed = parseItemText(raw);
    expect(parsed).toMatchObject({
      name: 'Dire Dome', baseType: 'Ancestral Tiara', itemType: 'Helmet', rarity: 'rare',
      energyShield: 109, requiredLevel: 80, itemLevel: 81, life: 100, mana: 71,
      chaosResistance: 19, coldResistance: 34,
    });
    expect(parsed.customMods).toEqual(expect.arrayContaining(['+19(16-19)% to Chaos Resistance', '+34(31-35)% to Cold Resistance']));
    const merged = mergeItem(parsed, { rarity: '' as any, customMods: [] });
    expect(merged.customMods.length).toBeGreaterThan(3);
    expect(merged.rarity).toBe('rare');
  });

  it('parses displayed weapon damage and offensive modifiers', () => {
    const parsed = parseItemText(`Item Class: Crossbows
Rarity: Rare
Gloom Core
Siege Crossbow
--------
Physical Damage: 132-377 (augmented)
Critical Hit Chance: 5.00%
Attacks per Second: 1.65
Reload Time: 0.75
--------
Requires: Level 79, 89 Str, 89 Dex
--------
Item Level: 79
--------
Grenade Skills Fire an additional Projectile
43(35-44)% increased Physical Damage
+96(73-97) to Accuracy Rating
40(40-49)% increased Physical Damage
Adds 43(37-55) to 91(63-94) Physical Damage
Leeches 7.43(7-7.9)% of Physical Damage as Life`);
    expect(parsed).toMatchObject({ itemType: 'Weapon', baseType: 'Siege Crossbow', physicalDamageMin: 132, physicalDamageMax: 377, attacksPerSecond: 1.65, criticalHitChance: 5, itemLevel: 79 });
    expect(parsed.customMods).toEqual(expect.arrayContaining(['Grenade Skills Fire an additional Projectile', 'Adds 43(37-55) to 91(63-94) Physical Damage']));
  });

  it('keeps shields, focuses and quivers as distinct slots', () => {
    const shield = parseItemText('Item Class: Shields\nRarity: Rare\nGuard Crest\nTower Shield\n--------\nChance to Block: 28%\nArmour: 650\n--------\n24% increased Chance to Block');
    const focus = parseItemText('Item Class: Foci\nRarity: Rare\nMind Star\nAttuned Focus\n--------\nEnergy Shield: 180\n--------\n+2 to Level of all Spell Skills\n70% increased Spell Damage');
    const quiver = parseItemText('Item Class: Quivers\nRarity: Rare\nStorm Flight\nBroadhead Quiver\n--------\n+2 to Level of all Projectile Skills\n15% increased Attack Speed');
    expect(shield).toMatchObject({ itemType: 'Shield', blockChance: 28, increasedBlockChance: 24 });
    expect(focus).toMatchObject({ itemType: 'Focus', energyShield: 180, spellSkillLevels: 2, spellDamage: 70 });
    expect(quiver).toMatchObject({ itemType: 'Quiver', projectileSkillLevels: 2, attackSpeedBonus: 15 });
  });

  it('parses attribute requirements from the Requires line', () => {
    const parsed = parseItemText('Item Class: Crossbows\nRarity: Rare\nGloom Core\nSiege Crossbow\n--------\nRequires: Level 79, 89 Str, 89 Dex\n--------\nItem Level: 79');
    expect(parsed).toMatchObject({ requiredLevel: 79, requiredStrength: 89, requiredDexterity: 89 });
    expect(parsed.requiredIntelligence).toBeUndefined();
  });

  it('parses Deflection and Runic Ward instead of leaving them at zero', () => {
    const parsed = parseItemText('Item Class: Foci\nRarity: Rare\nWard Halo\nCrystal Focus\n--------\nEnergy Shield: 40\nDeflection: 120\nRunic Ward: 60\n--------\nItem Level: 78');
    expect(parsed).toMatchObject({ energyShield: 40, deflection: 120, runicWard: 60 });
    expect(parsed.customMods).not.toEqual(expect.arrayContaining([expect.stringMatching(/^Deflection:|^Runic Ward:/)]));
  });
});
