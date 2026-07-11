import type { ItemAnalysisInput, MarketSearchQuery } from './engineContracts.js';

export type SearchTier='A-exact'|'B-functional'|'C-90'|'D-80'|'D-70'|'build-fit';
export interface LayeredMarketQuery extends MarketSearchQuery{tier:SearchTier;label:string;retainedStats:string[];relaxation:number}

export function buildLayeredSearches(item:ItemAnalysisInput,weightedStats:Array<{stat:string;weight:number}>,league=item.league):LayeredMarketQuery[]{
  const ranked=[...weightedStats].filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight);
  const exact=ranked.map(x=>x.stat);const functional=exact.slice(0,Math.max(2,Math.ceil(exact.length*.65)));
  const make=(tier:SearchTier,label:string,stats:string[],relaxation:number):LayeredMarketQuery=>({tier,label,league,patch:item.patch,itemClass:item.itemClass,baseType:tier==='A-exact'?item.baseType:undefined,filters:{rarity:item.rarity,itemLevel:item.itemLevel,stats:stats.map(stat=>({stat,minimumFactor:relaxation}))},retainedStats:stats,relaxation,limit:40});
  return [make('A-exact','Same base and important stats',exact,1),make('B-functional','Same function, flexible base',functional,1),make('C-90','Functional stats at 90%',functional,.9),make('D-80','Functional stats at 80%',functional,.8),make('D-70','Functional stats at 70%',functional,.7),make('build-fit','Build-weighted alternatives',ranked.slice(0,5).map(x=>x.stat),.75)];
}
