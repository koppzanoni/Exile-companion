import { diagnoseBuild, type BuildDoctorResult, type EquipmentSlotInput } from './buildDoctor.js';
import type { BuildFitProfile } from './types.js';

export interface UpgradeCandidateInput { id:string;slot:string;itemText:string;price:number;currency:'exalted' }
export interface RankedUpgradeCandidate {
  id:string;slot:string;price:number;beforeScore:number;afterScore:number;scoreDelta:number;valuePerExalted:number;
  verdict:'Clear upgrade'|'Small upgrade'|'Sidegrade'|'Risky sidegrade'|'Downgrade';newGaps:string[];resolvedGaps:string[];
}
export interface UpgradePlan {budget:number;spent:number;remaining:number;beforeScore:number;afterScore:number;selected:RankedUpgradeCandidate[];rejected:Array<{id:string;reason:string}>;warnings:string[]}

function replaceSlot(equipment:EquipmentSlotInput[],candidate:UpgradeCandidateInput){return [...equipment.filter(entry=>entry.slot!==candidate.slot),{slot:candidate.slot,itemText:candidate.itemText}];}
function changedGaps(before:BuildDoctorResult,after:BuildDoctorResult){
  const newGaps:string[]=[];const resolvedGaps:string[]=[];
  for(const key of Object.keys(before.resistances.missing)){const old=before.resistances.missing[key]||0;const next=after.resistances.missing[key]||0;if(next>old)newGaps.push(`${next-old}% more ${key.replace('Resistance',' resistance')} required`);if(next<old)resolvedGaps.push(`${old-next}% ${key.replace('Resistance',' resistance')} recovered`);}
  for(const key of Object.keys(before.attributes.met)){if(before.attributes.met[key]&&!after.attributes.met[key])newGaps.push(`${key} requirement is no longer met`);if(!before.attributes.met[key]&&after.attributes.met[key])resolvedGaps.push(`${key} requirement is now met`);}
  const oldSpirit=before.spirit.missing||0;const nextSpirit=after.spirit.missing||0;if(nextSpirit>oldSpirit)newGaps.push(`${nextSpirit-oldSpirit} more Spirit required`);if(nextSpirit<oldSpirit)resolvedGaps.push(`${oldSpirit-nextSpirit} Spirit recovered`);
  return{newGaps,resolvedGaps};
}
function rank(before:BuildDoctorResult,after:BuildDoctorResult,candidate:UpgradeCandidateInput):RankedUpgradeCandidate{
  const scoreDelta=after.profile.overallScore-before.profile.overallScore;
  const{newGaps,resolvedGaps}=changedGaps(before,after);
  const verdict=scoreDelta>=5&&!newGaps.length?'Clear upgrade':scoreDelta>0&&!newGaps.length?'Small upgrade':scoreDelta<0?'Downgrade':newGaps.length?'Risky sidegrade':'Sidegrade';
  return{id:candidate.id,slot:candidate.slot,price:candidate.price,beforeScore:before.profile.overallScore,afterScore:after.profile.overallScore,scoreDelta,valuePerExalted:candidate.price>0?Math.round((scoreDelta/candidate.price)*100)/100:0,verdict,newGaps,resolvedGaps};
}

export function compareUpgradeCandidates(equipment:EquipmentSlotInput[],candidates:UpgradeCandidateInput[],build:BuildFitProfile){
  const before=diagnoseBuild(equipment,build);
  return candidates.map(candidate=>rank(before,diagnoseBuild(replaceSlot(equipment,candidate),build),candidate)).sort((a,b)=>b.valuePerExalted-a.valuePerExalted||b.scoreDelta-a.scoreDelta||a.price-b.price);
}

export function planUpgradesByBudget(equipment:EquipmentSlotInput[],candidates:UpgradeCandidateInput[],budget:number,build:BuildFitProfile):UpgradePlan{
  const initial=diagnoseBuild(equipment,build);let currentEquipment=[...equipment];let current=initial;let spent=0;const selected:RankedUpgradeCandidate[]=[];const usedSlots=new Set<string>();const rejected:Array<{id:string;reason:string}>=[];
  const initialRanks=compareUpgradeCandidates(equipment,candidates,build);
  for(const candidate of candidates.slice().sort((a,b)=>{const ar=initialRanks.find(row=>row.id===a.id)?.valuePerExalted||-999;const br=initialRanks.find(row=>row.id===b.id)?.valuePerExalted||-999;return br-ar;})){
    if(usedSlots.has(candidate.slot)){rejected.push({id:candidate.id,reason:`Another ${candidate.slot} candidate already provides the better budget allocation.`});continue;}
    if(spent+candidate.price>budget){rejected.push({id:candidate.id,reason:`Price of ${candidate.price} Exalted exceeds the remaining budget.`});continue;}
    const nextEquipment=replaceSlot(currentEquipment,candidate);const next=diagnoseBuild(nextEquipment,build);const ranked=rank(current,next,candidate);
    if(ranked.scoreDelta<=0||ranked.newGaps.length){rejected.push({id:candidate.id,reason:ranked.newGaps.length?`Creates new gaps: ${ranked.newGaps.join(', ')}.`:'Does not improve the current profile score.'});continue;}
    selected.push(ranked);usedSlots.add(candidate.slot);spent+=candidate.price;currentEquipment=nextEquipment;current=next;
  }
  return{budget,spent,remaining:Math.max(0,budget-spent),beforeScore:initial.profile.overallScore,afterScore:current.profile.overallScore,selected,rejected,warnings:['The plan optimizes measured profile gain per Exalted; listing availability and completed-sale prices are not guaranteed.']};
}
