import type { CategoryKnowledge } from './itemCategoryKnowledge.js';
import type { ItemEvaluation, ItemStats } from './types.js';

export interface CategoryScoreBreakdown {
  score:number;
  positiveStats:string[];
  weakOrWastedStats:string[];
  missingImportantStats:string[];
  marketRelevantStats:string[];
  buildRelevantStats:string[];
}

export function scoreForCategory(item:ItemStats,knowledge:CategoryKnowledge,evaluation:ItemEvaluation):CategoryScoreBreakdown {
  const text=`${item.rawText||''}\n${(item.customMods||[]).join('\n')}`;
  const importantMatches=knowledge.important.filter((rule)=>rule.test(item,text));
  const secondaryMatches=knowledge.secondary.filter((rule)=>rule.test(item,text));
  const missing=knowledge.important.filter((rule)=>!rule.test(item,text)).map((rule)=>rule.label);
  const weak=knowledge.weak.filter((rule)=>rule.test(item,text)).map((rule)=>rule.label);
  const weaponDefensive=(['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff','staff','wand','sceptre'].includes(knowledge.info.key))
    ? (item.customMods||[]).filter((line)=>/maximum Life|to .*Resistance|increased Armour|increased Evasion|increased Energy Shield/i.test(line)) : [];
  const importantRatio=knowledge.important.length?importantMatches.length/knowledge.important.length:0.5;
  const secondaryRatio=knowledge.secondary.length?Math.min(1,secondaryMatches.length/Math.min(3,knowledge.secondary.length)):0.5;
  const score=Math.max(0,Math.min(100,Math.round(evaluation.score*.58+importantRatio*27+secondaryRatio*15-weak.length*3)));
  return{
    score,
    positiveStats:unique([...importantMatches,...secondaryMatches].map((rule)=>rule.label)).slice(0,7),
    weakOrWastedStats:unique([...weaponDefensive,...weak]).slice(0,6),
    missingImportantStats:unique(missing).slice(0,5),
    marketRelevantStats:unique(knowledge.market.filter((rule)=>rule.test(item,text)).map((rule)=>rule.label)).slice(0,6),
    buildRelevantStats:unique(knowledge.build.filter((rule)=>rule.test(item,text)).map((rule)=>rule.label)).slice(0,6),
  };
}
const unique=<T>(values:T[])=>[...new Set(values)];
