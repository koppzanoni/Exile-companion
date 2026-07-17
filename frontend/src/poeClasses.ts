export interface PoeClassOption { name: string; ascendancies: readonly string[] }

// Keep this catalog separate from player profiles: a player can pick any class
// and ascendancy even before there is a curated default build profile for it.
export const poeClasses: readonly PoeClassOption[] = [
  { name: 'Warrior', ascendancies: ['Titan', 'Warbringer', 'Smith of Kitava'] },
  { name: 'Ranger', ascendancies: ['Deadeye', 'Pathfinder'] },
  { name: 'Sorceress', ascendancies: ['Stormweaver', 'Chronomancer', 'Disciple of Varashta'] },
  { name: 'Monk', ascendancies: ['Invoker', 'Acolyte of Chayula', 'Martial Artist'] },
  { name: 'Mercenary', ascendancies: ['Witchhunter', 'Gemling Legionnaire', 'Tactician'] },
  { name: 'Witch', ascendancies: ['Infernalist', 'Blood Mage', 'Lich'] },
  { name: 'Huntress', ascendancies: ['Amazon', 'Ritualist', 'Spirit Walker'] },
  { name: 'Druid', ascendancies: ['Shaman', 'Oracle'] },
] as const;

export interface RosterCatalogEntry {baseClass:string;playable:boolean;planned:boolean;ascendancies:Array<{name:string;alternate:boolean}>}
export interface RosterCatalog {patch:string;dataVersion:string;source:string;verifiedAt:string;confidence:'High'|'Medium'|'Low';limitations:string[];entries:RosterCatalogEntry[]}
export interface RosterResponse {catalog:RosterCatalog;status:'active'|'fallback';checksum:string}

export function rosterOptions(response?:RosterResponse|null):readonly PoeClassOption[]{
  if(!response?.catalog?.entries)return poeClasses;
  return response.catalog.entries.filter((entry)=>entry.playable).map((entry)=>({name:entry.baseClass,ascendancies:entry.ascendancies.filter((asc)=>!asc.alternate).map((asc)=>asc.name)}));
}

export function ascendanciesFor(className: string) {
  return poeClasses.find((entry) => entry.name === className)?.ascendancies ?? [];
}
export function ascendanciesForRoster(className:string,response?:RosterResponse|null){return rosterOptions(response).find((entry)=>entry.name===className)?.ascendancies??[];}
