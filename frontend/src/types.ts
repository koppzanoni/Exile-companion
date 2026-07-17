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

export interface ItemInput {
  itemType: string;
  itemClass?: string;
  baseType: string;
  name?: string;
  rarity: string;
  itemLevel?: number;
  requiredLevel?: number;
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
  customMods: string[];
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
  parsedLines?: ParsedLineDebug[];
}
export type BuildProvider = 'Mobalytics' | 'poe.ninja' | 'Maxroll' | 'PoE Vault' | 'pobb.in';
export type BuildProfile = BuildFitProfile;
export interface ImportedField {
  field: string;
  value: string;
  excerpt: string;
  confidence: 'High' | 'Medium' | 'Low';
  needsConfirmation: boolean;
}
export interface BuildImportResult {
  profile: BuildFitProfile;
  source: 'direct' | 'reader';
  provider: BuildProvider;
  equipmentSummary: string;
  detected: string[];
  fields: ImportedField[];
  method: 'direct-html' | 'jina-reader';
  importedAt: string;
  partial: boolean;
  warnings: string[];
  snapshotId?: number;
}
export interface CustomBuildProfileInput {
  name: string;
  mainSkill: string;
  className: string;
  ascendancy?: string;
  weaponType?: ItemCategory;
  mainDamageType: string;
  defensiveLayer: string;
  importantStats: string[];
  badStats: string[];
  notes?: string;
}
export interface AppSettings {
  divineToExalted: number;
  defaultLeague: string;
  craftingRiskTolerance: 'Low' | 'Medium' | 'High';
  showCurrencyWarnings: boolean;
  conservativeCraftingRecommendations: boolean;
  interfaceMode: 'Beginner' | 'Advanced';
}
export interface NormalizedModifier {
  id: string;
  text: string;
  type: 'implicit' | 'prefix' | 'suffix' | 'unknown';
  group?: string;
  tier?: number;
  minimumRoll?: number;
  maximumRoll?: number;
  actualRoll?: number;
  rollPercentile?: number;
  tags: string[];
  local: boolean;
  hybrid?: boolean;
  confidence?: 'High' | 'Medium' | 'Low';
  crafted: boolean;
  desecrated: boolean;
}
export interface NormalizedItem {
  itemClass: string;
  baseType: string;
  rarity: string;
  itemLevel?: number;
  corrupted: boolean;
  prefixes: NormalizedModifier[];
  suffixes: NormalizedModifier[];
  implicitModifiers: NormalizedModifier[];
  unknownModifiers: NormalizedModifier[];
}
export interface CraftRoute {
  budget: string;
  steps: Array<{
    action: string;
    preconditions: string[];
    outcomes: string[];
    probability: string;
    risk?: 'low' | 'medium' | 'high' | 'unknown';
  }>;
  blocked: Array<{ action: string; reasons: string[] }>;
  unknownProbability: boolean;
}
export interface CraftComparison {
  recommendation: 'continue' | 'sell' | 'buy-instead' | 'unknown';
  reason: string;
}
export interface CraftPlan {
  status: string;
  prerequisites: string[];
  routes: CraftRoute[];
  stopConditions: string[];
  warning?: string;
  comparison?: CraftComparison;
  state: {
    availableActions: string[];
    blockedActions: Array<{ action: string; reason: string }>;
    openPrefixes: number | null;
    openSuffixes: number | null;
  };
}
export interface KnowledgeStatus {
  patches: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  counts: Record<string, number>;
  generatedAt: string;
}
export type MarketDataSource =
  'live' | 'relaxed-live' | 'insufficient-live' | 'similarity-fallback' | 'cache' | 'manual' | 'none';
