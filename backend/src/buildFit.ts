import { scoreBuildFit } from './buildFitScoring.js';
import { recommendUse } from './buildRecommendations.js';
import type { BuildFitAnalysis, BuildFitProfile, ItemEvaluation, ItemStats } from './types.js';

export function analyzeBuildFit(item:ItemStats,evaluation:ItemEvaluation,profile:BuildFitProfile):BuildFitAnalysis {
  const scored=scoreBuildFit(item,evaluation,profile);const recommendation=recommendUse(scored.score,evaluation,scored.conflicts.length);
  const label:BuildFitAnalysis['label']=scored.score>=85?'Build-defining':scored.score>=65?'Great':scored.score>=45?'Good':scored.score>=25?'Usable':'Bad';
  const doesNotFit=[...scored.conflicts,...scored.missing.map((stat)=>`Missing ${stat}`)];
  return{profileId:profile.id,profileName:profile.name,buildSpecific:profile.source!=='generic',score:scored.score,label,fitsBecause:scored.fits,doesNotFitBecause:doesNotFit.slice(0,8),bestUseCase:recommendation.bestUseCase,missingImportantStats:scored.missing,wastedStats:scored.wasted,recommendedAction:recommendation.recommendedAction,confidence:scored.confidence,warnings:scored.warnings};
}
