import { weaponDps } from './statDelta.js';
import type { CraftingPotential, ItemCategory, ItemEvaluation, ItemStats } from './types.js';

export interface CraftingFacts {
  category:ItemCategory;categoryScore:number;buildFitScore:number;bestUseCase:string;
  missing:string[];wasted:string[];strongRolls:string[];weakRolls:string[];lowNumericRolls:string[];modCount:number;
  baseQuality:CraftingPotential['baseQuality'];rollQuality:CraftingPotential['rollQuality'];
}

export function analyzeCraftingRules(item:ItemStats,evaluation:ItemEvaluation):CraftingFacts{
  const category=evaluation.categoryAnalysis?.detectedCategory.key||evaluation.category?.key||'other';const categoryScore=evaluation.categoryAnalysis?.categoryScore??evaluation.score;const buildFitScore=evaluation.buildFitAnalysis?.score??evaluation.personalized?.score??0;
  const categoryMissing=evaluation.categoryAnalysis?.missingImportantStats||[];const buildMissing=craftRelevantBuildMissing(category,evaluation.buildFitAnalysis?.missingImportantStats||[]);const missing=unique([...categoryMissing,...buildMissing.slice(0,Math.max(0,2-categoryMissing.length))]);const wasted=unique([...(evaluation.categoryAnalysis?.weakOrWastedStats||[]),...(evaluation.buildFitAnalysis?.wastedStats||[])]);
  const insights=evaluation.knowledge?.rolls||[];const strongRolls=unique([...insights.filter((roll)=>roll.label==='high'||roll.label==='perfect').map((roll)=>rollName(roll.modifier,roll.tier)),...(evaluation.categoryAnalysis?.positiveStats||[]).filter((line)=>!/No category/i.test(line))]);
  const lowNumericRolls=insights.filter((roll)=>roll.label==='low'||roll.label==='average').map((roll)=>rollName(roll.modifier,roll.tier));const weakRolls=unique([...insights.filter((roll)=>roll.label==='low').map((roll)=>rollName(roll.modifier,roll.tier)),...wasted]);
  const baseQuality=assessBase(item,category,categoryScore);const rollQuality=assessRolls(item,category,strongRolls,weakRolls,missing,evaluation);
  return{category,categoryScore,buildFitScore,bestUseCase:evaluation.buildFitAnalysis?.bestUseCase||'niche',missing,wasted,strongRolls,weakRolls,lowNumericRolls,modCount:explicitModCount(item),baseQuality,rollQuality};
}

function assessBase(item:ItemStats,category:ItemCategory,categoryScore:number):CraftingPotential['baseQuality']{
  const reasons:string[]=[];let score=item.baseType?18:5;if(item.baseType)reasons.push(`Recognized ${item.baseType} base.`);
  const ilvl=item.itemLevel||0;if(ilvl>=82){score+=32;reasons.push(`Item level ${ilvl} supports premium affix tiers.`);}else if(ilvl>=75){score+=24;reasons.push(`Item level ${ilvl} is suitable for serious crafting.`);}else if(ilvl>=65){score+=15;reasons.push(`Item level ${ilvl} is usable but may exclude top affix tiers.`);}else if(ilvl){score+=4;reasons.push(`Item level ${ilvl} is mainly a progression base.`);}else reasons.push('Item level is unknown, so affix availability cannot be confirmed.');
  if((item.quality||0)>=20){score+=7;reasons.push(`${item.quality}% quality is already applied.`);}else if((item.quality||0)>0)score+=3;
  if(['body-armour','helmet','gloves','boots','shield','focus'].includes(category)){const local=(item.armour||0)+(item.evasion||0)+(item.energyShield||0)+(item.deflection||0)+(item.runicWard||0);if(local>=900){score+=20;reasons.push('Strong displayed local defence supports the base.');}else if(local>=400){score+=12;reasons.push('Useful displayed local defence.');}else if(local>0){score+=4;reasons.push('Displayed local defence is modest.');}}
  if(['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff'].includes(category)){const dps=weaponDps(item).totalDps;if(dps>=450){score+=22;reasons.push(`Strong displayed weapon base/output (~${Math.round(dps)} DPS).`);}else if(dps>=250){score+=13;reasons.push(`Usable displayed weapon output (~${Math.round(dps)} DPS).`);}else if(dps>0){score-=8;reasons.push(`Low displayed weapon output (~${Math.round(dps)} DPS) weakens the investment case.`);}}
  if(category==='shield'){if((item.blockChance||0)>=30){score+=12;reasons.push(`Strong ${item.blockChance}% block base.`);}else if(item.blockChance)reasons.push(`Low ${item.blockChance}% block weakens the base.`);}
  score+=Math.round(categoryScore*.12);score=clamp(score);return{score,label:score>=85?'Premium Base':score>=68?'Strong Base':score>=48?'Usable Base':score>=28?'Weak Base':'Poor Base',reasons:unique(reasons).slice(0,5)};
}