export interface ValuedComparable {
  id: string;
  price: number;
  currency: 'exalted' | 'divine';
  similarity: number;
  baseType: string;
  account?: string;
  indexedAt?: string;
  exaltedPrice: number;
  ageDays: number | null;
  status: 'used' | 'rejected';
  rejectedReason?: string;
}
export interface MarketValuation {
  quickSell: number;
  fairPrice: number;
  listingPrice: number;
  lower: number;
  upper: number;
  currency: 'exalted';
  confidence: 'High' | 'Medium' | 'Low';
  confidenceScore: number;
  lowConfidenceReason?: string;
  sampleSize: number;
  usedCount: number;
  discardedCount: number;
  median: number;
  trimmedMean: number;
  q1: number;
  q3: number;
  iqr: number;
  minimumReliablePrice: number;
  centralPrice: number;
  maximumLikelyPrice: number;
  distinctSellers: number;
  medianListingAgeDays: number | null;
  averageSimilarity: number;
  outliers: ValuedComparable[];
  priceFixSuspects: ValuedComparable[];
  liquidity: 'unknown' | 'low' | 'medium' | 'high';
  liquidityBasis: string;
  comparablesUsed: ValuedComparable[];
  comparablesRejected: ValuedComparable[];
  warning: string;
  explanation: string[];
}
export interface MarketAnalysis {
  strategyUsed: string;
  relaxed: boolean;
  relaxationSteps: string[];
  foundCount: number;
  discardedCount: number;
  usedCount: number;
  averageSimilarity: number;
  medianListingAgeDays: number | null;
  distinctSellers: number;
  discardReasons: Record<string, number>;
  lowConfidenceReason?: string;
  comparablesUsed: Listing[];
  comparablesRejected: Listing[];
  valuation: MarketValuation;
  dataSource: MarketDataSource;
  officialUrl: string;
  warning: string;
}
export interface StatContribution {
  stat: string;
  value: number;
  score: number;
  category: 'offence' | 'defence' | 'utility';
  reason: string;
  conditional: boolean;
  wasted: boolean;
  source: 'parsed' | 'derived';
  local: boolean;
  tier?: number;
  buildWeight: number;
  slotWeight: number;
  effectiveBeforeCap: number;
  effectiveAfterCap: number;
  offenceContribution: number;
  defenceContribution: number;
  utilityContribution: number;
  requirementContribution: number;
}
export interface StatValuation {
  offenceScore: number;
  defenceScore: number;
  utilityScore: number;
  overallScore: number;
  contributions: StatContribution[];
  warnings: string[];
}
export interface AlternativeListing {
  listing: Listing;
  qualityScore: number;
  extraCost: number;
  reason: string;
}
export interface OpportunityAnalysis {
  betterAlternativeSamePrice?: AlternativeListing;
  betterAlternativeForMore?: AlternativeListing;
  amountNeededForRelevantJump?: {
    extraCost: number;
    qualityGain: number;
    listing: Listing;
  } | null;
  buyVsCraft: { verdict: 'buy' | 'craft' | 'unknown'; reason: string };
  wastedExpensiveStats: string[];
  sellingWouldEnableBetterPurchase: { possible: boolean; reason: string };
  bestAlternativeSearchUrl?: string;
  gainVsEquipped: { scoreDelta: number; verdict: string } | null;
  limitations: string[];
}
export interface AIAnalysisResult {
  summary: string;
  itemCategory: string;
  buildFitScore: number;
  recommendation: 'equip' | 'sell' | 'craft' | 'ignore' | 'price_check';
  strongStats: Array<{ stat: string; reason: string }>;
  weakStats: Array<{ stat: string; reason: string }>;
  craftingSuggestions: Array<{
    action: string;
    reason: string;
    confidence: number;
  }>;
  marketExplanation: string;
  beginnerExplanation: string;
  confidence: number;
  warnings: string[];
  speculativeMarketEstimate: {
    available: boolean;
    low?: number;
    high?: number;
    currency?: 'exalted';
    reason: string;
    confidence: number;
    limitations: string[];
  };
  buildOpinion: {
    summary: string;
    strengths: string[];
    risks: string[];
    confidence: number;
  };
  metaOpinion: {
    available: boolean;
    summary: string;
    basis: string[];
    confidence: number;
  };
}
export type AIAnalysis =
  { available: true; model: string; result: AIAnalysisResult } | { available: false; reason: string };
