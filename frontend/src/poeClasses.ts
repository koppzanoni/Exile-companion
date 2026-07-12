export interface PoeClassOption { name: string; ascendancies: readonly string[] }

// Keep this catalog separate from player profiles: a player can pick any class
// and ascendancy even before there is a curated default build profile for it.
export const poeClasses: readonly PoeClassOption[] = [
  { name: 'Warrior', ascendancies: ['Titan', 'Warbringer', 'Smith of Kitava'] },
  { name: 'Ranger', ascendancies: ['Deadeye', 'Pathfinder'] },
  { name: 'Sorceress', ascendancies: ['Stormweaver', 'Chronomancer', 'Disciple of Varashta'] },
  { name: 'Monk', ascendancies: ['Invoker', 'Acolyte of Chayula'] },
  { name: 'Mercenary', ascendancies: ['Witchhunter', 'Gemling Legionnaire', 'Tactician'] },
  { name: 'Witch', ascendancies: ['Infernalist', 'Blood Mage', 'Lich'] },
  { name: 'Huntress', ascendancies: ['Amazon', 'Ritualist'] },
  { name: 'Druid', ascendancies: ['Shaman', 'Oracle', 'Spirit Walker'] },
] as const;

export function ascendanciesFor(className: string) {
  return poeClasses.find((entry) => entry.name === className)?.ascendancies ?? [];
}
