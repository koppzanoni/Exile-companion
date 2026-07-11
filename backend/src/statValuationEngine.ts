import type { BuildFitProfile, BuildStat, ItemCategory, ItemStats } from './types.js';

export interface StatValuationContext {
  slot:ItemCategory;critical:boolean;damageTags:string[];
  current:{life?:number;mana?:number;spirit?:number;fireResistance?:number;coldResistance?:number;lightningResistance?:number;chaosResistance?:number;strength?:number;dexterity?:number;intelligence?:number};
  requirements?:Partial<Record<'spirit'|'strength'|'dexterity'|'intelligence',number>>;
  caps?:Partial<Record<'fireResistance'|'coldResistance'|'lightningResistance'|'chaosResistance',number>>;
  buildWeight?:Partial<Record<string,number>>;
  slotWeight?:Partial<Record<string,number>>;
}
export interface StatContribution {
  stat:string;value:number;score:number;category:'offence'|'defence'|'utility';reason:string;conditional:boolean;wasted:boolean;
  source:'parsed'|'derived';local:boolean;tier?:number;
  buildWeight:number;slotWeight:number;
  effectiveBeforeCap:number;effectiveAfterCap:number;
  offenceContribution:number;defenceContribution:number;utilityContribution:number;requirementContribution:number;
}
export interface StatValuation {offenceScore:number;defenceScore:number;utilityScore:number;overallScore:number;contributions:StatContribution[];warnings:string[]}

const DEFAULT_WEIGHT=1;

export function valueItemStats(item:ItemStats,context:StatValuationContext):StatValuation{
  const contributions:StatContribution[]=[];const warnings:string[]=[];
  const weightFor=(stat:string)=>context.buildWeight?.[stat]??DEFAULT_WEIGHT;
  const slotWeightFor=(stat:string)=>context.slotWeight?.[stat]??DEFAULT_WEIGHT;
  const add=(entry:Omit<StatContribution,'buildWeight'|'slotWeight'|'offenceContribution'|'defenceContribution'|'utilityContribution'|'requirementContribution'>&{requirementDriven?:boolean})=>{
    const buildWeight=weightFor(entry.stat);const slotWeight=slotWeightFor(entry.stat);
    const requirementDriven=Boolean(entry.requirementDriven);
    contributions.push({
      ...entry,buildWeight,slotWeight,
      offenceContribution:entry.category==='offence'?entry.score:0,
      defenceContribution:entry.category==='defence'?entry.score:0,
      utilityContribution:entry.category==='utility'&&!requirementDriven?entry.score:0,
      requirementContribution:requirementDriven?entry.score:0,
    });
  };
  const diminishing=(value:number,target:number)=>Math.round(100*(1-Math.exp(-Math.max(0,value)/Math.max(1,target))));

  if(item.life)add({stat:'Maximum Life',value:item.life,score:diminishing(item.life,65),category:'defence',reason:'Increases the life pool with diminishing returns at high rolls.',conditional:false,wasted:false,source:'parsed',local:false,effectiveBeforeCap:item.life,effectiveAfterCap:item.life});

  const localDefences:Array<[keyof ItemStats,string,number]>=[['armour','Armour',450],['evasion','Evasion',450],['energyShield','Energy Shield',220],['deflection','Deflection',220],['runicWard','Runic Ward',150]];
  for(const[key,label,target]of localDefences){
    const value=item[key]as number|undefined;if(!value)continue;
    add({stat:label,value,score:diminishing(value,target),category:'defence',reason:`Local defensive value on this item's own base (${label.toLowerCase()} is not shared across the character).`,conditional:false,wasted:false,source:'parsed',local:true,effectiveBeforeCap:value,effectiveAfterCap:value});
  }

  for(const stat of ['fireResistance','coldResistance','lightningResistance','chaosResistance'] as const){
    const value=item[stat]||0;if(!value)continue;
    const cap=context.caps?.[stat]??(stat==='chaosResistance'?75:75);
    const current=context.current[stat]||0;
    const needed=Math.max(0,cap-current);
    const useful=Math.min(value,needed);
    const score=needed===0?5:Math.round(100*useful/Math.max(1,Math.min(needed,35)));
    const wasted=value>useful;
    add({stat,value,score:Math.min(100,score),category:'defence',reason:wasted?`${useful}% helps reach the cap; ${value-useful}% is currently over cap.`:`Closes ${useful}% of the resistance gap.`,conditional:true,wasted,source:'parsed',local:false,effectiveBeforeCap:value,effectiveAfterCap:useful});
  }

  for(const stat of ['strength','dexterity','intelligence','spirit'] as const){
    const value=item[stat]||0;if(!value)continue;
    const requirement=context.requirements?.[stat];
    const current=context.current[stat]||0;
    const gap=requirement?Math.max(0,requirement-current):0;
    const solves=requirement?Math.min(value,gap):0;
    const score=requirement?(gap===0?10:Math.min(100,Math.round(100*solves/Math.max(1,gap)))):diminishing(value,35);
    add({stat,value,score,category:'utility',reason:requirement?(gap===0?'Requirement is already met; this value is mostly surplus.':solves>=gap?'Reaches the required breakpoint.':`Still ${gap-solves} short of the required breakpoint.`):'Provides general requirement flexibility.',conditional:Boolean(requirement),wasted:Boolean(requirement&&gap===0),source:'parsed',local:false,effectiveBeforeCap:value,effectiveAfterCap:value,requirementDriven:Boolean(requirement)});
  }

  const text=(item.customMods||[]).join('\n');
  const crit=Number(text.match(/(\d+)% increased Critical/i)?.[1]||item.criticalDamageBonus||0);
  if(crit)add({stat:'Critical scaling',value:crit,score:context.critical?diminishing(crit,30):0,category:'offence',reason:context.critical?'Scales the selected critical build.':'The selected build is non-critical.',conditional:true,wasted:!context.critical,source:'parsed',local:true,effectiveBeforeCap:crit,effectiveAfterCap:context.critical?crit:0});

  const physical=avg(item.physicalDamageMin,item.physicalDamageMax)*(item.attacksPerSecond||1);
  const elemental=(avg(item.fireDamageMin,item.fireDamageMax)+avg(item.coldDamageMin,item.coldDamageMax)+avg(item.lightningDamageMin,item.lightningDamageMax))*(item.attacksPerSecond||1);
  if(physical){const matches=context.damageTags.some((tag)=>/physical/i.test(tag));add({stat:'Physical DPS',value:physical,score:diminishing(physical,250),category:'offence',reason:matches?'Matches the build damage source.':'Physical damage is not a primary selected tag.',conditional:true,wasted:!matches,source:'parsed',local:true,effectiveBeforeCap:physical,effectiveAfterCap:physical});}
  if(elemental){const matches=context.damageTags.some((tag)=>/cold|fire|lightning|elemental/i.test(tag));add({stat:'Elemental DPS',value:elemental,score:diminishing(elemental,220),category:'offence',reason:matches?'Matches the build damage tags.':'Elemental damage is not a selected damage source.',conditional:true,wasted:!matches,source:'parsed',local:true,effectiveBeforeCap:elemental,effectiveAfterCap:elemental});}

  const score=(category:StatContribution['category'])=>weightedAverage(contributions.filter((entry)=>entry.category===category&&!entry.wasted));
  const offenceScore=score('offence'),defenceScore=score('defence'),utilityScore=score('utility');
  const groups=[offenceScore,defenceScore,utilityScore].filter((value)=>value>0);
  if(!contributions.length)warnings.push('No supported numeric stats were available for valuation.');
  return{offenceScore,defenceScore,utilityScore,overallScore:groups.length?Math.round(groups.reduce((a,b)=>a+b,0)/groups.length):0,contributions,warnings};
}
const avg=(min?:number,max?:number)=>min===undefined||max===undefined?0:(min+max)/2;
const weightedAverage=(rows:StatContribution[])=>rows.length?Math.round(rows.reduce((sum,row)=>sum+row.score,0)/rows.length):0;

