export type DataSource =
  'live' | 'relaxed-live' | 'insufficient-live' | 'similarity-fallback' | 'cache' | 'manual' | 'none';
export const isLiveVerifiedSource = (source: DataSource) => source === 'live' || source === 'relaxed-live';
export type Rarity = 'normal' | 'magic' | 'rare' | 'unique' | 'unknown';

export interface ItemStats {
  itemType: string;
  itemClass?: string;
  baseType: string;
  name?: string;
  rarity: Rarity;
  itemLevel?: number;
  requiredLevel?: number;
  requiredStrength?: number;
  requiredDexterity?: number;
  requiredIntelligence?: number;
  quality?: number;
  corrupted?: boolean;
  sanctified?: boolean;
  energyShield?: number;
  evasion?: number;
  armour?: number;
  deflection?: number;
  runicWard?: number;
  life?: number;
  mana?: number;
  intelligence?: number;
  strength?: number;
  dexterity?: number;
  fireResistance?: number;
  coldResistance?: number;
  lightningResistance?: number;
  chaosResistance?: number;
  movementSpeed?: number;
  rarityFind?: number;
  spirit?: number;
  stunThreshold?: number;
  physicalDamageMin?: number;
  physicalDamageMax?: number;
  fireDamageMin?: number;
  fireDamageMax?: number;
  coldDamageMin?: number;
  coldDamageMax?: number;
  lightningDamageMin?: number;
  lightningDamageMax?: number;
  chaosDamageMin?: number;
  chaosDamageMax?: number;
  attacksPerSecond?: number;
  criticalHitChance?: number;
  blockChance?: number;
  increasedBlockChance?: number;
  attackSpeedBonus?: number;
  castSpeed?: number;
  spellDamage?: number;
  criticalDamageBonus?: number;
  projectileSkillLevels?: number;
  meleeSkillLevels?: number;
  spellSkillLevels?: number;
  minionSkillLevels?: number;
  lifeRegeneration?: number;
  manaRegeneration?: number;
  flaskChargesGained?: number;
  reducedFlaskChargesUsed?: number;
  charmSlots?: number;
  customMods: string[];
  rawText?: string;
  parsedLines?: ParsedLineDebug[];
}

export type ItemCategory =
  | 'body-armour'
  | 'helmet'
  | 'gloves'
  | 'boots'
  | 'shield'
  | 'focus'
  | 'quiver'
  | 'ring'
  | 'amulet'
  | 'belt'
  | 'bow'
  | 'crossbow'
  | 'one-handed-melee'
  | 'two-handed-melee'
  | 'staff'
  | 'quarterstaff'
  | 'wand'
  | 'sceptre'
  | 'other';
export interface ItemCategoryInfo {
  key: ItemCategory;
  label: string;
  priorities: string[];
}
export interface ParsedLineDebug {
  line: string;
  fields: string[];
  values: Array<string | number | boolean>;
}
export interface CategoryDetection {
  category: ItemCategoryInfo;
  reason: string;
  confidence: number;
  evidence: string[];
}
export interface CategoryAnalysis {
  detectedCategory: ItemCategoryInfo;
  detectionReason: string;
  categoryScore: number;
  positiveStats: string[];
  weakOrWastedStats: string[];
  missingImportantStats: string[];
  marketRelevantStats: string[];
  buildRelevantStats: string[];
  tradeSearchPriorities: string[];
  confidence: number;
  warnings: string[];
  parsedLines: ParsedLineDebug[];
}

