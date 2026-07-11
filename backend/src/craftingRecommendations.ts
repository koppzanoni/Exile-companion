import type { CraftingPotential, ItemEvaluation, ItemStats } from './types.js';
import type { CraftingFacts } from './craftingRules.js';
import type { CraftingRiskAssessment } from './craftingRisk.js';

export function craftingLabel(score:number):CraftingPotential['label']{return score>=86?'Premium Crafting Base':score>=72?'High Potential':score>=56?'Good Crafting Base':score>=38?'Maybe Craft':score>=20?'Low Potential':'Do Not Craft';}

export function craftingRecommendation(item:ItemStats,evaluation:ItemEvaluation,facts:CraftingFacts,risk:CraftingRiskAssessment,score:number){
  const label=craftingLabel(score);let recommendation:string;
  if(item.corrupted)recommendation='Do not craft this corrupted item; use it, sell it, or price check its special value instead.';
  else if(label==='Do Not Craft')recommendation='Do not spend currency; the base and current modifier package do not justify investment.';
  else if(label==='Low Potential')recommendation=facts.buildFitScore>=65?'Useful for the selected build, but use it temporarily without meaningful currency investment.':'Use, sell, or vendor it instead of investing currency.';
  else if(label==='Maybe Craft')recommendation=evaluation.marketability!=='low'?'Consider only a cheap, controlled improvement; selling or price checking may be safer.':'Craft only as a low-cost experiment.';
  else if(label==='Good Crafting Base')recommendation='Worth a controlled craft if the missing affix is confirmed fixable.';
  else if(label==='High Potential')recommendation='A strong crafting candidate; preserve the good rolls and target the missing priority stat.';
  else recommendation='Premium crafting base: verify market value, affix space, and the exact currency plan before investing.';
  const bestPossibleImprovements=unique([...facts.missing,...evaluation.upgradePriorities]).slice(0,6);
  const avoidActions:string[]=[];if(risk.riskLabel==='High'||risk.riskLabel==='Extreme')avoidActions.push('Avoid expensive or irreversible currency actions.');if(facts.wasted.length>=2)avoidActions.push('Do not add currency before confirming the wasted modifiers can be removed or tolerated.');if(facts.strongRolls.length)avoidActions.push('Avoid actions that can erase the strongest existing rolls.');if(['leveling','campaign'].includes(facts.bestUseCase))avoidActions.push('Do not over-invest in a leveling-only item.');if(item.corrupted)avoidActions.push('Do not attempt normal rare-item crafting on a corrupted item.');
  return{label,recommendation,bestPossibleImprovements,avoidActions:unique(avoidActions)};
}
const unique=<T>(values:T[])=>[...new Set(values)];
