import { getCategoryKnowledge } from './itemCategoryKnowledge.js';
import type { CategoryDetection, ItemCategory, ItemCategoryInfo, ItemStats } from './types.js';

export function detectItemCategoryDetailed(item:ItemStats):CategoryDetection {
  const explicit=(item.itemClass||item.itemType||'').toLowerCase();
  const base=(item.baseType||'').toLowerCase();
  const combined=`${explicit} ${base}`;
  const explicitResult=fromText(explicit);
  if(explicitResult)return result(explicitResult,`The pasted Item Class (${item.itemClass||item.itemType}) maps directly to ${getCategoryKnowledge(explicitResult).info.label}.`,98,[`Item Class: ${item.itemClass||item.itemType}`]);
  const baseResult=fromText(base);
  if(baseResult)return result(baseResult,`The base type “${item.baseType}” contains a recognised ${getCategoryKnowledge(baseResult).info.label} base pattern.`,86,[`Base type: ${item.baseType}`]);
  const fallback=fromText(combined)||'other';
  return result(fallback,fallback==='other'?'Neither Item Class nor base type matched a supported category.':'Category inferred from combined type and base text.',fallback==='other'?25:70,[combined.trim()].filter(Boolean));
}

export function detectItemCategory(item:ItemStats):ItemCategoryInfo{return detectItemCategoryDetailed(item).category;}

function fromText(value:string):ItemCategory|undefined {
  if(!value)return undefined;
  if(/crossbows?|crossbow/.test(value))return'crossbow';
  if(/quarterstaves?|quarterstaff/.test(value))return'quarterstaff';
  if(/two[ -]?hand(?:ed)? (?:axes?|maces?|swords?|weapons?)|twohand/.test(value))return'two-handed-melee';
  if(/one[ -]?hand(?:ed)? (?:axes?|maces?|swords?|weapons?)|daggers?|flails?|spears?|onehand/.test(value))return'one-handed-melee';
  if(/body armou?r|robes?|raiments?|cuirasses?|(?:^| )vests?(?: |$)|coats?|plates?|mails?|garbs?|jackets?|mantles?/.test(value)&&!/shield/.test(value))return'body-armour';
  if(/boots?|greaves?|shoes?|slippers?|sabatons?|treads?/.test(value))return'boots';
  if(/helmets?|helms?|hoods?|crowns?|tiaras?|masks?|(?:^| )caps?(?: |$)/.test(value))return'helmet';
  if(/gloves?|gauntlets?|mitts?|wraps?/.test(value))return'gloves';
  if(/foci|focus/.test(value))return'focus';
  if(/quivers?/.test(value))return'quiver';
  if(/shields?|bucklers?/.test(value))return'shield';
  if(/amulets?/.test(value))return'amulet';
  if(/rings?/.test(value))return'ring';
  if(/belts?|sashes?|girdles?/.test(value))return'belt';
  if(/bows?/.test(value))return'bow';
  if(/wands?/.test(value))return'wand';
  if(/sceptres?/.test(value))return'sceptre';
  if(/(?:^| )staves?(?: |$)|(?:^| )staff(?: |$)/.test(value))return'staff';
  if(/axes?|maces?|swords?|melee weapon/.test(value))return/giant|great|two/.test(value)?'two-handed-melee':'one-handed-melee';
  return undefined;
}

function result(key:ItemCategory,reason:string,confidence:number,evidence:string[]):CategoryDetection{return{category:getCategoryKnowledge(key).info,reason,confidence,evidence};}