export interface BuildFitProfile {
  id: string;
  source: 'default' | 'custom' | 'generic';
  name: string;
  className: string;
  ascendancy?: string;
  mainSkill: string;
  level?: number;
  guideUrl?: string;
  stage: 'campaign' | 'early-maps' | 'established' | 'transition' | 'endgame' | 'aspirational';
  evaluationStyle: 'balanced' | 'campaign-race' | 'hardcore-gauntlet';
  preferredWeaponTypes: ItemCategory[];
  damageTypes: string[];
  conversions?: Record<string, string>;
  defensiveLayers: string[];
  offensiveStats: string[];
  defensiveStats: string[];
  attributes: string[];
  utilityStats: string[];
  wastedStats: string[];
  valuableSlots: ItemCategory[];
  categoryPriorities: Partial<Record<ItemCategory, string[]>>;
  explanationRules: string[];
  defenceStyle: 'life-armour' | 'life-evasion' | 'energy-shield' | 'hybrid' | 'custom';
  priorities: BuildPriority[];
  requiredMods: string[];
  desiredMods: string[];
  conditionalRules?: Array<{ when: string; then: string; weight: number }>;
  spiritTarget?: number;
  attributeRequirements?: Partial<Record<'strength' | 'dexterity' | 'intelligence', number>>;
  resistanceCaps?: Partial<
    Record<'fireResistance' | 'coldResistance' | 'lightningResistance' | 'chaosResistance', number>
  >;
  targetContent?: string;
  budget?: number;
  equipmentDependencies?: string[];
  notes?: string;
}

export interface BuildFitAnalysis {
  profileId: string;
  profileName: string;
  buildSpecific: boolean;
  score: number;
  label: 'Bad' | 'Usable' | 'Good' | 'Great' | 'Build-defining';
  fitsBecause: string[];
  doesNotFitBecause: string[];
  bestUseCase: 'leveling' | 'campaign' | 'early maps' | 'endgame' | 'bossing' | 'niche' | 'vendor';
  missingImportantStats: string[];
  wastedStats: string[];
  recommendedAction: 'Use' | 'Sell' | 'Craft' | 'Replace Soon' | 'Vendor' | 'Price Check';
  confidence: number;
  warnings: string[];
}

export type ItemAction = 'Use' | 'Sell' | 'Craft' | 'Replace Soon' | 'Price Check' | 'Vendor' | 'Keep for Later';
export type DecisionConfidence = 'Low' | 'Medium' | 'High';

export interface CraftingPotential {
  score: number;
  label:
    | 'Do Not Craft'
    | 'Low Potential'
    | 'Maybe Craft'
    | 'Good Crafting Base'
    | 'High Potential'
    | 'Premium Crafting Base';
  confidence: DecisionConfidence;
  recommendation: string;
  reasons: string[];
  risks: string[];
  bestPossibleImprovements: string[];
  avoidActions: string[];
  suggestedCurrencyUse: string[];
  currencyWarnings: string[];
  baseQuality: { score: number; label: string; reasons: string[] };
  rollQuality: { score: number; label: string; strongRolls: string[]; weakRolls: string[]; missingRolls: string[] };
}

export interface CraftingSettings {
  craftingRiskTolerance: 'Low' | 'Medium' | 'High';
  showCurrencyWarnings: boolean;
  conservativeCraftingRecommendations: boolean;
}

export interface ItemRecommendation {
  action: ItemAction;
  confidence: DecisionConfidence;
  shortReason: string;
  detailedReason: string[];
  secondaryAction?: ItemAction;
  doThisNext: string[];
  warnings: string[];
  hiddenValueFlags: string[];
  craftingPotential: CraftingPotential;
  whatWouldMakeBetter: string[];
  checkBeforeSelling: string[];
  safeToVendor: boolean;
  manualPriceCheck: boolean;
  mayHaveHiddenValue: boolean;
  bestUseCase: BuildFitAnalysis['bestUseCase'];
}

export interface EvaluationFactor {
  score: number;
  confidence: DecisionConfidence;
  summary: string;
  positiveFactors: string[];
  negativeFactors: string[];
  dataUsed: string[];
  limitations: string[];
}
export interface FourEvaluations {
  buildFit: EvaluationFactor;
  upgradeValue: EvaluationFactor;
  marketValue: EvaluationFactor;
  craftPotential: EvaluationFactor;
}
export type MainDecisionAction = 'Use' | 'Sell' | 'Craft' | 'Keep' | 'Discard';
export interface MainDecision {
  action: MainDecisionAction;
  reason: string;
  conditionsToChange: string[];
}

export interface Listing {
  id: string;
  name: string;
  baseType: string;
  rarity: Rarity;
  price: number;
  currency: 'exalted' | 'divine';
  exaltedPrice: number;
  stats: Partial<ItemStats>;
  account?: string;
  indexedAt?: string;
  source: Exclude<DataSource, 'none'>;
  similarity?: number;
  excludedReason?: string;
  officialUrl?: string;
  mainDifference?: string;
  foundByStrategy?: string;
}

