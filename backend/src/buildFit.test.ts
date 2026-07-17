import { describe, expect, it } from 'vitest';
import { analyzeBuildFit } from './buildFit.js';
import { defaultBuildProfiles } from './buildProfiles.js';
import { mergeItem, parseItemText } from './itemParser.js';
import { evaluateItem } from './quality.js';

const build = (id: string) => defaultBuildProfiles.find((profile) => profile.id === id)!;
const analyze = (text: string, id: string) => {
  const item = mergeItem(parseItemText(text), {});
  const evaluation = evaluateItem(item);
  return analyzeBuildFit(item, evaluation, build(id));
};

describe('Build Fit Analysis', () => {
  it('loads every required default profile', () => {
    expect(defaultBuildProfiles).toHaveLength(17);
    expect(defaultBuildProfiles.map((profile) => profile.name)).toEqual(
      expect.arrayContaining([
        'Ice Shot Deadeye',
        'Lightning Arrow Deadeye',
        'Crossbow Mercenary',
        'Lightning Monk',
        'Quarterstaff Monk',
        'Minion Witch',
        'Cold Caster',
        'Fire Caster',
        'Lightning Caster',
        'Armour/Life Warrior',
        'Evasion Ranger',
        'Energy Shield Caster',
        'Generic Melee',
        'Generic Projectile Attack',
        'Generic Spell Caster',
        'Generic Minion',
        'Generic Defensive Leveling',
      ]),
    );
  });

  it('fits a cold projectile bow to Ice Shot better than a caster', () => {
    const text =
      'Item Class: Bows\nRarity: Rare\nFrost String\nGemini Bow\n--------\nPhysical Damage: 90-180\nCold Damage: 60-120\nCritical Hit Chance: 8.00%\nAttacks per Second: 1.65\n--------\nAdds 60 to 120 Cold Damage\n18% increased Attack Speed\n+250 to Accuracy Rating\nProjectiles deal 35% increased Damage';
    const ice = analyze(text, 'ice-shot-deadeye');
    const caster = analyze(text, 'cold-caster');
    expect(ice.score).toBeGreaterThan(caster.score + 25);
    expect(ice.fitsBecause.join(' ')).toMatch(/Preferred weapon|cold|attack speed/i);
  });

  it('fits physical crossbow offense to Crossbow Mercenary', () => {
    const result = analyze(
      'Item Class: Crossbows\nRarity: Rare\nSiege Core\nSiege Crossbow\n--------\nPhysical Damage: 170-410\nCritical Hit Chance: 7.00%\nAttacks per Second: 1.65\n--------\n50% increased Physical Damage\n16% increased Attack Speed\n+280 to Accuracy Rating\nGrenade Skills fire an additional Projectile',
      'crossbow-mercenary',
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.label).toMatch(/Great|Build-defining/);
  });

  it('strongly rewards minion levels and Spirit for Minion Witch', () => {
    const text =
      'Item Class: Sceptres\nRarity: Rare\nSoul Call\nRattling Sceptre\n--------\n+45 to Spirit\n+2 to Level of all Minion Skills\nMinions deal 40% increased Damage\n+90 to maximum Mana';
    const minion = analyze(text, 'minion-witch');
    const ice = analyze(text, 'ice-shot-deadeye');
    expect(minion.score).toBeGreaterThan(ice.score + 30);
    expect(minion.fitsBecause.join(' ')).toMatch(/minion|spirit/i);
    expect(ice.wastedStats.join(' ')).toMatch(/minion/i);
  });

  it('fits spell damage, cast speed and mana to caster builds', () => {
    const result = analyze(
      'Item Class: Wands\nRarity: Rare\nWinter Song\nAttuned Wand\n--------\n+2 to Level of all Spell Skills\n80% increased Spell Damage\n18% increased Cast Speed\n+100 to maximum Mana\n+40 to Intelligence',
      'cold-caster',
    );
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.fitsBecause.join(' ')).toMatch(/spell damage|cast speed|mana/i);
  });

  it('fits defensive armour to Armour/Life Warrior without scoring offensive body stats', () => {
    const result = analyze(
      'Item Class: Body Armours\nRarity: Rare\nIron Heart\nSteel Plate\n--------\nArmour: 1800\n--------\n+120 to maximum Life\n+40% to Fire Resistance\n+38% to Cold Resistance\n+45 to Strength\n+250 to Stun Threshold',
      'armour-life-warrior',
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.fitsBecause.join(' ')).toMatch(/life|armour|resistance/i);
    expect(result.missingImportantStats.join(' ')).not.toMatch(/weapon damage|attack speed/i);
  });

  it('detects bad fits and recommends selling or replacing useful off-build items', () => {
    const result = analyze(
      'Item Class: Wands\nRarity: Rare\nGrave Call\nAttuned Wand\n--------\n+2 to Level of all Minion Skills\nMinions deal 40% increased Damage\n+45 to Spirit',
      'ice-shot-deadeye',
    );
    expect(result.label).toBe('Bad');
    expect(result.wastedStats.join(' ')).toMatch(/minion|spell/i);
    expect(['Sell', 'Price Check', 'Vendor']).toContain(result.recommendedAction);
  });

  it('scores the actual magnitude of item stats instead of giving full credit for matching words', () => {
    const weak = analyze(
      'Item Class: Bows\nRarity: Rare\nChill Twig\nShortbow\n--------\nItem Level: 80\nCold Damage: 2-4\nCritical Hit Chance: 5.00%\nAttacks per Second: 1.25\n--------\nAdds 2 to 4 Cold Damage\n+20 to Accuracy Rating',
      'ice-shot-deadeye',
    );
    const strong = analyze(
      'Item Class: Bows\nRarity: Rare\nFrost Engine\nGemini Bow\n--------\nItem Level: 80\nCold Damage: 100-220\nCritical Hit Chance: 9.00%\nAttacks per Second: 1.75\n--------\nAdds 100 to 220 Cold Damage\n22% increased Attack Speed\n+380 to Accuracy Rating\n40% increased Projectile Damage',
      'ice-shot-deadeye',
    );
    expect(strong.score).toBeGreaterThan(weak.score + 35);
    expect(weak.missingImportantStats.join(' ')).toMatch(/cold|attack speed|accuracy/i);
    expect(strong.fitsBecause.join(' ')).toMatch(/excellent \(100% of target\)/i);
  });

  it('treats an over-cap resistance roll as far less valuable once the character is already near the cap', () => {
    const item = mergeItem(
      parseItemText(
        'Item Class: Body Armours\nRarity: Rare\nIron Heart\nSteel Plate\n--------\nArmour: 1800\n--------\n+120 to maximum Life\n+40% to Fire Resistance\n+38% to Cold Resistance\n+45 to Strength\n+250 to Stun Threshold',
      ),
      {},
    );
    const evaluation = evaluateItem(item);
    const profile = build('armour-life-warrior');
    const fresh = analyzeBuildFit(item, evaluation, profile, {});
    const alreadyCapped = analyzeBuildFit(item, evaluation, profile, { fireResistance: 75, coldResistance: 75 });
    expect(alreadyCapped.score).toBeLessThan(fresh.score);
  });
  it('only evaluates build priorities that can reasonably appear on the item slot', () => {
    const boots = analyze(
      'Item Class: Boots\nRarity: Rare\nFleet Hide\nWrapped Boots\n--------\nEvasion Rating: 430\n--------\n+82 to maximum Life\n30% increased Movement Speed\n+35% to Fire Resistance\n+34% to Cold Resistance',
      'ice-shot-deadeye',
    );
    expect(boots.score).toBeGreaterThanOrEqual(65);
    expect(boots.missingImportantStats.join(' ')).not.toMatch(/projectile|attack speed|accuracy|skill level|mana/i);
    expect(boots.fitsBecause.join(' ')).toMatch(/life.*target|evasion.*target|movement speed.*target/i);
  });
});
