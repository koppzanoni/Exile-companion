import { priorityLabels } from './quality.js';
import type { BuildFitProfile, BuildPriority, ItemCategory } from './types.js';

const offensivePriorityStats=new Set(['attacksPerSecond','criticalHitChance','physicalDps','elementalDps']);
const defensivePriorityStats=new Set(['life','energyShield','armour','evasion','fireResistance','coldResistance','lightningResistance','chaosResistance']);
const attributePriorityStats=new Set(['strength','dexterity','intelligence']);

export function bucketPriorities(priorities:BuildPriority[]){
  const offensiveStats:string[]=[];const defensiveStats:string[]=[];const attributes:string[]=[];const utilityStats:string[]=[];
  for(const priority of priorities){
    const label=priorityLabels[priority.stat];
    if(offensivePriorityStats.has(priority.stat))offensiveStats.push(label);
    else if(defensivePriorityStats.has(priority.stat))defensiveStats.push(label);
    else if(attributePriorityStats.has(priority.stat))attributes.push(label);
    else utilityStats.push(label);
  }
  return{offensiveStats,defensiveStats,attributes,utilityStats};
}

export interface LegacyBuildProfileInput {
  name:string;className:string;ascendancy?:string;mainSkill?:string;guideUrl?:string;
  stage:BuildFitProfile['stage'];evaluationStyle?:BuildFitProfile['evaluationStyle'];defenceStyle:BuildFitProfile['defenceStyle'];
  priorities:BuildPriority[];requiredMods:string[];desiredMods:string[];notes?:string;
}

export function createBuildProfileFromPriorities(id:string,input:LegacyBuildProfileInput):BuildFitProfile{
  const buckets=bucketPriorities(input.priorities);
  const defensiveLayers=input.defenceStyle==='energy-shield'?['energy shield']:input.defenceStyle==='life-armour'?['armour','life']:input.defenceStyle==='life-evasion'?['evasion','life']:input.defenceStyle==='hybrid'?['armour','evasion','energy shield','life']:['life'];
  return{
    id,source:'custom',name:input.name,className:input.className,ascendancy:input.ascendancy||'',mainSkill:input.mainSkill||'',
    guideUrl:input.guideUrl||'',stage:input.stage,evaluationStyle:input.evaluationStyle||'balanced',defenceStyle:input.defenceStyle,
    priorities:input.priorities,requiredMods:input.requiredMods,desiredMods:input.desiredMods,
    preferredWeaponTypes:[],damageTypes:[],defensiveLayers,
    offensiveStats:buckets.offensiveStats,defensiveStats:buckets.defensiveStats,attributes:buckets.attributes,utilityStats:buckets.utilityStats,
    wastedStats:[],valuableSlots:[],categoryPriorities:{},
    explanationRules:[`Scores from ${input.priorities.length} weighted stat priorities and ${input.requiredMods.length+input.desiredMods.length} modifier phrases.`],
    notes:input.notes||'',
  };
}

const weapons={bow:['bow'] as ItemCategory[],crossbow:['crossbow'] as ItemCategory[],quarterstaff:['quarterstaff'] as ItemCategory[],caster:['wand','staff','focus'] as ItemCategory[],minion:['sceptre','wand','staff'] as ItemCategory[],melee:['one-handed-melee','two-handed-melee','quarterstaff'] as ItemCategory[]};
const armourSlots:ItemCategory[]=['body-armour','helmet','gloves','boots','shield','ring','amulet','belt'];
const projectileSlots:ItemCategory[]=['bow','crossbow','quiver','gloves','ring','amulet'];
const casterSlots:ItemCategory[]=['wand','staff','focus','helmet','gloves','ring','amulet'];

