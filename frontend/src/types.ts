export interface ItemInput {
  itemType: string; itemClass?:string; baseType: string; name?: string; rarity: string; itemLevel?: number; requiredLevel?: number;
  quality?: number; corrupted?: boolean; sanctified?: boolean;
  energyShield?: number; evasion?: number; armour?: number; deflection?: number; runicWard?: number; life?: number; mana?: number;
  intelligence?: number; strength?: number; dexterity?: number; fireResistance?: number;
  coldResistance?: number; lightningResistance?: number; chaosResistance?: number; movementSpeed?: number;
  rarityFind?: number; spirit?: number; stunThreshold?: number; customMods: string[];
  physicalDamageMin?: number; physicalDamageMax?: number; fireDamageMin?: number; fireDamageMax?: number;
  coldDamageMin?: number; coldDamageMax?: number; lightningDamageMin?: number; lightningDamageMax?: number;
  chaosDamageMin?: number; chaosDamageMax?: number; attacksPerSecond?: number; criticalHitChance?: number;
  blockChance?: number; increasedBlockChance?: number; attackSpeedBonus?: number; castSpeed?: number; spellDamage?: number; criticalDamageBonus?: number;
  projectileSkillLevels?: number; meleeSkillLevels?: number; spellSkillLevels?: number; minionSkillLevels?: number; lifeRegeneration?: number; manaRegeneration?: number;
  flaskChargesGained?: number; reducedFlaskChargesUsed?: number; charmSlots?: number;
  parsedLines?:ParsedLineDebug[];
}
export interface Listing { id: string; name: string; baseType: string; price: number; currency: string; exaltedPrice: number; similarity?: number; source: string; account?: string; indexedAt?: string; excludedReason?: string; mainDifference?: string; foundByStrategy?: string; }
export interface Estimate {
  quickSell: number; fair: number; high: number; divine: { quickSell: number; fair: number; high: number };
  confidence: string; positiveMods: string[]; negativeMods: string[]; explanation: string[]; usedCount: number; excludedCount: number;
}
export interface BuildFit { name: string; score: number; fit: 'weak'|'possible'|'strong'; reasons: string[]; conflicts: string[]; }
export type BuildStat = 'life'|'mana'|'energyShield'|'armour'|'evasion'|'movementSpeed'|'fireResistance'|'coldResistance'|'lightningResistance'|'chaosResistance'|'strength'|'dexterity'|'intelligence'|'spirit'|'rarityFind'|'attacksPerSecond'|'criticalHitChance'|'physicalDps'|'elementalDps';
export interface BuildPriority { stat: BuildStat; level: 'required'|'high'|'useful'; minimum?: number; }
export type BuildProvider = 'Mobalytics'|'poe.ninja'|'Maxroll'|'PoE Vault'|'pobb.in';
export interface PersonalizedBuildFit { buildName: string; className: string; score: number; fit: 'poor'|'partial'|'strong'|'excellent'; verdict: string; matched: string[]; missing: string[]; conflicts: string[]; }
export type ItemCategory = 'body-armour'|'helmet'|'gloves'|'boots'|'shield'|'focus'|'quiver'|'ring'|'amulet'|'belt'|'bow'|'crossbow'|'one-handed-melee'|'two-handed-melee'|'staff'|'quarterstaff'|'wand'|'sceptre'|'other';
export interface ItemCategoryInfo { key: ItemCategory; label: string; priorities: string[]; }
export interface ParsedLineDebug { line:string;fields:string[];values:Array<string|number|boolean>; }
export interface CategoryAnalysis { detectedCategory:ItemCategoryInfo;detectionReason:string;categoryScore:number;positiveStats:string[];weakOrWastedStats:string[];missingImportantStats:string[];marketRelevantStats:string[];buildRelevantStats:string[];tradeSearchPriorities:string[];confidence:number;warnings:string[];parsedLines:ParsedLineDebug[]; }
export interface BuildFitProfile {
  id:string;source:'default'|'custom'|'generic';name:string;className:string;ascendancy?:string;mainSkill:string;
  guideUrl?:string;stage:'campaign'|'early-maps'|'endgame';evaluationStyle:'balanced'|'campaign-race'|'hardcore-gauntlet';
  preferredWeaponTypes:ItemCategory[];damageTypes:string[];defensiveLayers:string[];offensiveStats:string[];defensiveStats:string[];
  attributes:string[];utilityStats:string[];wastedStats:string[];valuableSlots:ItemCategory[];categoryPriorities:Partial<Record<ItemCategory,string[]>>;
  explanationRules:string[];defenceStyle:'life-armour'|'life-evasion'|'energy-shield'|'hybrid'|'custom';priorities:BuildPriority[];
  requiredMods:string[];desiredMods:string[];notes?:string;
}
export type BuildProfile = BuildFitProfile;
export interface ImportedField { field:string; value:string; excerpt:string; confidence:'High'|'Medium'|'Low'; needsConfirmation:boolean; }
export interface BuildImportResult { profile: BuildFitProfile; source: 'direct'|'reader'; provider:BuildProvider; equipmentSummary: string; detected: string[]; fields:ImportedField[]; method:'direct-html'|'jina-reader'; importedAt:string; partial:boolean; warnings: string[]; snapshotId?:number; }
export interface CustomBuildProfileInput {name:string;mainSkill:string;className:string;ascendancy?:string;weaponType?:ItemCategory;mainDamageType:string;defensiveLayer:string;importantStats:string[];badStats:string[];notes?:string;}
export interface BuildFitAnalysis {profileId:string;profileName:string;buildSpecific:boolean;score:number;label:'Bad'|'Usable'|'Good'|'Great'|'Build-defining';fitsBecause:string[];doesNotFitBecause:string[];bestUseCase:'leveling'|'campaign'|'early maps'|'endgame'|'bossing'|'niche'|'vendor';missingImportantStats:string[];wastedStats:string[];recommendedAction:'Use'|'Sell'|'Craft'|'Replace Soon'|'Vendor'|'Price Check';confidence:number;warnings:string[];}
export type ItemAction='Use'|'Sell'|'Craft'|'Replace Soon'|'Price Check'|'Vendor'|'Keep for Later';
export interface CraftingPotential {score:number;label:'Do Not Craft'|'Low Potential'|'Maybe Craft'|'Good Crafting Base'|'High Potential'|'Premium Crafting Base';confidence:'Low'|'Medium'|'High';recommendation:string;reasons:string[];risks:string[];bestPossibleImprovements:string[];avoidActions:string[];suggestedCurrencyUse:string[];currencyWarnings:string[];baseQuality:{score:number;label:string;reasons:string[]};rollQuality:{score:number;label:string;strongRolls:string[];weakRolls:string[];missingRolls:string[]};}
export interface AppSettings {divineToExalted:number;defaultLeague:string;craftingRiskTolerance:'Low'|'Medium'|'High';showCurrencyWarnings:boolean;conservativeCraftingRecommendations:boolean;interfaceMode:'Beginner'|'Advanced';}
export interface NormalizedModifier {id:string;text:string;type:'implicit'|'prefix'|'suffix'|'unknown';group?:string;tier?:number;minimumRoll?:number;maximumRoll?:number;actualRoll?:number;rollPercentile?:number;tags:string[];local:boolean;hybrid?:boolean;confidence?:'High'|'Medium'|'Low';crafted:boolean;desecrated:boolean;}
export interface NormalizedItem {itemClass:string;baseType:string;rarity:string;itemLevel?:number;corrupted:boolean;prefixes:NormalizedModifier[];suffixes:NormalizedModifier[];implicitModifiers:NormalizedModifier[];unknownModifiers:NormalizedModifier[];}
export interface CraftRoute {budget:string;steps:Array<{action:string;preconditions:string[];outcomes:string[];probability:string;risk?:'low'|'medium'|'high'|'unknown'}>;blocked:Array<{action:string;reasons:string[]}>;unknownProbability:boolean;}
export interface CraftComparison { recommendation:'continue'|'sell'|'buy-instead'|'unknown'; reason:string; }
export interface CraftPlan {status:string;prerequisites:string[];routes:CraftRoute[];stopConditions:string[];warning?:string;comparison?:CraftComparison;state:{availableActions:string[];blockedActions:Array<{action:string;reason:string}>;openPrefixes:number|null;openSuffixes:number|null};}
export interface KnowledgeStatus {patches:Array<Record<string,unknown>>;sources:Array<Record<string,unknown>>;counts:Record<string,number>;generatedAt:string;}
export interface ItemRecommendation {action:ItemAction;confidence:'Low'|'Medium'|'High';shortReason:string;detailedReason:string[];secondaryAction?:ItemAction;doThisNext:string[];warnings:string[];hiddenValueFlags:string[];craftingPotential:CraftingPotential;whatWouldMakeBetter:string[];checkBeforeSelling:string[];safeToVendor:boolean;manualPriceCheck:boolean;mayHaveHiddenValue:boolean;bestUseCase:BuildFitAnalysis['bestUseCase'];}
export interface ModifierRollInsight { modifier:string; tier?:number; percentile:number; label:'low'|'average'|'high'|'perfect'; }
export interface KnowledgeAssessment { ruleset:string; confidence:{score:number;level:'low'|'medium'|'high';reasons:string[];warnings:string[]};rolls:ModifierRollInsight[];recognizedModifiers:number;totalModifiers:number;itemLevelNote:string;craftingNotes:string[]; }
export interface ItemEvaluation { score: number; grade: 'poor'|'basic'|'good'|'excellent'|'elite'; label: string; verdict: string; marketability: 'low'|'niche'|'broad'; strengths: string[]; weaknesses: string[]; buildFits: BuildFit[]; upgradePriorities: string[]; personalized?: PersonalizedBuildFit; category?: ItemCategoryInfo; knowledge?:KnowledgeAssessment; categoryAnalysis?:CategoryAnalysis; buildFitAnalysis?:BuildFitAnalysis; }
export type ComparisonVerdict='Clear Upgrade'|'Small Upgrade'|'Sidegrade'|'Situational Upgrade'|'Defensive Upgrade'|'Offensive Upgrade'|'Downgrade'|'Not Comparable'|'Needs Manual Review';
export interface CharacterTotals {fireResistance?:number;coldResistance?:number;lightningResistance?:number;chaosResistance?:number;strength?:number;dexterity?:number;intelligence?:number;spirit?:number;}
export interface CharacterImpact {before:Record<string,number>;after:Record<string,number>;warnings:string[];}
export interface ItemComparison {enabled:boolean;comparable:boolean;compatible:boolean;candidateCategory:ItemCategoryInfo;equippedCategory:ItemCategoryInfo;verdict:ComparisonVerdict;explanation:string;confidence:'Low'|'Medium'|'High';scoreDelta:number;buildFitDelta?:number;personalizedDelta?:number;gains:string[];improvements:string[];losses:string[];warnings:string[];riskFlags:string[];statDeltas:Record<string,number>;characterImpact?:CharacterImpact;betterFor:string[];worseFor:string[];recommendationImpact:string;}
export type MarketDataSource = 'live'|'relaxed-live'|'insufficient-live'|'cache'|'manual'|'none';
export interface ValuedComparable { id:string; price:number; currency:'exalted'|'divine'; similarity:number; baseType:string; account?:string; indexedAt?:string; exaltedPrice:number; ageDays:number|null; status:'used'|'rejected'; rejectedReason?:string; }
export interface MarketValuation {
  quickSell:number; fairPrice:number; listingPrice:number; lower:number; upper:number; currency:'exalted';
  confidence:'High'|'Medium'|'Low'; confidenceScore:number; lowConfidenceReason?:string;
  sampleSize:number; usedCount:number; discardedCount:number;
  median:number; trimmedMean:number; q1:number; q3:number; iqr:number;
  minimumReliablePrice:number; centralPrice:number; maximumLikelyPrice:number;
  distinctSellers:number; medianListingAgeDays:number|null; averageSimilarity:number;
  outliers:ValuedComparable[]; priceFixSuspects:ValuedComparable[];
  liquidity:'unknown'|'low'|'medium'|'high'; liquidityBasis:string;
  comparablesUsed:ValuedComparable[]; comparablesRejected:ValuedComparable[];
  warning:string; explanation:string[];
}
export interface MarketAnalysis {
  strategyUsed:string; relaxed:boolean; relaxationSteps:string[];
  foundCount:number; discardedCount:number; usedCount:number;
  averageSimilarity:number; medianListingAgeDays:number|null; distinctSellers:number;
  discardReasons:Record<string,number>; lowConfidenceReason?:string;
  comparablesUsed:Listing[]; comparablesRejected:Listing[];
  valuation:MarketValuation; dataSource:MarketDataSource; officialUrl:string; warning:string;
}
export interface StatContribution {
  stat:string; value:number; score:number; category:'offence'|'defence'|'utility'; reason:string; conditional:boolean; wasted:boolean;
  source:'parsed'|'derived'; local:boolean; tier?:number;
  buildWeight:number; slotWeight:number;
  effectiveBeforeCap:number; effectiveAfterCap:number;
  offenceContribution:number; defenceContribution:number; utilityContribution:number; requirementContribution:number;
}
export interface StatValuation { offenceScore:number; defenceScore:number; utilityScore:number; overallScore:number; contributions:StatContribution[]; warnings:string[]; }
export interface EvaluationFactor { score:number; confidence:'High'|'Medium'|'Low'; summary:string; positiveFactors:string[]; negativeFactors:string[]; dataUsed:string[]; limitations:string[]; }
export interface FourEvaluations { buildFit:EvaluationFactor; upgradeValue:EvaluationFactor; marketValue:EvaluationFactor; craftPotential:EvaluationFactor; }
export type MainDecisionAction = 'Use'|'Sell'|'Craft'|'Keep'|'Discard';
export interface MainDecision { action:MainDecisionAction; reason:string; conditionsToChange:string[]; }
export interface AlternativeListing { listing:Listing; qualityScore:number; extraCost:number; reason:string; }
export interface OpportunityAnalysis {
  betterAlternativeSamePrice?:AlternativeListing;
  betterAlternativeForMore?:AlternativeListing;
  amountNeededForRelevantJump?:{extraCost:number;qualityGain:number;listing:Listing}|null;
  buyVsCraft:{verdict:'buy'|'craft'|'unknown';reason:string};
  wastedExpensiveStats:string[];
  sellingWouldEnableBetterPurchase:{possible:boolean;reason:string};
  bestAlternativeSearchUrl?:string;
  gainVsEquipped:{scoreDelta:number;verdict:string}|null;
  limitations:string[];
}
export interface AIAnalysisResult {summary:string;itemCategory:string;buildFitScore:number;recommendation:'equip'|'sell'|'craft'|'ignore'|'price_check';strongStats:Array<{stat:string;reason:string}>;weakStats:Array<{stat:string;reason:string}>;craftingSuggestions:Array<{action:string;reason:string;confidence:number}>;marketExplanation:string;beginnerExplanation:string;confidence:number;warnings:string[];speculativeMarketEstimate:{available:boolean;low?:number;high?:number;currency?:'exalted';reason:string;confidence:number;limitations:string[]};buildOpinion:{summary:string;strengths:string[];risks:string[];confidence:number};metaOpinion:{available:boolean;summary:string;basis:string[];confidence:number};}
export type AIAnalysis={available:true;model:string;result:AIAnalysisResult}|{available:false;reason:string};
export interface Analysis { id?: number; item: ItemInput; normalizedItem?: NormalizedItem; evaluation: ItemEvaluation; comparison?:ItemComparison; craftingPotential:CraftingPotential; recommendation:ItemRecommendation; league: string; dataSource: MarketDataSource; warning?: string; officialUrl: string; divineToExalted: number; estimate: Estimate | null; comparableListings: Listing[]; marketAnalysis?: MarketAnalysis; statValuation?: StatValuation; equippedStatValuation?: StatValuation; evaluations?: FourEvaluations; decision?: MainDecision; opportunity?: OpportunityAnalysis; beginnerSummary?: string; aiAnalysis?:AIAnalysis; timestamp: string; }
export interface RaceReview { id:number; title:string; cause:string; lesson:string; itemCategory?:string; createdAt:string; }
export type LevelingVerdict = 'buy-now'|'wait'|'not-worth-it';
export interface LevelingListing { id:string; slot:string; name:string; baseType:string; requiredLevel?:number; price:number; currency:'exalted'|'divine'; account?:string; mods:string[]; officialUrl:string; verdict:LevelingVerdict; usefulLevels:number; waitUntilLevel?:number; }
export interface LevelingSlotResult { slot:string; label:string; priorities:string[]; budget:number; listings:LevelingListing[]; officialUrl:string; warning?:string; }
export interface LevelingSearchResult { profile:BuildProfile; source:'direct'|'reader'; provider:BuildProvider; warnings:string[]; level:number; league:string; maxPrice:number; slots:LevelingSlotResult[]; milestone:string; nextMilestoneLevel:number; whatChangesNext:string; }

