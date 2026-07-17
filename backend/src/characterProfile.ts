import {z} from 'zod';
import type {PoeNinjaCharacterProfile} from './poeNinjaProfile.js';

export const catalogManifestSchema=z.object({kind:z.enum(['passive-tree','quests','ascendancy']),patch:z.string().min(1),version:z.string().min(1),source:z.string().url(),updatedAt:z.string().datetime(),confidence:z.enum(['High','Medium','Low']),payload:z.unknown()});
export type CatalogManifest=z.infer<typeof catalogManifestSchema>;

export const builtInCatalogs:CatalogManifest[]=[{
  kind:'passive-tree',patch:'0.5',version:'PassiveTree-0.5',
  source:'https://github.com/grindinggear/poe2-skilltree-export',
  updatedAt:'2026-05-26T00:00:00.000Z',confidence:'High',
  payload:{delivery:'/data/passive-tree-0.5.json',scope:'topology, node names, categories and descriptions'}
}];

export function resolveCatalog(catalogs:CatalogManifest[],kind:CatalogManifest['kind'],version:string){
  const exact=catalogs.find(catalog=>catalog.kind===kind&&(catalog.version===version||catalog.patch===version));
  return exact?{status:'supported' as const,catalog:exact}:{status:'unsupported' as const,catalog:null,reason:`No validated ${kind} catalog exactly matches ${version}.`};
}

export interface ProfileDiagnostic{severity:'critical'|'warning'|'info';category:string;message:string;evidence:string;confidence:'High'|'Medium'}
export function diagnosePublicProfile(profile:PoeNinjaCharacterProfile):ProfileDiagnostic[]{
  const result:ProfileDiagnostic[]=[];
  const stat=(key:string)=>profile.stats[key];
  for(const [key,label] of [['fireResistance','Fire'],['coldResistance','Cold'],['lightningResistance','Lightning']] as const){const value=stat(key);if(value!==null&&value<75)result.push({severity:value<50?'critical':'warning',category:'resistance',message:`${label} resistance is ${value}%.`,evidence:`Imported public profile reports ${key}=${value}.`,confidence:'High'});}
  const chaos=stat('chaosResistance');if(chaos!==null&&chaos<0)result.push({severity:'warning',category:'resistance',message:`Chaos resistance is ${chaos}%.`,evidence:'Imported public defensive stats.',confidence:'High'});
  if(profile.passives.nodeIds.length!==profile.passives.allocated+profile.passives.ascendancyPoints)result.push({severity:'info',category:'passives',message:'Allocated node ids and reported point counters differ.',evidence:`${profile.passives.nodeIds.length} ids; ${profile.passives.allocated} passives; ${profile.passives.ascendancyPoints} ascendancy points. Some ids may be starting or special nodes.`,confidence:'Medium'});
  if(profile.questRewards.missingCount===null)result.push({severity:'info',category:'quests',message:'Missing quest rewards are not evaluated for this tree version.',evidence:profile.questRewards.coverageNote,confidence:'High'});
  for(const skill of profile.skills)if(skill.supports.length===0)result.push({severity:'info',category:'skills',message:`${skill.name} has no linked supports in the public snapshot.`,evidence:'Public skill-group data; inherent or granted skills may legitimately have no supports.',confidence:'Medium'});
  return result;
}

export function compareProfiles(before:PoeNinjaCharacterProfile,after:PoeNinjaCharacterProfile){
  const statKeys=[...new Set([...Object.keys(before.stats),...Object.keys(after.stats)])];
  return{before:{importedAt:before.importedAt,updatedAt:before.updatedAt},after:{importedAt:after.importedAt,updatedAt:after.updatedAt},stats:statKeys.flatMap(key=>{const from=before.stats[key],to=after.stats[key];return typeof from==='number'&&typeof to==='number'&&from!==to?[{key,before:from,after:to,delta:to-from}]:[]}),passives:{before:before.passives.allocated,after:after.passives.allocated,delta:after.passives.allocated-before.passives.allocated,added:after.passives.nodeIds.filter(id=>!before.passives.nodeIds.includes(id)),removed:before.passives.nodeIds.filter(id=>!after.passives.nodeIds.includes(id))},skills:{added:after.skills.map(x=>x.name).filter(name=>!before.skills.some(x=>x.name===name)),removed:before.skills.map(x=>x.name).filter(name=>!after.skills.some(x=>x.name===name))},quests:{added:after.questRewards.claimed.filter(x=>!before.questRewards.claimed.includes(x)),removed:before.questRewards.claimed.filter(x=>!after.questRewards.claimed.includes(x))},equipmentCount:{before:before.equipmentCount,after:after.equipmentCount,delta:after.equipmentCount-before.equipmentCount}};
}