const statLabelAliases:Record<string,BuildStat>={'Maximum Life':'life','Physical DPS':'physicalDps','Elemental DPS':'elementalDps','Critical scaling':'criticalHitChance'};
const levelWeight:Record<'required'|'high'|'useful',number>={required:3,high:2,useful:1};

export function deriveBuildWeights(build:BuildFitProfile):Partial<Record<string,number>>{
  const byStat:Partial<Record<string,number>>={};
  for(const priority of build.priorities)byStat[priority.stat]=Math.max(byStat[priority.stat]||0,levelWeight[priority.level]);
  const result:Partial<Record<string,number>>={...byStat};
  for(const[label,stat]of Object.entries(statLabelAliases))if(byStat[stat]!==undefined)result[label]=byStat[stat];
  return result;
}

const slotWeightNeedles:Record<string,string>={life:'life',fireResistance:'fire resistance',coldResistance:'cold resistance',lightningResistance:'lightning resistance',chaosResistance:'chaos resistance',strength:'strength',dexterity:'dexterity',intelligence:'intelligence',spirit:'spirit','Maximum Life':'life','Physical DPS':'physical damage','Elemental DPS':'elemental damage','Critical scaling':'critical'};

export function deriveSlotWeights(build:BuildFitProfile,slot:ItemCategory):Partial<Record<string,number>>{
  const phrases=(build.categoryPriorities[slot]||[]).map((phrase)=>phrase.toLowerCase());
  if(!phrases.length)return{};
  const result:Partial<Record<string,number>>={};
  for(const[key,needle]of Object.entries(slotWeightNeedles))if(phrases.some((phrase)=>phrase.includes(needle)))result[key]=2;
  return result;
}

export function deriveDamageTags(build:BuildFitProfile):string[]{return build.damageTypes;}
export function deriveCritical(build:BuildFitProfile):boolean{return/critical/i.test([...build.offensiveStats,...build.priorities.map((p)=>p.stat)].join(' '));}
