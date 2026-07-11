import { calculateCharacterImpact, rawCharacterRiskWarnings } from './characterImpact.js';
import { dimensionDeltas, scoreComparisonDimensions } from './comparisonScoring.js';
import { evaluateItem } from './quality.js';
import { calculateStatDeltas, formatDelta } from './statDelta.js';
import { detectItemCategory } from './slotQuality.js';
import { chooseUpgradeVerdict } from './upgradeVerdict.js';
import type { BuildFitProfile, CharacterTotals, DecisionConfidence, ItemCategory, ItemComparison, ItemEvaluation, ItemStats } from './types.js';

export interface ComparisonOptions {
  selectedBuildProfile?:BuildFitProfile|null;
  candidateEvaluation?:ItemEvaluation;
  equippedEvaluation?:ItemEvaluation;
  characterTotals?:CharacterTotals;
  candidateMarketValue?:number;
  equippedMarketValue?:number;
  marketVerified?:boolean;
}

export function compareItems(candidate:ItemStats,equipped:ItemStats,options:ComparisonOptions={}):ItemComparison{
  const candidateCategory=detectItemCategory(candidate);const equippedCategory=detectItemCategory(equipped);
  const comparable=categoriesCompatible(candidateCategory.key,equippedCategory.key,options.selectedBuildProfile);
  if(!comparable)return{enabled:true,comparable:false,compatible:false,candidateCategory,equippedCategory,verdict:'Not Comparable',explanation:`Cannot compare new ${candidateCategory.label} against equipped ${equippedCategory.label}. These items do not occupy a compatible slot for the selected build.`,confidence:'High',scoreDelta:0,gains:[],improvements:[],losses:[],warnings:['Paste the currently equipped item from the same slot.'],riskFlags:['Incompatible item categories'],statDeltas:{},betterFor:[],worseFor:[],recommendationImpact:'Do not use this comparison to replace the equipped item.'};

  const candidateEvaluation=options.candidateEvaluation||evaluateItem(candidate,options.selectedBuildProfile);const equippedEvaluation=options.equippedEvaluation||evaluateItem(equipped,options.selectedBuildProfile);
  const candidateDimensions=scoreComparisonDimensions(candidate,candidateCategory.key,candidateEvaluation);const equippedDimensions=scoreComparisonDimensions(equipped,equippedCategory.key,equippedEvaluation);const dimensions=dimensionDeltas(candidateDimensions,equippedDimensions);
  const statDeltas=calculateStatDeltas(candidate,equipped,candidateCategory.key);const scoreDelta=Math.round(candidateEvaluation.score-equippedEvaluation.score);const buildFitDelta=buildDelta(candidateEvaluation,equippedEvaluation);
  const confidence=comparisonConfidence(candidate,equipped,candidateEvaluation,equippedEvaluation,candidateCategory.key);const composite=round(clamp(dimensions.offensive)*.22+clamp(dimensions.defensive)*.22+clamp(dimensions.utility)*.12+clamp(dimensions.category)*.18+clamp(dimensions.buildFit)*.18+clamp(dimensions.overall)*.08);
  const hasTradeoff=(dimensions.offensive>=6&&dimensions.defensive<=-6)||(dimensions.defensive>=6&&dimensions.offensive<=-6)||(Object.values(statDeltas).some((v)=>v>0)&&Object.values(statDeltas).some((v)=>v<0));
  const verdict=chooseUpgradeVerdict({composite,offensive:dimensions.offensive,defensive:dimensions.defensive,utility:dimensions.utility,buildFit:dimensions.buildFit,overall:dimensions.overall,hasMeaningfulTradeoff:hasTradeoff,confidence});
  const sorted=Object.entries(statDeltas).filter(([key])=>key!=='corrupted').sort(([a,av],[b,bv])=>impact(b,bv,candidateCategory.key)-impact(a,av,candidateCategory.key));
  const gains=sorted.filter(([,value])=>value>0).slice(0,8).map(([key,value])=>formatDelta(key,value));const losses=sorted.filter(([,value])=>value<0).slice(0,8).map(([key,value])=>formatDelta(key,value));
  const characterImpact=calculateCharacterImpact(options.characterTotals,candidate,equipped);const warnings=unique(characterImpact?characterImpact.warnings:rawCharacterRiskWarnings(statDeltas));const riskFlags:string[]=[];
  if((statDeltas.movementSpeed||0)<=-10){warnings.push('Losing movement speed is a major Boots downgrade.');riskFlags.push('Major movement-speed loss');}
  if(dimensions.offensive>=8&&dimensions.defensive<=-8){warnings.push('This is an offensive upgrade but a defensive downgrade.');riskFlags.push('Damage gained at a survivability cost');}
  if(dimensions.defensive>=8&&dimensions.offensive<=-8){warnings.push('Defence improves, but damage drops significantly.');riskFlags.push('Survivability gained at a damage cost');}
  if(candidate.corrupted&&!equipped.corrupted){warnings.push('The new item is corrupted and has restricted crafting options.');riskFlags.push('New item is corrupted');}
  const betterFor=dimensionLabels(dimensions,1);const worseFor=dimensionLabels(dimensions,-1);
  if(options.candidateMarketValue!==undefined&&options.equippedMarketValue!==undefined){const marketDelta=options.candidateMarketValue-options.equippedMarketValue;if(marketDelta>0)betterFor.push('market value');else if(marketDelta<0)worseFor.push('market value');statDeltas.marketValue=round(marketDelta);}
  else if(options.marketVerified)warnings.push('The new item has live market evidence, but the equipped item was not priced, so market value cannot be compared directly.');
  const explanation=explanationFor(verdict,candidateCategory.label,dimensions,scoreDelta,buildFitDelta);
  return{enabled:true,comparable:true,compatible:true,candidateCategory,equippedCategory,verdict,explanation,confidence,scoreDelta,buildFitDelta,personalizedDelta:buildFitDelta,gains,improvements:gains,losses,warnings:unique(warnings),riskFlags:unique(riskFlags),statDeltas,characterImpact,betterFor:unique(betterFor),worseFor:unique(worseFor),recommendationImpact:recommendationFor(verdict,warnings)};
}

