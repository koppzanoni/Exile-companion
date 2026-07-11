import { describe, expect, it } from 'vitest';
import { mergeItem, parseItemText } from './itemParser.js';
import { evaluateItem } from './quality.js';

const evaluate=(text:string)=>evaluateItem(mergeItem(parseItemText(text),{}));

describe('category-specific scoring behavior',()=>{
  it('does not require defensive stats on attack weapons',()=>{
    const result=evaluate('Item Class: Crossbows\nRarity: Rare\nGloom Core\nSiege Crossbow\n--------\nPhysical Damage: 150-380\nCritical Hit Chance: 7.00%\nAttacks per Second: 1.65\n--------\n45% increased Physical Damage\n15% increased Attack Speed');
    expect(result.categoryAnalysis?.detectedCategory.key).toBe('crossbow');
    expect(result.categoryAnalysis?.missingImportantStats.join(' ')).not.toMatch(/life|resistance|armour|evasion|energy shield/i);
    expect(result.weaknesses.join(' ')).not.toMatch(/missing.*life|no resistances/i);
  });

  it('flags defensive weapon affixes as weak or wasted slots',()=>{
    const result=evaluate('Item Class: Bows\nRarity: Rare\nGuard String\nGemini Bow\n--------\nPhysical Damage: 90-180\nAttacks per Second: 1.40\n--------\n+70 to maximum Life\n+30% to Fire Resistance');
    expect(result.categoryAnalysis?.weakOrWastedStats.join(' ')).toMatch(/maximum Life.*Fire Resistance/i);
  });

  it('makes block and local defence core shield positives',()=>{
    const result=evaluate('Item Class: Shields\nRarity: Rare\nAegis Crest\nPlate Shield\n--------\nChance to Block: 30%\nArmour: 900\n--------\n25% increased Chance to Block\n+80 to maximum Life');
    expect(result.categoryAnalysis?.positiveStats.join(' ')).toMatch(/Block.*Local defence/i);
    expect(result.categoryAnalysis?.categoryScore).toBeGreaterThan(60);
  });

  it('heavily values movement speed on boots',()=>{
    const fast=evaluate('Item Class: Boots\nRarity: Rare\nFast Pace\nStone Greaves\n--------\nArmour: 250\n--------\n+75 to maximum Life\n30% increased Movement Speed');
    const slow=evaluate('Item Class: Boots\nRarity: Rare\nSlow Pace\nStone Greaves\n--------\nArmour: 250\n--------\n+75 to maximum Life');
    expect(fast.categoryAnalysis!.categoryScore-slow.categoryAnalysis!.categoryScore).toBeGreaterThanOrEqual(20);
    expect(slow.categoryAnalysis?.warnings.join(' ')).toMatch(/major Boots weakness/i);
  });

  it('judges quivers by projectile offense and flags defensive affixes',()=>{
    const result=evaluate('Item Class: Quivers\nRarity: Rare\nStorm Flight\nBroadhead Quiver\n--------\n+2 to Level of all Projectile Skills\n15% increased Attack Speed\n+30% to Fire Resistance');
    expect(result.categoryAnalysis?.positiveStats.join(' ')).toMatch(/Projectile offensive power|Projectile Skill Levels/i);
    expect(result.categoryAnalysis?.weakOrWastedStats.join(' ')).toMatch(/Fire Resistance|Defensive modifier/i);
  });
});
