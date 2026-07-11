import {describe,expect,it} from 'vitest';import{ClipboardItemParser}from'./normalizedItemParser.js';
describe('normalized item parser',()=>{
  it('classifies plain-text modifiers against the modifier catalog and leaves the rest explicitly unknown',()=>{
    const item=new ClipboardItemParser().parseClipboard('Item Class: Boots\nRarity: Rare\nFleet Pace\nWrapped Boots\n--------\nQuality: +20%\nEvasion Rating: 420\n--------\nItem Level: 74\n--------\n+70 to maximum Life\n30% increased Movement Speed\nGrants a mysterious unlisted effect',{league:'Standard',patch:'0.5.4'});
    expect(item).toMatchObject({game:'poe2',league:'Standard',patch:'0.5.4',itemClass:'Boots',baseType:'Wrapped Boots',quality:20,baseDefences:{evasion:420}});
    expect(item.prefixes[0]).toMatchObject({group:'MaximumLife',local:false,confidence:'Medium'});
    expect(item.prefixes[0].tier).toBeUndefined();
    expect(item.suffixes[0]).toMatchObject({group:'MovementVelocity',local:false,confidence:'Medium'});
    expect(item.unknownModifiers.length).toBeGreaterThan(0);
    expect(item.unknownModifiers.every((mod)=>mod.confidence==='Low'&&mod.type==='unknown')).toBe(true);
  });
  it('normalizes advanced prefix data without inventing suffixes',()=>{
    const item=new ClipboardItemParser().parseClipboard('Item Class: Helmets\nRarity: Rare\nDire Dome\nAncestral Tiara\n--------\nItem Level: 81\n--------\n{ Prefix Modifier "Virile" (Tier: 3) — Life }\n+118(100-119) to maximum Life');
    expect(item.prefixes[0]).toMatchObject({group:'Virile',tier:3,actualRoll:118,minimumRoll:100,maximumRoll:119,rollPercentile:95,tags:['Life'],confidence:'High'});
    expect(item.suffixes).toEqual([]);
  });
  it('counts a hybrid prefix as a single affix, not two', () => {
    const item = new ClipboardItemParser().parseClipboard('Item Class: Amulets\nRarity: Rare\nTwin Coil\nGold Amulet\n--------\nItem Level: 80\n--------\n{ Prefix Modifier "Vital Reservoir" (Tier: 2) — Life, Mana }\n+40(35-45) to maximum Life\n+25(20-30) to maximum Mana');
    expect(item.prefixes).toHaveLength(1);
    expect(item.prefixes[0]).toMatchObject({ group: 'Vital Reservoir', hybrid: true, tags: ['Life', 'Mana'] });
    expect(item.suffixes).toEqual([]);
  });
  it('parses Deflection and Runic Ward into base defences instead of leaving them at zero', () => {
    const item = new ClipboardItemParser().parseClipboard('Item Class: Foci\nRarity: Rare\nWard Halo\nCrystal Focus\n--------\nEnergy Shield: 40\nDeflection: 120\nRunic Ward: 60\n--------\nItem Level: 78');
    expect(item.baseDefences).toMatchObject({ energyShield: 40, deflection: 120, runicWard: 60 });
  });
});
