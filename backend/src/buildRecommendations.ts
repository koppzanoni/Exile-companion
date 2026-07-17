import type { BuildFitAnalysis, ItemEvaluation } from './types.js';

export function recommendUse(score:number,evaluation:ItemEvaluation,conflicts:number):Pick<BuildFitAnalysis,'bestUseCase'|'recommendedAction'> {
  const quality=evaluation.score;
  if(score>=88)return{bestUseCase:quality>=75?'bossing':'endgame',recommendedAction:'Use'};
  if(score>=70)return{bestUseCase:'endgame',recommendedAction:quality>=55?'Use':'Craft'};
  if(score>=52)return{bestUseCase:quality>=55?'early maps':'campaign',recommendedAction:quality>=70?'Price Check':'Craft'};
  if(score>=30)return{bestUseCase:conflicts||evaluation.grade!=='poor'?'niche':'leveling',recommendedAction:quality>=60?'Sell':'Replace Soon'};
  if(quality>=70)return{bestUseCase:'niche',recommendedAction:'Price Check'};
  if(quality>=45)return{bestUseCase:'niche',recommendedAction:'Sell'};
  return{bestUseCase:'vendor',recommendedAction:'Vendor'};
}