export interface EquipmentSlotInput { slot:string; itemText:string; }
export interface PoeOAuthConnection {id:number;username:string|null;scope:string;lastSyncAt:string|null;lastError:string|null;}
export interface PoeOAuthStatus {configured:boolean;required:string[];connections:PoeOAuthConnection[];}
export interface PoeRemoteCharacter {name:string;league?:string;level?:number;class?:string;className?:string;ascendancy?:string;}
export interface SlotDiagnosis {
  slot:string; baseType:string|null; overallScore:number|null; weaknessRank:number; wastedStats:string[];
  contributions:{resistances:Record<string,number>;attributes:Record<string,number>;spirit:number;defence:Record<string,number>};
}
export interface DependencyAlert { slot:string; message:string; }
export interface UpgradeOrderEntry { slot:string; reason:string; budgetPriority:'High'|'Medium'|'Low'; }
export interface BuildDoctorResult {
  resistances:{current:Record<string,number>;missing:Record<string,number>;cap:number};
  attributes:{total:Record<string,number>;required:Record<string,number>;met:Record<string,boolean>};
  spirit:{current:number;required?:number;missing?:number;note:string};
  defenceByType:Record<string,number>;
  slots:SlotDiagnosis[];
  weakestSlots:string[];
  wastedStatsOverall:string[];
  recommendedUpgradeOrder:UpgradeOrderEntry[];
  alerts:DependencyAlert[];
  limitations:string[];
}

