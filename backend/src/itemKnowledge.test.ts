import { describe, expect, it } from 'vitest';
import { assessItemKnowledge } from './itemKnowledge.js';
import { mergeItem, parseItemText } from './itemParser.js';
import { detectItemCategory } from './slotQuality.js';

describe('item knowledge refinement', () => {
  it('reads advanced modifier tiers and roll positions', () => {
    const item=mergeItem(parseItemText(`Item Class: Helmets
Rarity: Rare
Dire Dome
Ancestral Tiara
--------
Energy Shield: 109
--------
Item Level: 81
--------
{ Prefix Modifier "Virile" (Tier: 3) — Life }
+118(100-119) to maximum Life
{ Suffix Modifier "of Expulsion" (Tier: 1) — Chaos, Resistance }
+19(16-19)% to Chaos Resistance`),{});
    const knowledge=assessItemKnowledge(item,detectItemCategory(item),'endgame');
    expect(knowledge.rolls).toHaveLength(2);
    expect(knowledge.rolls[0]).toMatchObject({ tier:3, label:'high' });
    expect(knowledge.rolls[1]).toMatchObject({ tier:1, percentile:100, label:'perfect' });
    expect(knowledge.confidence.level).toBe('high');
  });

  it('treats item level as potential and warns when advanced ranges are absent', () => {
    const item=mergeItem(parseItemText('Item Class: Boots\nRarity: Rare\nQuick Step\nStone Greaves\n--------\nItem Level: 82\n--------\n30% increased Movement Speed'),{});
    const knowledge=assessItemKnowledge(item,detectItemCategory(item),'endgame');
    expect(knowledge.itemLevelNote).toMatch(/potential, not proof/i);
    expect(knowledge.confidence.warnings.join(' ')).toMatch(/Advanced Item Descriptions/i);
  });

  it('uses explicit class before ambiguous base-name words', () => {
    const shield=mergeItem(parseItemText('Item Class: Shields\nRarity: Rare\nStone Guard\nPlate Shield\n--------\nChance to Block: 26%'),{});
    const staff=mergeItem(parseItemText('Item Class: Staves\nRarity: Rare\nRune Song\nTemple Staff\n--------\n60% increased Spell Damage'),{});
    expect(detectItemCategory(shield).key).toBe('shield');
    expect(detectItemCategory(staff).key).toBe('staff');
  });
});
