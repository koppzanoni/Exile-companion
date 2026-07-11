import { describe, expect, it } from 'vitest';
import { parseItemText } from './itemParser.js';

const cases:Array<[string,string,string,string]>=[
  ['shield','Shields','Plate Shield','Chance to Block: 26%\nArmour: 500'],['focus','Foci','Attuned Focus','Energy Shield: 160\n--------\n60% increased Spell Damage'],
  ['quiver','Quivers','Broadhead Quiver','+2 to Level of all Projectile Skills'],['bow','Bows','Gemini Bow','Physical Damage: 100-220\nAttacks per Second: 1.50'],
  ['crossbow','Crossbows','Siege Crossbow','Physical Damage: 150-350\nAttacks per Second: 1.40'],['staff','Staves','Temple Staff','70% increased Spell Damage'],
  ['quarterstaff','Quarterstaves','Gothic Quarterstaff','Physical Damage: 120-240\nAttacks per Second: 1.55'],['boots','Boots','Stone Greaves','30% increased Movement Speed'],
  ['gloves','Gloves','Expert Linen Wraps','15% increased Attack Speed'],['helmet','Helmets','Ancestral Tiara','Energy Shield: 120'],
  ['body armour','Body Armours','Vile Robe','Energy Shield: 300'],['ring','Rings','Ruby Ring','+35% to Fire Resistance'],
  ['amulet','Amulets','Solar Amulet','+30 to Spirit'],['belt','Belts','Utility Belt','Has 2 Charm Slots'],
];

describe('category parser coverage',()=>{
  it.each(cases)('parses %s item class and normalized stats',(_name,itemClass,baseType,stats)=>{
    const parsed=parseItemText(`Item Class: ${itemClass}\nRarity: Rare\nTest Item\n${baseType}\n--------\n${stats}\n--------\nItem Level: 80`);
    expect(parsed.itemClass).toBe(itemClass);
    expect(parsed.baseType).toBe(baseType);
    expect(parsed.itemType).not.toBe('Other');
    expect(parsed.parsedLines?.some((row)=>row.fields.includes('itemClass'))).toBe(true);
    expect(parsed.parsedLines?.some((row)=>row.fields.includes('baseType'))).toBe(true);
  });

  it('maps advanced roll lines to normalized stats while preserving the original line',()=>{
    const parsed=parseItemText('Item Class: Helmets\nRarity: Rare\nDoom Crown\nAncestral Tiara\n--------\n+34(31-35)% to Cold Resistance');
    expect(parsed.coldResistance).toBe(34);
    expect(parsed.parsedLines).toEqual(expect.arrayContaining([expect.objectContaining({line:'+34(31-35)% to Cold Resistance',fields:['coldResistance'],values:[34]})]));
  });
});