function assessRolls(item:ItemStats,category:ItemCategory,strong:string[],weak:string[],missing:string[],evaluation:ItemEvaluation):CraftingPotential['rollQuality']{
  let score=34+Math.min(35,strong.length*9)-Math.min(30,weak.length*9)-Math.min(30,missing.length*6);const text=`${item.rawText||''}\n${item.customMods.join('\n')}`;const res=resistanceTotal(item);
  if(category==='boots'){if((item.movementSpeed||0)>=30)score+=20;else if((item.movementSpeed||0)>=20)score+=8;else if(!(item.movementSpeed||0)){score-=32;if(!((item.life||0)>=90&&res>=90))score=Math.min(score,32);}if((item.life||0)>=70)score+=8;if(res>=50)score+=8;}
  if(['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff'].includes(category)){const dps=weaponDps(item).totalDps;const defensive=(item.customMods||[]).filter((line)=>/maximum Life|Resistance|increased Armour|increased Evasion|increased Energy Shield/i.test(line));if(dps<120){score-=35;score=Math.min(score,18);}else if(dps>=400)score+=18;score-=defensive.length*10;}
  if(['staff','wand','sceptre','focus'].includes(category)){if((item.spellDamage||0)>=50)score+=12;if((item.spellSkillLevels||0)+(item.minionSkillLevels||0)>=2)score+=15;if(!(item.spellDamage||0)&&!(item.spellSkillLevels||0)&&!(item.minionSkillLevels||0))score-=18;}
  if(category==='shield'){if((item.blockChance||0)>=30)score+=15;else score-=15;if((item.life||0)>=70)score+=10;if(res>=50)score+=8;}
  if(category==='quiver'){const signals=[/Projectile Damage/i,/Adds .* Damage/i,/Attack Speed/i,/Critical/i,/Accuracy/i].filter((rule)=>rule.test(text)).length;score+=signals*9;if(signals===0)score-=28;}
  if(category==='body-armour'){const local=(item.armour||0)+(item.evasion||0)+(item.energyShield||0)+(item.deflection||0)+(item.runicWard||0);if(local>=900)score+=15;else if(local<300)score-=18;if((item.life||0)>=80)score+=10;if(res>=50)score+=7;}
  if(['ring','amulet','belt'].includes(category)){const attrs=(item.strength||0)+(item.dexterity||0)+(item.intelligence||0);if((item.life||0)>=60)score+=9;if(res>=60)score+=12;if(attrs>=40)score+=8;if(/Damage|level of .* skills|Spirit/i.test(text))score+=10;if(strong.length===0&&res<30&&attrs<20)score-=18;}
  score=clamp(score);return{score,label:score>=82?'Excellent Rolls':score>=65?'Strong Rolls':score>=45?'Mixed Rolls':score>=25?'Weak Rolls':'Poor Rolls',strongRolls:strong.slice(0,8),weakRolls:weak.slice(0,8),missingRolls:missing.slice(0,8)};
}

const explicitModCount=(item:ItemStats)=>unique(item.customMods.map((line)=>line.trim()).filter(Boolean)).length;
function craftRelevantBuildMissing(category:ItemCategory,values:string[]){const irrelevant:Partial<Record<ItemCategory,RegExp>>={ring:/evasion|armour|energy shield|movement speed|block/i,amulet:/evasion|armour|movement speed|block/i,belt:/evasion|energy shield|movement speed|block|attack speed|accuracy/i,quiver:/life|resistance|armour|evasion|energy shield|block/i,bow:/life|resistance|armour|evasion|energy shield|block/i,crossbow:/life|resistance|armour|evasion|energy shield|block/i,'one-handed-melee':/life|resistance|armour|evasion|energy shield|block/i,'two-handed-melee':/life|resistance|armour|evasion|energy shield|block/i,quarterstaff:/life|resistance|armour|evasion|energy shield|block/i};const rule=irrelevant[category];return unique(values.filter((value)=>!rule?.test(value)));}
const resistanceTotal=(item:ItemStats)=>(item.fireResistance||0)+(item.coldResistance||0)+(item.lightningResistance||0)+(item.chaosResistance||0);
const rollName=(modifier:string,tier?:number)=>`${tier?`T${tier} `:''}${modifier.replace(/\([^)]*\)/g,'').trim()}`;
const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));const unique=<T>(values:T[])=>[...new Set(values)];