function defenceStyleFor(defensiveLayers:string[]):BuildFitProfile['defenceStyle']{
  const has=(pattern:RegExp)=>defensiveLayers.some((layer)=>pattern.test(layer));
  const es=has(/energy shield/i),armour=has(/armour/i),evasion=has(/evasion/i);
  if(es&&(armour||evasion))return'hybrid';
  if(es)return'energy-shield';
  if(armour&&evasion)return'hybrid';
  if(armour)return'life-armour';
  if(evasion)return'life-evasion';
  return'custom';
}

function profile(id:string,name:string,className:string,ascendancy:string,mainSkill:string,preferredWeaponTypes:ItemCategory[],damageTypes:string[],defensiveLayers:string[],offensiveStats:string[],defensiveStats:string[],attributes:string[],utilityStats:string[],wastedStats:string[],valuableSlots:ItemCategory[],categoryPriorities:BuildFitProfile['categoryPriorities'],notes=''):BuildFitProfile{
  return{id,source:'default',name,className,ascendancy,mainSkill,stage:'endgame',evaluationStyle:'balanced',defenceStyle:defenceStyleFor(defensiveLayers),priorities:[],requiredMods:[],desiredMods:[],preferredWeaponTypes,damageTypes,defensiveLayers,offensiveStats,defensiveStats,attributes,utilityStats,wastedStats,valuableSlots,categoryPriorities,explanationRules:[`Prefer ${preferredWeaponTypes.join(', ')||'slot-appropriate bases'}`,`Scale ${damageTypes.join(' and ')||'general damage'}`,`Defend with ${defensiveLayers.join(' and ')}`],notes};
}

export const genericBuildFitProfile:BuildFitProfile={id:'generic-build-fit',source:'generic',name:'Generic Build Fit',className:'Any',mainSkill:'General usefulness',stage:'endgame',evaluationStyle:'balanced',defenceStyle:'hybrid',priorities:[],requiredMods:[],desiredMods:[],preferredWeaponTypes:[],damageTypes:['coherent damage'],defensiveLayers:['life','resistances'],offensiveStats:['weapon damage','attack speed','spell damage','cast speed','critical'],defensiveStats:['life','resistances','armour','evasion','energy shield'],attributes:['strength','dexterity','intelligence'],utilityStats:['movement speed','mana','spirit'],wastedStats:[],valuableSlots:[],categoryPriorities:{},explanationRules:['Uses general category and market usefulness because no specific build was selected.']};

