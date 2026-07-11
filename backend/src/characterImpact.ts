import type { CharacterImpact, CharacterTotals, ItemStats } from './types.js';

const keys=['fireResistance','coldResistance','lightningResistance','chaosResistance','strength','dexterity','intelligence'] as const;
const labels:Record<typeof keys[number],string>={fireResistance:'Fire Resistance',coldResistance:'Cold Resistance',lightningResistance:'Lightning Resistance',chaosResistance:'Chaos Resistance',strength:'Strength',dexterity:'Dexterity',intelligence:'Intelligence'};

export function calculateCharacterImpact(totals:CharacterTotals|undefined,candidate:ItemStats,equipped:ItemStats):CharacterImpact|undefined{
  if(!totals||!keys.some((key)=>totals[key]!==undefined))return undefined;const before:Record<string,number>={};const after:Record<string,number>={};const warnings:string[]=[];
  for(const key of keys){if(totals[key]===undefined)continue;before[key]=Number(totals[key]);const delta=Number(candidate[key]||0)-Number(equipped[key]||0);after[key]=before[key]+delta;
    if(key.endsWith('Resistance')){if(key!=='chaosResistance'&&before[key]>=75&&after[key]<75)warnings.push(`This swap may break your ${labels[key]} cap (${before[key]}% → ${after[key]}%).`);else if(delta<=-15)warnings.push(`You lose ${Math.abs(delta)}% ${labels[key]}.`);}
    else if(delta<=-20)warnings.push(`You lose ${Math.abs(delta)} ${labels[key]}, which may break gem or gear requirements.`);
  }
  return{before,after,warnings};
}

export function rawCharacterRiskWarnings(deltas:Record<string,number>){const warnings:string[]=[];for(const key of keys){const delta=deltas[key]||0;if(key.endsWith('Resistance')&&delta<=-15)warnings.push(`You lose ${Math.abs(delta)}% ${labels[key]}.`);if(!key.endsWith('Resistance')&&delta<=-20)warnings.push(`You lose ${Math.abs(delta)} ${labels[key]}, which may break requirements.`);}return warnings;}