function categoriesCompatible(candidate:ItemCategory,equipped:ItemCategory,profile?:BuildFitProfile|null){if(candidate===equipped)return true;const weapons=['bow','crossbow','one-handed-melee','two-handed-melee','staff','quarterstaff','wand','sceptre'];return Boolean(profile&&profile.source!=='generic'&&weapons.includes(candidate)&&weapons.includes(equipped)&&profile.preferredWeaponTypes.includes(candidate)&&profile.preferredWeaponTypes.includes(equipped));}
function buildDelta(candidate:ItemEvaluation,equipped:ItemEvaluation){if(candidate.buildFitAnalysis&&equipped.buildFitAnalysis)return candidate.buildFitAnalysis.score-equipped.buildFitAnalysis.score;if(candidate.personalized&&equipped.personalized)return candidate.personalized.score-equipped.personalized.score;return undefined;}
function comparisonConfidence(candidate:ItemStats,equipped:ItemStats,candidateEvaluation:ItemEvaluation,equippedEvaluation:ItemEvaluation,category:ItemCategory):DecisionConfidence{let score=((candidateEvaluation.categoryAnalysis?.confidence||60)+(equippedEvaluation.categoryAnalysis?.confidence||60))/2;if((candidate.parsedLines||[]).length&&(equipped.parsedLines||[]).length)score+=8;if(['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff'].includes(category)&&(!candidate.attacksPerSecond||!equipped.attacksPerSecond))score-=20;if(category==='shield'&&(!candidate.blockChance||!equipped.blockChance))score-=15;return score>=82?'High':score>=55?'Medium':'Low';}
function dimensionLabels(delta:ReturnType<typeof dimensionDeltas>,direction:1|-1){const result:string[]=[];const compare=(value:number,label:string)=>{if(value*direction>=4)result.push(label);};compare(delta.offensive,'damage');compare(delta.defensive,'defence');compare(delta.utility,'utility');compare(delta.buildFit,'selected build fit');compare(delta.category,'slot quality');return result;}
function explanationFor(verdict:string,slot:string,deltas:ReturnType<typeof dimensionDeltas>,scoreDelta:number,buildFitDelta?:number){const parts=[`${verdict} for the ${slot} slot.`,`Universal quality changes by ${signed(scoreDelta)}.`];if(buildFitDelta!==undefined)parts.push(`Selected-build fit changes by ${signed(buildFitDelta)}.`);if(deltas.offensive>=6)parts.push('Offensive value improves.');if(deltas.defensive>=6)parts.push('Defensive value improves.');if(deltas.offensive<=-6)parts.push('Offensive value drops.');if(deltas.defensive<=-6)parts.push('Defensive value drops.');return parts.join(' ');}
function recommendationFor(verdict:string,warnings:string[]){const risk=warnings.some((line)=>/cap|requirements|survivability|movement speed/i.test(line));if(verdict==='Clear Upgrade')return risk?'Use the new item only after fixing the listed character risks.':'Equip the new item; it is a clear improvement.';if(['Small Upgrade','Offensive Upgrade','Defensive Upgrade'].includes(verdict))return risk?'Use it if you can fix the listed losses elsewhere; otherwise keep the current item.':'The new item is an upgrade for the stated strengths.';if(verdict==='Situational Upgrade'||verdict==='Sidegrade')return'Treat this as a situational swap, not an automatic replacement.';if(verdict==='Downgrade')return'Keep the currently equipped item unless the new item solves a specific temporary need.';return'Review the items manually before replacing the equipped item.';}
function impact(key:string,value:number,category:ItemCategory){const base:Record<string,number>={totalDps:5,physicalDps:4,elementalDps:4,movementSpeed:5,blockChance:4,life:2,fireResistance:2,coldResistance:2,lightningResistance:2,chaosResistance:2,strength:1.5,dexterity:1.5,intelligence:1.5,skillLevels:5,spellDamage:3,projectileDamage:3,attacksPerSecond:4,criticalHitChance:3,armour:1,evasion:1,energyShield:1,deflection:1,runicWard:1.2};const weapon=['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff'].includes(category);if(weapon&&['life','fireResistance','coldResistance','lightningResistance','chaosResistance','armour','evasion','energyShield','deflection','runicWard'].includes(key))return 0;return Math.abs(value)*(base[key]||1);}
const clamp=(value:number)=>Math.max(-30,Math.min(30,value));const round=(value:number)=>Math.round(value*100)/100;const signed=(value:number)=>`${value>=0?'+':''}${value}`;const unique=<T>(values:T[])=>[...new Set(values)];
