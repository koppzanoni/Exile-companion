import type { ItemCategory, ItemStats } from './types.js';

export const comparisonStatLabels:Record<string,string>={life:'maximum Life',mana:'maximum Mana',spirit:'Spirit',strength:'Strength',dexterity:'Dexterity',intelligence:'Intelligence',fireResistance:'Fire Resistance',coldResistance:'Cold Resistance',lightningResistance:'Lightning Resistance',chaosResistance:'Chaos Resistance',rarityFind:'item rarity',itemRarity:'item rarity tier',itemLevel:'item level',corrupted:'corrupted state',quality:'quality',movementSpeed:'movement speed',armour:'Armour',evasion:'Evasion',energyShield:'Energy Shield',deflection:'Deflection',runicWard:'Runic Ward',blockChance:'block chance',increasedBlockChance:'increased block chance',stunThreshold:'stun threshold',totalDps:'estimated total DPS',physicalDps:'physical DPS',elementalDps:'elemental DPS',attacksPerSecond:'attacks per second',criticalHitChance:'critical hit chance',flatDamage:'average flat damage',increasedPhysicalDamage:'increased physical damage',increasedElementalDamage:'increased elemental damage',projectileDamage:'projectile damage',spellDamage:'spell damage',skillLevels:'skill levels',accuracy:'accuracy',leech:'leech',attackSpeedBonus:'attack speed',castSpeed:'cast speed',criticalDamageBonus:'critical damage',lifeRegeneration:'life regeneration',manaRegeneration:'mana regeneration',flaskChargesGained:'flask charges gained',reducedFlaskChargesUsed:'reduced flask charges used',charmSlots:'Charm slots'};

const common=['life','mana','spirit','strength','dexterity','intelligence','fireResistance','coldResistance','lightningResistance','chaosResistance','rarityFind','itemLevel','quality'] as const;

export function calculateStatDeltas(candidate:ItemStats,equipped:ItemStats,category:ItemCategory){
  const candidateValues=statValues(candidate,category);const equippedValues=statValues(equipped,category);const deltas:Record<string,number>={};
  for(const key of new Set([...Object.keys(candidateValues),...Object.keys(equippedValues)])){const delta=round((candidateValues[key]||0)-(equippedValues[key]||0));if(delta)deltas[key]=delta;}
  if(Boolean(candidate.corrupted)!==Boolean(equipped.corrupted))deltas.corrupted=candidate.corrupted?1:-1;
  return deltas;
}

export function statValues(item:ItemStats,category:ItemCategory):Record<string,number>{
  const result:Record<string,number>={};for(const key of common)result[key]=Number(item[key]||0);
  result.itemRarity=rarityRank(item.rarity);
  const armourSlot=['body-armour','helmet','gloves','boots','shield','focus'].includes(category);
  if(armourSlot){result.armour=item.armour||0;result.evasion=item.evasion||0;result.energyShield=item.energyShield||0;result.deflection=item.deflection||0;result.runicWard=item.runicWard||0;}
  if(category==='boots')result.movementSpeed=item.movementSpeed||0;
  if(category==='shield'){result.blockChance=item.blockChance||0;result.increasedBlockChance=item.increasedBlockChance||0;result.stunThreshold=item.stunThreshold||0;}
  if(['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff'].includes(category)){const dps=weaponDps(item);Object.assign(result,dps);result.attacksPerSecond=item.attacksPerSecond||0;result.criticalHitChance=item.criticalHitChance||0;result.flatDamage=flatDamage(item);result.increasedPhysicalDamage=modTotal(item,/([+-]?\d+(?:\.\d+)?)% increased Physical Damage/gi);result.increasedElementalDamage=modTotal(item,/([+-]?\d+(?:\.\d+)?)% increased (?:Elemental|Fire|Cold|Lightning|Chaos) Damage/gi);result.projectileDamage=modTotal(item,/([+-]?\d+(?:\.\d+)?)% increased Projectile Damage/gi);result.accuracy=modTotal(item,/\+?(\d+(?:\.\d+)?) to Accuracy Rating/gi);result.leech=modTotal(item,/([+-]?\d+(?:\.\d+)?)% of .* Damage Leeched/gi);}
  if(['staff','wand','sceptre','focus'].includes(category)){result.spellDamage=item.spellDamage||modTotal(item,/([+-]?\d+(?:\.\d+)?)% increased Spell Damage/gi);result.castSpeed=item.castSpeed||0;result.criticalHitChance=item.criticalHitChance||0;}
  if(category==='quiver'){result.flatDamage=flatDamage(item);result.projectileDamage=modTotal(item,/([+-]?\d+(?:\.\d+)?)% increased Projectile Damage/gi);result.attackSpeedBonus=item.attackSpeedBonus||modTotal(item,/([+-]?\d+(?:\.\d+)?)% increased Attack Speed/gi);result.criticalDamageBonus=item.criticalDamageBonus||0;result.accuracy=modTotal(item,/\+?(\d+(?:\.\d+)?) to Accuracy Rating/gi);}
  if(['ring','amulet','belt','gloves'].includes(category)){result.flatDamage=flatDamage(item);result.attackSpeedBonus=item.attackSpeedBonus||0;result.castSpeed=item.castSpeed||0;result.criticalDamageBonus=item.criticalDamageBonus||0;result.spellDamage=item.spellDamage||0;}
  result.skillLevels=(item.projectileSkillLevels||0)+(item.meleeSkillLevels||0)+(item.spellSkillLevels||0)+(item.minionSkillLevels||0);
  result.lifeRegeneration=item.lifeRegeneration||0;result.manaRegeneration=item.manaRegeneration||0;result.flaskChargesGained=item.flaskChargesGained||0;result.reducedFlaskChargesUsed=item.reducedFlaskChargesUsed||0;result.charmSlots=item.charmSlots||0;
  return result;
}

export function weaponDps(item:ItemStats){const speed=item.attacksPerSecond||1;const physical=average(item.physicalDamageMin,item.physicalDamageMax)*speed;const elemental=(average(item.fireDamageMin,item.fireDamageMax)+average(item.coldDamageMin,item.coldDamageMax)+average(item.lightningDamageMin,item.lightningDamageMax)+average(item.chaosDamageMin,item.chaosDamageMax))*speed;return{physicalDps:round(physical),elementalDps:round(elemental),totalDps:round(physical+elemental)};}
export function formatDelta(key:string,value:number){const label=comparisonStatLabels[key]||key;const percent=/Resistance|speed|chance|damage|rarity|quality|leech|stun/i.test(label)&&!['estimated total DPS','physical DPS','elemental DPS','average flat damage'].includes(label);return`${value>0?'+':''}${round(value)}${percent?'%':''} ${label}`;}
function flatDamage(item:ItemStats){return round(average(item.physicalDamageMin,item.physicalDamageMax)+average(item.fireDamageMin,item.fireDamageMax)+average(item.coldDamageMin,item.coldDamageMax)+average(item.lightningDamageMin,item.lightningDamageMax)+average(item.chaosDamageMin,item.chaosDamageMax));}
function average(min?:number,max?:number){return min===undefined||max===undefined?0:(min+max)/2;}
function modTotal(item:ItemStats,pattern:RegExp){const text=`${item.rawText||''}\n${item.customMods.join('\n')}`;let total=0;for(const match of text.matchAll(pattern))total+=Number(match[1]||0);return total;}
const rarityRank=(rarity:ItemStats['rarity'])=>rarity==='unique'?4:rarity==='rare'?3:rarity==='magic'?2:rarity==='normal'?1:0;
const round=(value:number)=>Math.round(value*100)/100;