export interface SourceEvidence {
  label: string;
  url: string;
  patch: string;
  dataVersion: string;
  confidence: 'High' | 'Medium' | 'Low';
  inspectedAt: string;
  limitation?: string;
}
export interface BreakpointFailure {
  code: string;
  message: string;
  required?: number;
  available?: number;
  severity: 'blocking' | 'warning';
}
export interface OffenceResult {
  skillId: string | null;
  skillName: string;
  patch: string;
  patchCompatibility: 'exact' | 'unsupported' | 'unknown';
  ailmentDps: number | null;
  burstDps: number | null;
  sustainedDps: number | null;
  clearCoverage: 'single-target' | 'multi-target' | 'unknown';
  resourceBalance: { costPerSecond: number | null; recoveryPerSecond: number | null; sustainable: boolean | null };
  mechanicCoverage: {
    status: 'complete' | 'partial' | 'unknown';
    covered: string[];
    missing: string[];
    ignored: string[];
    exactDpsAvailable: boolean;
    reason: string;
  };
  breakpointFailures: BreakpointFailure[];
  assumptions: string[];
  missingInputs: string[];
  sourceEvidence: SourceEvidence[];
  confidence: 'High' | 'Medium' | 'Low';
}
export interface AnalysisFoundations {
  rosterCompatibility: {
    recognized: boolean;
    patchCompatibility: 'exact' | 'unsupported' | 'unknown';
    issues: string[];
    catalogPatch: string;
    dataVersion: string;
    status: 'active' | 'fallback';
    source: string;
    confidence: 'High' | 'Medium' | 'Low';
    limitations: string[];
  };
  actorScopeCoverage: Record<string, { coverage: 'complete' | 'partial'; unknown: unknown[] }>;
  spiritFeasibility: {
    availableSpirit: number | null;
    reservedSpirit: number | null;
    remainingSpirit: number | null;
    activeRoster: string[];
    disabledSkills: string[];
    disabledCompanions: string[];
    invalidRequirements: string[];
    weaponSet: 1 | 2 | null;
    missingInputs: string[];
    confidence: 'High' | 'Low';
    exactFeasibilityAvailable: boolean;
    valid: boolean | null;
  };
  ascendancyMechanicCoverage: Array<{
    id: string;
    label: string;
    status: 'confirmed' | 'partial' | 'scenario-required' | 'unknown';
    actor: string;
    limitation: string;
    sourceEvidence: SourceEvidence[];
  }>;
  ascendancyMechanicModeled: boolean;
  idolatry: { resistancePenalty: number | null; missingInputs: string[]; sourceEvidence?: SourceEvidence[] } | null;
  transitionBundle: {
    complete: boolean;
    missingSignals: string[];
    recommendationAllowed: boolean;
    reason: string;
  } | null;
  criticalRegressions: string[];
  assumptions: string[];
  missingInputs: string[];
  sourceEvidence: SourceEvidence[];
}
export interface Analysis {
  id?: number;
  item: ItemInput;
  normalizedItem?: NormalizedItem;
  evaluation: ItemEvaluation;
  comparison?: ItemComparison;
  craftingPotential: CraftingPotential;
  recommendation: ItemRecommendation;
  league: string;
  dataSource: MarketDataSource;
  warning?: string;
  officialUrl: string;
  divineToExalted: number;
  estimate: Estimate | null;
  comparableListings: Listing[];
  marketAnalysis?: MarketAnalysis;
  statValuation?: StatValuation;
  equippedStatValuation?: StatValuation;
  precisionContext?: {
    buildProfile: {
      id: string;
      name: string;
      source: 'default' | 'custom' | 'generic';
    };
    characterTotalsSource: 'saved-character-plus-request' | 'request' | 'unknown';
    replacementAware: boolean;
    requirements: Partial<Record<'strength' | 'dexterity' | 'intelligence' | 'spirit', number>>;
    resistanceCaps: Partial<
      Record<'fireResistance' | 'coldResistance' | 'lightningResistance' | 'chaosResistance', number>
    >;
    meta: { status: 'unknown'; reason: string };
  };
  evaluations?: FourEvaluations;
  decision?: MainDecision;
  opportunity?: OpportunityAnalysis;
  beginnerSummary?: string;
  aiAnalysis?: AIAnalysis;
  offenceResult?: OffenceResult;
  equippedOffenceResult?: OffenceResult;
  mechanicCoverage?: OffenceResult['mechanicCoverage'];
  exactDpsAvailable?: boolean;
  breakpointFailures?: BreakpointFailure[];
  assumptions?: string[];
  missingInputs?: string[];
  sourceEvidence?: SourceEvidence[];
  patchCompatibility?: OffenceResult['patchCompatibility'];
  rosterCompatibility?: AnalysisFoundations['rosterCompatibility'];
  actorScopeCoverage?: AnalysisFoundations['actorScopeCoverage'];
  spiritFeasibility?: AnalysisFoundations['spiritFeasibility'];
  ascendancyMechanicCoverage?: AnalysisFoundations['ascendancyMechanicCoverage'];
  ascendancyMechanicModeled?: AnalysisFoundations['ascendancyMechanicModeled'];
  idolatry?: AnalysisFoundations['idolatry'];
  transitionBundle?: AnalysisFoundations['transitionBundle'];
  criticalRegressions?: string[];
  timestamp: string;
}
export interface SavedCheck {
  id: number;
  league: string;
  item: ItemInput;
  result: Estimate | null;
  evaluation: ItemEvaluation;
  comparison?: ItemComparison;
  craftingPotential: CraftingPotential;
  recommendation: ItemRecommendation;
  marketAnalysis?: MarketAnalysis;
  statValuation?: StatValuation;
  equippedStatValuation?: StatValuation;
  evaluations?: FourEvaluations;
  decision?: MainDecision;
  opportunity?: OpportunityAnalysis;
  beginnerSummary?: string;
  dataSource: MarketDataSource;
  officialUrl: string;
  warning?: string;
  createdAt: string;
  comparableListings?: Listing[];
}
export interface RaceReview {
  id: number;
  title: string;
  cause: string;
  lesson: string;
  itemCategory?: string;
  createdAt: string;
}
export type LevelingVerdict = 'buy-now' | 'wait' | 'not-worth-it';
export interface LevelingListing {
  id: string;
  slot: string;
  name: string;
  baseType: string;
  requiredLevel?: number;
  price: number;
  currency: string;
  account?: string;
  mods: string[];
  officialUrl: string;
  verdict: LevelingVerdict;
  usefulLevels: number;
  waitUntilLevel?: number;
}
export interface LevelingSlotResult {
  slot: string;
  label: string;
  priorities: string[];
  budget: number;
  listings: LevelingListing[];
  officialUrl: string;
  warning?: string;
}
export interface LevelingSearchResult {
  profile: BuildProfile;
  source: 'direct' | 'reader';
  provider: BuildProvider;
  warnings: string[];
  level: number;
  league: string;
  maxPrice: number;
  slots: LevelingSlotResult[];
  milestone: string;
  nextMilestoneLevel: number;
  whatChangesNext: string;
}