export const defaultBuildProfiles:BuildFitProfile[]=[
  profile('ice-shot-deadeye','Ice Shot Deadeye','Ranger','Deadeye','Ice Shot',weapons.bow,['cold','projectile'],['evasion','life'],['projectile damage','added cold damage','attack speed','critical','accuracy'],['life','evasion','resistances'],['dexterity'],['movement speed','mana','skill levels'],['minion stats','spell damage','cast speed'],projectileSlots,{bow:['added cold damage','attack speed','critical'],quiver:['projectile damage','added cold damage','attack speed'],boots:['movement speed']}),
  profile('lightning-arrow-deadeye','Lightning Arrow Deadeye','Ranger','Deadeye','Lightning Arrow',weapons.bow,['lightning','projectile'],['evasion','life'],['projectile damage','added lightning damage','attack speed','critical','accuracy'],['life','evasion','resistances'],['dexterity'],['movement speed','mana','skill levels'],['minion stats','spell damage'],projectileSlots,{bow:['added lightning damage','attack speed'],quiver:['projectile damage','critical'],boots:['movement speed']}),
  profile('crossbow-mercenary','Crossbow Mercenary','Mercenary','','Crossbow Skills',weapons.crossbow,['physical','projectile'],['armour','life'],['weapon damage','physical damage','attack speed','projectile damage','accuracy','critical'],['life','armour','resistances'],['strength','dexterity'],['reload','leech','movement speed'],['spell damage','cast speed','minion stats'],['crossbow','quiver','gloves','boots'],{crossbow:['physical damage','attack speed','accuracy'],gloves:['attack speed','accuracy']}),
  profile('lightning-monk','Lightning Monk','Monk','','Tempest Flurry',weapons.quarterstaff,['lightning','melee'],['evasion','energy shield'],['added lightning damage','attack speed','critical','melee damage'],['life','evasion','energy shield','resistances'],['dexterity','intelligence'],['movement speed','mana','skill levels'],['minion stats','projectile damage'],['quarterstaff','gloves','boots','amulet'],{quarterstaff:['added lightning damage','attack speed','critical'],gloves:['attack speed'],boots:['movement speed']}),
  profile('quarterstaff-monk','Quarterstaff Monk','Monk','','Quarterstaff Skills',weapons.quarterstaff,['physical','melee'],['evasion','energy shield'],['weapon damage','physical damage','attack speed','critical','melee damage'],['life','evasion','energy shield','resistances'],['dexterity','intelligence'],['movement speed','leech','skill levels'],['minion stats','spell damage'],['quarterstaff','gloves','boots'],{quarterstaff:['weapon damage','attack speed'],gloves:['attack speed']}),
  profile('minion-witch','Minion Witch','Witch','','Minion Army',weapons.minion,['minion'],['energy shield','life'],['minion damage','minion skill levels','skill levels'],['life','energy shield','resistances'],['intelligence'],['spirit','mana','movement speed'],['attack speed','accuracy','projectile damage'],['sceptre','wand','staff','focus','helmet','amulet','body-armour'],{sceptre:['spirit','minion skill levels'],focus:['minion skill levels','energy shield'],amulet:['skill levels','spirit']}),
  profile('cold-caster','Cold Caster','Sorceress','','Cold Spells',weapons.caster,['cold','spell'],['energy shield','mana'],['spell damage','cold damage','cast speed','critical','skill levels'],['energy shield','life','resistances'],['intelligence'],['mana','movement speed'],['attack damage','accuracy','minion stats'],casterSlots,{wand:['spell damage','cast speed','skill levels'],staff:['spell damage','skill levels'],focus:['energy shield','spell damage']}),
  profile('fire-caster','Fire Caster','Sorceress','','Fire Spells',weapons.caster,['fire','spell'],['energy shield','mana'],['spell damage','fire damage','cast speed','critical','skill levels'],['energy shield','life','resistances'],['intelligence'],['mana','movement speed'],['attack damage','accuracy','minion stats'],casterSlots,{wand:['spell damage','cast speed'],focus:['energy shield','spell damage']}),
  profile('lightning-caster','Lightning Caster','Sorceress','','Lightning Spells',weapons.caster,['lightning','spell'],['energy shield','mana'],['spell damage','lightning damage','cast speed','critical','skill levels'],['energy shield','life','resistances'],['intelligence'],['mana','movement speed'],['attack damage','accuracy','minion stats'],casterSlots,{wand:['spell damage','cast speed'],focus:['energy shield','spell damage']}),
  profile('armour-life-warrior','Armour/Life Warrior','Warrior','','Melee Skills',weapons.melee,['physical','melee'],['armour','life'],['weapon damage','physical damage','attack speed','melee damage','stun'],['life','armour','resistances','stun threshold'],['strength'],['leech','movement speed'],['spell damage','cast speed','minion stats'],[...weapons.melee,...armourSlots],{'body-armour':['armour','life'],shield:['block','armour'],boots:['movement speed'],helmet:['life','armour']}),
  profile('evasion-ranger','Evasion Ranger','Ranger','','Projectile Attacks',weapons.bow,['projectile'],['evasion','life'],['projectile damage','attack speed','critical','accuracy'],['life','evasion','resistances'],['dexterity'],['movement speed','mana'],['minion stats','spell damage'],projectileSlots,{bow:['weapon damage','attack speed'],quiver:['projectile damage'],boots:['movement speed']}),
  profile('energy-shield-caster','Energy Shield Caster','Sorceress','','Spells',weapons.caster,['spell'],['energy shield','mana'],['spell damage','cast speed','critical','skill levels'],['energy shield','resistances'],['intelligence'],['mana','movement speed'],['attack damage','accuracy'],casterSlots,{focus:['energy shield','spell damage'],helmet:['energy shield'],'body-armour':['energy shield']}),
  profile('generic-melee','Generic Melee','Any','','Melee Attack',weapons.melee,['physical','melee'],['life'],['weapon damage','physical damage','attack speed','critical','melee damage'],['life','resistances'],['strength','dexterity'],['leech','movement speed'],['spell damage','minion stats'],weapons.melee,{}),
  profile('generic-projectile-attack','Generic Projectile Attack','Any','','Projectile Attack',[...weapons.bow,...weapons.crossbow],['projectile'],['life','evasion'],['weapon damage','projectile damage','attack speed','critical','accuracy'],['life','resistances','evasion'],['dexterity'],['movement speed'],['spell damage','minion stats'],projectileSlots,{}),
  profile('generic-spell-caster','Generic Spell Caster','Any','','Spell',weapons.caster,['spell'],['energy shield','mana'],['spell damage','cast speed','critical','skill levels'],['energy shield','life','resistances'],['intelligence'],['mana','movement speed'],['attack damage','accuracy'],casterSlots,{}),
  profile('generic-minion','Generic Minion','Any','','Minions',weapons.minion,['minion'],['life','energy shield'],['minion damage','minion skill levels','skill levels'],['life','energy shield','resistances'],['intelligence'],['spirit','mana'],['attack damage','accuracy'],['sceptre','wand','staff','focus','amulet'],{}),
  profile('generic-defensive-leveling','Generic Defensive Leveling','Any','','Leveling',[],['general'],['life','armour','evasion','energy shield'],[],['life','resistances','armour','evasion','energy shield'],['strength','dexterity','intelligence'],['movement speed','mana'],['rarity'],armourSlots,{boots:['movement speed'],'body-armour':['life','defence'],helmet:['life','resistances']}),
];