export interface CharacterSummary { id:number; name:string; league:string; level:number|null; className:string; ascendancy:string; buildProfileId:string; stage:string|null; budget:number|null; targetContent:string; currentIssues:string; updatedAt:string; }
export interface CharacterHistoryEntry { id:number; checkId:number|null; summary:string; createdAt:string; }
export interface CharacterDetail { character:CharacterSummary; equipment:EquipmentSlotInput[]; diagnosis:BuildDoctorResult|null; history:CharacterHistoryEntry[]; }
export interface CharacterInput { name:string; league:string; level?:number; className?:string; ascendancy?:string; buildProfileId?:string; stage?:'campaign'|'early-maps'|'endgame'; budget?:number; targetContent?:string; currentIssues?:string; }

export interface CraftingItemState {
  itemClass:string; baseType:string; itemLevel?:number; rarity:'normal'|'magic'|'rare'|'unique'; quality:number; corrupted:boolean;
  prefixes:NormalizedModifier[]; suffixes:NormalizedModifier[]; modifierGroups:string[]; sockets:string[];
  currencySpent:Array<{currencyId:string;label:string}>; estimatedValue?:number; goal?:CraftGoal;
}
export interface CraftGoal { description:string; minimumItemLevel?:number; mandatoryGroups?:string[]; targetStats?:Record<string,number>; buyPrice?:number; currentValue?:number; }
export interface ActionEvaluation {
  currencyId:string; label:string; legal:boolean; reasons:string[]; reversible:false;
  outcomeCertainty:'guaranteed'|'random-from-pool'; knownChance?:number; accumulatedCostCount:number;
  risk:'low'|'medium'|'high'|'unknown'; recommendedStop:boolean; stopReason?:string;
}
export interface CraftingCurrencyDef { id:string; label:string; effect:string; compatibleRarities:string[]; outcomeCertainty:'guaranteed'|'random-from-pool'; knownChance?:number; notes?:string; }
export interface CraftingHistoryEntry {
  id:number; characterId:number|null; action:string; currencySpentCount:number;
  valueBefore:number|null; valueAfter:number|null; gainLoss:number|null; createdAt:string;
  nextSafeAction:string|null; risks:string[];
}

export interface MarketSnapshot {
  id:number; baseType:string; itemClass:string; league:string; dataSource:MarketDataSource;
  median:number; fairPrice:number; quickSell:number; maximumLikelyPrice:number;
  sampleSize:number; distinctSellers:number; liquidity:'unknown'|'low'|'medium'|'high';
  priceFixSuspectCount:number; confidence:'High'|'Medium'|'Low'; createdAt:string;
}
export interface MarketHistoryResult {
  baseType:string; league:string; snapshots:MarketSnapshot[];
  trend:'rising'|'falling'|'stable'|'unknown'; changePercent:number|null;
  priceFixFlaggedSnapshots:number; limitations:string[];
}

export interface RegressionResult { passed:boolean; matchedFixtures:number; totalFixtures:number; issues:string[]; }
export interface CompareResult { addedIds:string[]; removedIds:string[]; unchangedCount:number; }
export interface CatalogVersion {
  id:number; dataset:string; patch:string; dataVersion:string; source:string;
  status:'staged'|'active'|'rolled-back'|'deprecated'; entryCount:number;
  regression:RegressionResult; compare:CompareResult;
  createdAt:string; activatedAt:string|null; deprecatedAt:string|null;
}