export interface EquipmentSlotInput {
  slot: string;
  itemText: string;
}
export interface PoeOAuthConnection {
  id: number;
  username: string | null;
  scope: string;
  lastSyncAt: string | null;
  lastError: string | null;
}
export interface PoeOAuthStatus {
  configured: boolean;
  required: string[];
  connections: PoeOAuthConnection[];
}
export interface PoeRemoteCharacter {
  name: string;
  league?: string;
  level?: number;
  class?: string;
  className?: string;
  ascendancy?: string;
}
export interface SlotDiagnosis {
  slot: string;
  baseType: string | null;
  overallScore: number | null;
  weaknessRank: number;
  wastedStats: string[];
  scoreBreakdown: { offence: number; defence: number; utility: number };
  statBreakdown: Array<{
    stat: string;
    value: number;
    score: number;
    category: 'offence' | 'defence' | 'utility';
    reason: string;
    conditional: boolean;
    wasted: boolean;
  }>;
  contributions: {
    resistances: Record<string, number>;
    attributes: Record<string, number>;
    spirit: number;
    defence: Record<string, number>;
  };
}
export interface DependencyAlert {
  slot: string;
  message: string;
  code?: DiagnosticMessageCode;
  params?: Record<string, string | number>;
  original?: string;
}
export type DiagnosticMessageCode =
  | 'equipment.empty'
  | 'spirit.target_unknown'
  | 'budget.relative_only'
  | 'swap.attribute_dependency'
  | 'swap.resistance_dependency';
