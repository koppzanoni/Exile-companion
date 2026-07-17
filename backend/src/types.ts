import type {
  BuildFit,
  BuildFitAnalysis,
  BuildFitProfile,
  BuildPriority,
  BuildPriorityLevel,
  BuildStat,
  CategoryAnalysis,
  CharacterImpact,
  CharacterTotals,
  ComparisonVerdict,
  CraftingPotential,
  DataSource,
  DecisionConfidence,
  Estimate,
  EvaluationFactor,
  FourEvaluations,
  ItemAction,
  ItemCategory,
  ItemCategoryInfo,
  ItemComparison,
  ItemEvaluation,
  ItemRecommendation,
  ItemStats,
  KnowledgeAssessment,
  Listing,
  MainDecision,
  MainDecisionAction,
  ModifierRollInsight,
  ParsedLineDebug,
  PersonalizedBuildFit,
  Rarity,
} from 'poe2-orb-analyzer-shared-types';

export type {
  BuildFit,
  BuildFitAnalysis,
  BuildFitProfile,
  BuildPriority,
  BuildPriorityLevel,
  BuildStat,
  CategoryAnalysis,
  CharacterImpact,
  CharacterTotals,
  ComparisonVerdict,
  CraftingPotential,
  DataSource,
  DecisionConfidence,
  Estimate,
  EvaluationFactor,
  FourEvaluations,
  ItemAction,
  ItemCategory,
  ItemCategoryInfo,
  ItemComparison,
  ItemEvaluation,
  ItemRecommendation,
  ItemStats,
  KnowledgeAssessment,
  Listing,
  MainDecision,
  MainDecisionAction,
  ModifierRollInsight,
  ParsedLineDebug,
  PersonalizedBuildFit,
  Rarity,
};

export const isLiveVerifiedSource = (source: DataSource) => source === 'live' || source === 'relaxed-live';

export interface CategoryDetection {
  category: ItemCategoryInfo;
  reason: string;
  confidence: number;
  evidence: string[];
}

export interface CraftingSettings {
  craftingRiskTolerance: 'Low' | 'Medium' | 'High';
  showCurrencyWarnings: boolean;
  conservativeCraftingRecommendations: boolean;
}

export interface ParsedTradeQuery {
  league: string;
  type?: string;
  rarity?: string;
  filters: Record<string, unknown>;
  stats: unknown[];
  sort: Record<string, unknown>;
  rawQuery: Record<string, unknown> | null;
  queryId?: string;
}