export interface Estimate {
  quickSell: number;
  fair: number;
  high: number;
  divine: { quickSell: number; fair: number; high: number };
  confidence: 'low' | 'medium' | 'high';
  positiveMods: string[];
  negativeMods: string[];
  explanation: string[];
  usedCount: number;
  excludedCount: number;
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

export interface BuildFit {
  name: string;
  score: number;
  fit: 'weak' | 'possible' | 'strong';
  reasons: string[];
  conflicts: string[];
}

export type BuildPriorityLevel = 'required' | 'high' | 'useful';
export type BuildStat =
  | 'life'
  | 'mana'
  | 'energyShield'
  | 'armour'
  | 'evasion'
  | 'movementSpeed'
  | 'fireResistance'
  | 'coldResistance'
  | 'lightningResistance'
  | 'chaosResistance'
  | 'strength'
  | 'dexterity'
  | 'intelligence'
  | 'spirit'
  | 'rarityFind'
  | 'attacksPerSecond'
  | 'criticalHitChance'
  | 'physicalDps'
  | 'elementalDps';

export interface BuildPriority {
  stat: BuildStat;
  level: BuildPriorityLevel;
  minimum?: number;
}

export interface PersonalizedBuildFit {
  buildName: string;
  className: string;
  score: number;
  fit: 'poor' | 'partial' | 'strong' | 'excellent';
  verdict: string;
  matched: string[];
  missing: string[];
  conflicts: string[];
}

export interface ItemEvaluation {
  score: number;
  grade: 'poor' | 'basic' | 'good' | 'excellent' | 'elite';
  label: string;
  verdict: string;
  marketability: 'low' | 'niche' | 'broad';
  strengths: string[];
  weaknesses: string[];
  buildFits: BuildFit[];
  upgradePriorities: string[];
  personalized?: PersonalizedBuildFit;
  category?: ItemCategoryInfo;
  knowledge?: KnowledgeAssessment;
  categoryAnalysis?: CategoryAnalysis;
  buildFitAnalysis?: BuildFitAnalysis;
}

export interface ModifierRollInsight {
  modifier: string;
  tier?: number;
  percentile: number;
  label: 'low' | 'average' | 'high' | 'perfect';
}

export interface KnowledgeAssessment {
  ruleset: string;
  confidence: { score: number; level: 'low' | 'medium' | 'high'; reasons: string[]; warnings: string[] };
  rolls: ModifierRollInsight[];
  recognizedModifiers: number;
  totalModifiers: number;
  itemLevelNote: string;
  craftingNotes: string[];
}

export interface ItemComparison {
  enabled: boolean;
  comparable: boolean;
  compatible: boolean;
  candidateCategory: ItemCategoryInfo;
  equippedCategory: ItemCategoryInfo;
  verdict: ComparisonVerdict;
  explanation: string;
  confidence: DecisionConfidence;
  scoreDelta: number;
  buildFitDelta?: number;
  personalizedDelta?: number;
  gains: string[];
  improvements: string[];
  losses: string[];
  warnings: string[];
  riskFlags: string[];
  statDeltas: Record<string, number>;
  characterImpact?: CharacterImpact;
  betterFor: string[];
  worseFor: string[];
  recommendationImpact: string;
}

export type ComparisonVerdict =
  | 'Clear Upgrade'
  | 'Small Upgrade'
  | 'Sidegrade'
  | 'Situational Upgrade'
  | 'Defensive Upgrade'
  | 'Offensive Upgrade'
  | 'Downgrade'
  | 'Not Comparable'
  | 'Needs Manual Review';
export interface CharacterTotals {
  fireResistance?: number;
  coldResistance?: number;
  lightningResistance?: number;
  chaosResistance?: number;
  strength?: number;
  dexterity?: number;
  intelligence?: number;
  spirit?: number;
}
export interface CharacterImpact {
  before: Record<string, number>;
  after: Record<string, number>;
  warnings: string[];
}