export interface DiagnosticMessage {
  code: DiagnosticMessageCode;
  params: Record<string, string | number>;
  original: string;
}
export interface UpgradeOrderEntry {
  slot: string;
  reason: string;
  budgetPriority: 'High' | 'Medium' | 'Low';
}
export interface BuildDoctorResult {
  offenceResult?: OffenceResult;
  rosterCompatibility?: AnalysisFoundations['rosterCompatibility'];
  actorScopeCoverage?: AnalysisFoundations['actorScopeCoverage'];
  spiritFeasibility?: AnalysisFoundations['spiritFeasibility'];
  ascendancyMechanicCoverage?: AnalysisFoundations['ascendancyMechanicCoverage'];
  ascendancyMechanicModeled?: AnalysisFoundations['ascendancyMechanicModeled'];
  idolatry?: AnalysisFoundations['idolatry'];
  transitionBundle?: AnalysisFoundations['transitionBundle'];
  criticalRegressions?: string[];
  profile: {
    build: {
      name: string;
      className: string;
      ascendancy?: string;
      mainSkill: string;
      stage: string;
      defensiveLayers: string[];
      damageTypes: string[];
    };
    overallScore: number;
    status: 'Critical gaps' | 'Needs work' | 'Functional' | 'Strong';
    equipmentCoverage: { filled: number; total: number; percent: number };
    strengths: string[];
    gaps: string[];
    nextMove: string;
  };
  resistances: {
    current: Record<string, number>;
    missing: Record<string, number>;
    cap: number;
  };
  attributes: {
    total: Record<string, number>;
    required: Record<string, number>;
    met: Record<string, boolean>;
  };
  spirit: {
    current: number;
    required?: number;
    missing?: number;
    note: string;
  };
  defenceByType: Record<string, number>;
  slots: SlotDiagnosis[];
  weakestSlots: string[];
  wastedStatsOverall: string[];
  recommendedUpgradeOrder: UpgradeOrderEntry[];
  alerts: DependencyAlert[];
  limitations: string[];
  structuredLimitations?: DiagnosticMessage[];
}
export interface BuildSwapSimulation {
  slot: string;
  verdict: 'Clear upgrade' | 'Small upgrade' | 'Sidegrade' | 'Risky sidegrade' | 'Downgrade';
  scoreDelta: number;
  beforeScore: number;
  afterScore: number;
  newGaps: string[];
  resolvedGaps: string[];
  diagnosis: BuildDoctorResult;
}
export interface GeminiChatResponse {
  available: boolean;
  conversationId?: number;
  model?: string;
  reason?: string;
  result?: {
    answer: string;
    confidence: 'Low' | 'Medium' | 'High';
    factsUsed: string[];
    suggestedActions: Array<{
      label: string;
      action:
        | 'inspect_slot'
        | 'simulate_swap'
        | 'search_upgrade'
        | 'view_shopping_plan'
        | 'review_price'
        | 'compare_market'
        | 'none';
      slot?: string;
      reason: string;
    }>;
    warnings: string[];
  };
}
export interface UpgradeCandidateInput {
  id: string;
  slot: string;
  itemText: string;
  price: number;
  currency: 'exalted';
}
export interface RankedUpgradeCandidate {
  id: string;
  slot: string;
  price: number;
  beforeScore: number;
  afterScore: number;
  scoreDelta: number;
  valuePerExalted: number;
  verdict: 'Clear upgrade' | 'Small upgrade' | 'Sidegrade' | 'Risky sidegrade' | 'Downgrade';
  newGaps: string[];
  resolvedGaps: string[];
}
export interface UpgradeBudgetPlan {
  budget: number;
  spent: number;
  remaining: number;
  beforeScore: number;
  afterScore: number;
  selected: RankedUpgradeCandidate[];
  rejected: Array<{ id: string; reason: string }>;
  warnings: string[];
}