export function allCodeProfiles(){return[genericBuildFitProfile,...defaultBuildProfiles];}
export function findDefaultBuildProfile(idOrName:string){const value=idOrName.toLowerCase();return allCodeProfiles().find((entry)=>entry.id===value||entry.name.toLowerCase()===value);}

export interface CustomBuildProfileInput {name:string;mainSkill:string;className:string;ascendancy?:string;weaponType?:ItemCategory;mainDamageType:string;defensiveLayer:string;importantStats:string[];badStats:string[];notes?:string;}
export function createCustomBuildProfile(id:number,input:CustomBuildProfileInput):BuildFitProfile {
  const defensive=input.importantStats.filter((stat)=>/life|resistance|armour|evasion|energy shield|stun threshold/i.test(stat));
  const attributes=input.importantStats.filter((stat)=>/strength|dexterity|intelligence/i.test(stat));
  const utility=input.importantStats.filter((stat)=>/movement|mana|spirit|leech|reload|rarity/i.test(stat));
  const offensive=input.importantStats.filter((stat)=>!defensive.includes(stat)&&!attributes.includes(stat)&&!utility.includes(stat));
  return{id:`custom:${id}`,source:'custom',name:input.name,className:input.className,ascendancy:input.ascendancy||'',mainSkill:input.mainSkill,stage:'endgame',evaluationStyle:'balanced',defenceStyle:defenceStyleFor([input.defensiveLayer]),priorities:[],requiredMods:[],desiredMods:[],preferredWeaponTypes:input.weaponType?[input.weaponType]:[],damageTypes:[input.mainDamageType].filter(Boolean),defensiveLayers:[input.defensiveLayer].filter(Boolean),offensiveStats:offensive,defensiveStats:defensive,attributes,utilityStats:utility,wastedStats:input.badStats,valuableSlots:input.weaponType?[input.weaponType]:[],categoryPriorities:{},explanationRules:[input.notes||`Custom priorities for ${input.name}`],notes:input.notes||''};
}
