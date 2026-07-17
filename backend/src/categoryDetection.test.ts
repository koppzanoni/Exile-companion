import { describe, expect, it } from 'vitest';
import { detectItemCategoryDetailed } from './categoryDetection.js';
import { mergeItem, parseItemText } from './itemParser.js';
import type { ItemCategory } from './types.js';

const cases: Array<[ItemCategory, string, string]> = [
  ['body-armour', 'Body Armours', 'Vile Robe'],
  ['helmet', 'Helmets', 'Ancestral Tiara'],
  ['gloves', 'Gloves', 'Expert Linen Wraps'],
  ['boots', 'Boots', 'Stone Greaves'],
  ['shield', 'Shields', 'Plate Shield'],
  ['focus', 'Foci', 'Attuned Focus'],
  ['quiver', 'Quivers', 'Broadhead Quiver'],
  ['bow', 'Bows', 'Gemini Bow'],
  ['crossbow', 'Crossbows', 'Siege Crossbow'],
  ['one-handed-melee', 'One Hand Maces', 'Expert Flanged Mace'],
  ['two-handed-melee', 'Two Hand Maces', 'Expert Forge Maul'],
  ['staff', 'Staves', 'Temple Staff'],
  ['quarterstaff', 'Quarterstaves', 'Gothic Quarterstaff'],
  ['wand', 'Wands', 'Attuned Wand'],
  ['sceptre', 'Sceptres', 'Rattling Sceptre'],
  ['ring', 'Rings', 'Ruby Ring'],
  ['amulet', 'Amulets', 'Solar Amulet'],
  ['belt', 'Belts', 'Utility Belt'],
];

describe('category detection', () => {
  it.each(cases)('detects %s from Item Class %s', (expected, itemClass, baseType) => {
    const item = mergeItem(
      parseItemText(`Item Class: ${itemClass}\nRarity: Rare\nTest Item\n${baseType}\n--------\nItem Level: 80`),
      {},
    );
    const detected = detectItemCategoryDetailed(item);
    expect(detected.category.key).toBe(expected);
    expect(detected.confidence).toBeGreaterThanOrEqual(90);
    expect(detected.reason).toMatch(/Item Class/i);
  });
});