export interface CharacterSummary {
  id: number;
  name: string;
  league: string;
  level: number | null;
  className: string;
  ascendancy: string;
  buildProfileId: string;
  stage: string | null;
  budget: number | null;
  targetContent: string;
  currentIssues: string;
  updatedAt: string;
}
export interface CharacterHistoryEntry {
  id: number;
  checkId: number | null;
  summary: string;
  createdAt: string;
}
export interface CharacterDetail {
  character: CharacterSummary;
  equipment: EquipmentSlotInput[];
  diagnosis: BuildDoctorResult | null;
  history: CharacterHistoryEntry[];
}
export interface CharacterInput {
  name: string;
  league: string;
  level?: number;
  className?: string;
  ascendancy?: string;
  buildProfileId?: string;
  stage?: 'campaign' | 'early-maps' | 'established' | 'transition' | 'endgame' | 'aspirational';
  budget?: number;
  targetContent?: string;
  currentIssues?: string;
}
export interface LoadoutSkill {
  name: string;
  supports: string[];
  spiritReservation?: number;
  tags?: string[];
}
export interface CharacterBuildLoadout {
  patch: string;
  source: 'manual' | 'poe-api' | 'imported';
  confidence: 'Low' | 'Medium' | 'High';
  mainSkill: string;
  weaponSet: string;
  availableSpirit?: number;
  skills: LoadoutSkill[];
  keyPassives: string[];
}
export interface CharacterBuildKnowledge {
  loadout: CharacterBuildLoadout;
  analysis: {
    reservedSpirit: number;
    remainingSpirit: number | null;
    dependencies: Array<{
      from: string;
      to: string;
      kind: 'support' | 'weapon' | 'passive' | 'spirit';
    }>;
    warnings: string[];
  };
  similar: {
    matches: Array<{
      profileId: string;
      name: string;
      score: number;
      reasons: string[];
    }>;
    sampleSize: number;
    confidence: 'Low' | 'Medium' | 'High';
    limitation: string;
  };
  provenance: { patch: string; source: string; confidence: string };
}
export interface LoadoutSimulation {
  before: CharacterBuildKnowledge['analysis'];
  after: CharacterBuildKnowledge['analysis'];
  spiritDelta: number;
  newWarnings: string[];
  resolvedWarnings: string[];
  safe: boolean;
  verdict: string;
}
export interface CharacterActionPlan {
  characterId: number;
  budget: number;
  score: number;
  purchases: Array<{
    rank: number;
    slot: string;
    reason: string;
    priority: 'High' | 'Medium' | 'Low';
    suggestedBudget: number;
    tradeUrl: string | null;
    requiresEquippedItem: boolean;
  }>;
  blockers: string[];
  warning: string;
}
export interface ShoppingPlanItem {
  id: number;
  slot: string;
  reason: string;
  priority: 'High' | 'Medium' | 'Low';
  suggestedBudget: number;
  status: 'searching' | 'candidate' | 'bought' | 'discarded';
  listingId?: string;
  itemText?: string;
  price?: number;
  tradeUrl?: string;
  scoreDelta?: number;
  updatedAt: string;
}
export interface MarketUpgradeCandidates {
  candidates: Array<RankedUpgradeCandidate & { itemText?: string; listing?: Listing }>;
  dataSource: MarketDataSource;
  sampleSize: number;
  warning: string;
  officialUrl: string;
}
export interface PurchaseHistory {
  purchases: Array<{
    id: number;
    planItemId: number;
    slot: string;
    price: number;
    currency: string;
    scoreBefore: number;
    scoreAfter: number;
    reversedAt?: string;
    reversalReason?: string;
    createdAt: string;
  }>;
  totalSpent: number;
  totalScoreGain: number;
  costPerScore: number | null;
}
export interface ReplacementSaleDraft {
  id: number;
  purchaseId: number;
  slot: string;
  itemText: string;
  status: 'needs-price' | 'listed';
  createdAt: string;
}
export interface CharacterEvolution {
  snapshots: Array<{
    id: number;
    patch: string;
    score: number;
    createdAt: string;
    resistances: Record<string, number>;
    spirit: number;
    defences: Record<string, number>;
  }>;
  purchases: Array<Record<string, unknown>>;
  bestPurchase: Record<string, unknown> | null;
  worstPurchase: Record<string, unknown> | null;
  currentBudget: number | null;
  patches: string[];
}
export interface NetUpgradeCosts {
  rows: Array<{
    id: number;
    slot: string;
    price: number;
    scoreBefore: number;
    scoreAfter: number;
    reversedAt?: string;
    saleStatus: string;
    confirmedReturn: number;
    netCost: number;
    costPerScore: number | null;
  }>;
  warning: string;
}
export interface CharacterAlert {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadataJson?: string;
  readAt?: string;
  createdAt: string;
}
export interface RecommendationCalibration {
  sampleSize: number;
  averageError: number;
  bySlot: Array<{
    slot: string;
    count: number;
    averageError: number;
    confidence: 'Low' | 'Medium' | 'High';
  }>;
  rows: Array<Record<string, unknown>>;
  limitation: string;
}
export interface ReconciliationResult {
  differences: Array<{
    slot: string;
    localItemText: string;
    officialItemText: string;
    status: 'official-only' | 'local-only' | 'changed';
  }>;
  applied: boolean;
  requiresConfirmation: boolean;
}
export interface PublicCharacterProfile {
  source: 'poe.ninja-public-profile';
  sourceUrl: string;
  importedAt: string;
  updatedAt: string | null;
  identity: {
    account: string;
    name: string;
    league: string;
    level: number;
    className: string;
    ascendancy: string;
  };
  stats: Record<string, number | null>;
  passives: {
    allocated: number;
    anoints: number;
    ascendancyPoints: number;
    bonusPassives: number;
    treeVersion: string;
    nodeIds: number[];
  };
  keystones: Array<{ name: string; icon?: string; stats: string[] }>;
  questRewards: { claimed: string[]; missingCount: null; coverageNote: string };
  skills: Array<{
    name: string;
    level: number | null;
    icon?: string;
    supports: Array<{ name: string; level: number | null; icon?: string }>;
    reportedDps?: Array<{ label: string; value: number }>;
  }>;
  equipment?: Array<{
    slot: string;
    name: string;
    baseType: string;
    rarity: string;
    icon?: string;
    itemLevel: number | null;
    sockets: string[];
    requirements: string[];
    modifiers: string[];
  }>;
  equipmentCount: number;
  provenance: {
    publicProfile: boolean;
    confidence: 'High';
    limitations: string[];
  };
}
export interface ProfileDiagnostic {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  evidence: string;
  confidence: 'High' | 'Medium';
}
export interface ProfileCatalogStatus {
  passiveTree: { status: 'supported' | 'unsupported'; reason?: string };
  quests: { status: 'supported' | 'unsupported'; reason?: string };
  ascendancy: { status: 'supported' | 'unsupported'; reason?: string };
}
export interface PublicProfileSnapshot {
  id: number;
  treeVersion: string;
  sourceUpdatedAt: string | null;
  importedAt: string;
}
export interface PublicProfileComparison {
  before: { importedAt: string; updatedAt: string | null };
  after: { importedAt: string; updatedAt: string | null };
  stats: Array<{ key: string; before: number; after: number; delta: number }>;
  passives: {
    before: number;
    after: number;
    delta: number;
    added: number[];
    removed: number[];
  };
  skills: { added: string[]; removed: string[] };
  quests: { added: string[]; removed: string[] };
  equipmentCount: { before: number; after: number; delta: number };
}

