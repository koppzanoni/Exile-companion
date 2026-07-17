import {describe,expect,it} from 'vitest';
import {parseEquipmentBundle} from './equipmentImport';

describe('equipment bundle import',()=>{
  it('maps explicit item classes and preserves ambiguous overflow as rejected',()=>{
    const text=['Boots','Rings','Rings','Rings','Jewel'].map((kind,index)=>`Item Class: ${kind}\nRarity: Rare\nItem ${index}\nBase`).join('\n');
    const result=parseEquipmentBundle(text);
    expect(result.equipment.map(item=>item.slot)).toEqual(['Boots','Ring 1','Ring 2']);
    expect(result.rejected).toEqual(expect.arrayContaining([expect.objectContaining({itemClass:'Rings'}),expect.objectContaining({itemClass:'Jewel'})]));
  });
});