export interface CraftingItemState {
  itemClass: string;
  baseType: string;
  itemLevel?: number;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  quality: number;
  corrupted: boolean;
  prefixes: NormalizedModifier[];
  suffixes: NormalizedModifier[];
  modifierGroups: string[];
  sockets: string[];
  currencySpent: Array<{ currencyId: string; label: string }>;
  estimatedValue?: number;
  goal?: CraftGoal;
}
export interface CraftGoal {
  description: string;
  minimumItemLevel?: number;
  mandatoryGroups?: string[];
  targetStats?: Record<string, number>;
  buyPrice?: number;
  currentValue?: number;
}
export interface ActionEvaluation {
  currencyId: string;
  label: string;
  legal: boolean;
  reasons: string[];
  reversible: false;
  outcomeCertainty: 'guaranteed' | 'random-from-pool';
  knownChance?: number;
  accumulatedCostCount: number;
  risk: 'low' | 'medium' | 'high' | 'unknown';
  recommendedStop: boolean;
  stopReason?: string;
}
export interface CraftingCurrencyDef {
  id: string;
  label: string;
  effect: string;
  compatibleRarities: string[];
  outcomeCertainty: 'guaranteed' | 'random-from-pool';
  knownChance?: number;
  notes?: string;
}
export interface CraftingHistoryEntry {
  id: number;
  characterId: number | null;
  action: string;
  currencySpentCount: number;
  valueBefore: number | null;
  valueAfter: number | null;
  gainLoss: number | null;
  createdAt: string;
  nextSafeAction: string | null;
  risks: string[];
}

export interface MarketSnapshot {
  id: number;
  baseType: string;
  itemClass: string;
  league: string;
  dataSource: MarketDataSource;
  median: number;
  fairPrice: number;
  quickSell: number;
  maximumLikelyPrice: number;
  sampleSize: number;
  distinctSellers: number;
  liquidity: 'unknown' | 'low' | 'medium' | 'high';
  priceFixSuspectCount: number;
  confidence: 'High' | 'Medium' | 'Low';
  createdAt: string;
}
export interface MarketHistoryResult {
  baseType: string;
  league: string;
  snapshots: MarketSnapshot[];
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  changePercent: number | null;
  priceFixFlaggedSnapshots: number;
  limitations: string[];
}

export interface RegressionResult {
  passed: boolean;
  matchedFixtures: number;
  totalFixtures: number;
  issues: string[];
}
export interface CompareResult {
  addedIds: string[];
  removedIds: string[];
  unchangedCount: number;
}
export interface CatalogVersion {
  id: number;
  dataset: string;
  patch: string;
  dataVersion: string;
  source: string;
  status: 'staged' | 'active' | 'rolled-back' | 'deprecated';
  entryCount: number;
  regression: RegressionResult;
  compare: CompareResult;
  createdAt: string;
  activatedAt: string | null;
  deprecatedAt: string | null;
}
