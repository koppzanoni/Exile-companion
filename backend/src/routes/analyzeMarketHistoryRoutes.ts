import express from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { getSettings } from '../db.js';
import { builtInRosterCatalog } from '../rosterCatalog.js';
import {
  cachedMarketPipeline,
  characterOwnedByUser,
  findCachedListings,
  getActiveBuildProfile,
  getCharacterRow,
  getSavedCharacterTotals,
  hollowPlanSchema,
  message,
  resolveBuildFitProfile,
  saveCheck,
  spiritPlanSchema,
} from '../appHelpers.js';
import { analyzeBuildFit } from '../buildFit.js';
import { genericBuildFitProfile } from '../buildProfiles.js';
import { mergeItem, parseItemText } from '../itemParser.js';
import { compareItems } from '../itemComparison.js';
import { decideItem } from '../itemDecision.js';
import { assessCraftingPotential } from '../craftingPotential.js';
import { evaluateItem } from '../quality.js';
import { buildTradeUrl, parseManualListings } from '../trade.js';
import { manualMarketAnalysis, toLegacyEstimate, type MarketAnalysisResult } from '../marketPipeline.js';
import { recordPriceSnapshot, getMarketHistory } from '../marketHistory.js';
import { buildItemAnalysis } from '../normalizedItemParser.js';
import {
  deriveBuildWeights,
  deriveCritical,
  deriveDamageTags,
  deriveSlotWeights,
  valueItemStats,
} from '../statValuationEngine.js';
import { buildFourEvaluations } from '../fourEvaluations.js';
import { analyzeOpportunity } from '../opportunityAnalysis.js';
import { isLiveVerifiedSource, type ItemEvaluation, type ItemStats, type Listing } from '../types.js';
import { buildBeginnerSummary } from '../beginnerSummary.js';
import { explainWithGemini } from '../gemini.js';
import { loadActiveSkillMechanicProfile } from '../skillMechanicProfiles.js';
import { evaluateOffence } from '../offenceEvaluator.js';
import { evaluateAnalysisFoundations } from '../analysisFoundations.js';

const analyzeSchema = z.object({
  league: z.string().min(1).default('Runes of Aldur'),
  itemText: z.string().optional().default(''),
  equippedItemText: z.string().optional().default(''),
  item: z.record(z.unknown()).optional().default({}),
  manualListings: z.string().optional().default(''),
  divineToExalted: z.number().positive().optional(),
  save: z.boolean().optional().default(true),
  selectedBuildProfileId: z.string().trim().max(100).optional(),
  selectedBuildProfileName: z.string().trim().max(100).optional(),
  characterTotals: z
    .object({
      fireResistance: z.number().optional(),
      coldResistance: z.number().optional(),
      lightningResistance: z.number().optional(),
      chaosResistance: z.number().optional(),
      strength: z.number().optional(),
      dexterity: z.number().optional(),
      intelligence: z.number().optional(),
      spirit: z.number().optional(),
    })
    .optional(),
  characterId: z.number().int().positive().optional(),
  // Defaults to the roster catalog's own current patch (not a separate literal) so this can
  // never silently drift out of sync with what rosterCompatibility() actually checks against.
  patch: z.string().trim().max(30).optional().default(builtInRosterCatalog.patch),
  offenceScenario: z
    .object({
      contentTarget: z.enum(['mapping', 'bossing', 'unknown']).default('unknown'),
      targetRarity: z.enum(['normal', 'magic', 'rare', 'unique', 'unknown']).default('unknown'),
      durationSeconds: z.number().positive().max(600).default(10),
      movementShare: z.number().min(0).max(1).default(0),
      manaRecoveryPerSecond: z.number().nonnegative().optional(),
      hitChance: z.number().min(0).max(1).optional(),
      increasedDamagePercent: z.number().optional(),
      moreDamageMultipliers: z.array(z.number().positive()).max(20).optional(),
      criticalChance: z.number().min(0).max(1).optional(),
      criticalDamageBonus: z.number().nonnegative().optional(),
      reloadSpeedPercent: z.number().optional(),
      ammunitionPreservationChance: z.number().min(0).max(0.95).optional(),
    })
    .optional(),
  spiritPlan: spiritPlanSchema.optional(),
  nonIdolAugments: z.number().int().nonnegative().nullable().optional(),
  hollowPlan: hollowPlanSchema.optional(),
});

export function installAnalyzeMarketHistoryRoutes(app: express.Express, db: AppDatabase) {
  app.post('/api/analyze', async (req, res) => {
    const validated = analyzeSchema.safeParse(req.body);
    if (!validated.success)
      return res.status(400).json({
        error: validated.error.issues.map((i) => i.message).join(', '),
      });
    try {
      const input = validated.data;
      const settings = getSettings(db);
      const rate = input.divineToExalted || settings.divineToExalted;
      const item = mergeItem(parseItemText(input.itemText), input.item as Partial<ItemStats>);
      if (!item.baseType && !item.itemType)
        return res.status(400).json({ error: 'Paste an item or enter at least its base/type.' });
      if (input.characterId && !characterOwnedByUser(db, input.characterId, res.locals.user?.userId))
        return res.status(404).json({ error: 'Character not found.' });
      const character = input.characterId ? getCharacterRow(db, input.characterId) : null;
      if (character && !req.body.league) input.league = character.league;
      const effectiveCharacterTotals = {
        ...(character ? getSavedCharacterTotals(db, character.id) : {}),
        ...input.characterTotals,
      };
      const normalizedItem = buildItemAnalysis(item, input.itemText, {
        league: input.league,
      });
      const selectedKey =
        input.selectedBuildProfileId || input.selectedBuildProfileName || character?.buildProfileId || undefined;
      const selectedBuild = selectedKey
        ? resolveBuildFitProfile(db, selectedKey)
        : getActiveBuildProfile(db) || genericBuildFitProfile;
      if (!selectedBuild) return res.status(400).json({ error: 'Selected build profile was not found.' });
      const personalizationProfile = selectedBuild.source === 'generic' ? undefined : selectedBuild;
      const evaluation = evaluateItem(item, personalizationProfile);
      evaluation.buildFitAnalysis = analyzeBuildFit(item, evaluation, selectedBuild, effectiveCharacterTotals);
      const statContextBase = {
        critical: deriveCritical(selectedBuild),
        damageTags: deriveDamageTags(selectedBuild),
        current: effectiveCharacterTotals,
        requirements: {
          strength:
            selectedBuild.attributeRequirements?.strength ??
            selectedBuild.priorities.find((p) => p.stat === 'strength')?.minimum,
          dexterity:
            selectedBuild.attributeRequirements?.dexterity ??
            selectedBuild.priorities.find((p) => p.stat === 'dexterity')?.minimum,
          intelligence:
            selectedBuild.attributeRequirements?.intelligence ??
            selectedBuild.priorities.find((p) => p.stat === 'intelligence')?.minimum,
          spirit: selectedBuild.spiritTarget ?? selectedBuild.priorities.find((p) => p.stat === 'spirit')?.minimum,
        },
        caps: {
          fireResistance:
            selectedBuild.resistanceCaps?.fireResistance ??
            selectedBuild.priorities.find((p) => p.stat === 'fireResistance')?.minimum,
          coldResistance:
            selectedBuild.resistanceCaps?.coldResistance ??
            selectedBuild.priorities.find((p) => p.stat === 'coldResistance')?.minimum,
          lightningResistance:
            selectedBuild.resistanceCaps?.lightningResistance ??
            selectedBuild.priorities.find((p) => p.stat === 'lightningResistance')?.minimum,
          chaosResistance:
            selectedBuild.resistanceCaps?.chaosResistance ??
            selectedBuild.priorities.find((p) => p.stat === 'chaosResistance')?.minimum,
        },
        buildWeight: deriveBuildWeights(selectedBuild),
      };
      const candidateSlot = evaluation.categoryAnalysis?.detectedCategory.key || 'other';
      const candidateStatContext = {
        ...statContextBase,
        slot: candidateSlot,
        slotWeight: deriveSlotWeights(selectedBuild, candidateSlot),
      };
      let effectiveCandidateStatContext = candidateStatContext;
      let statValuation = valueItemStats(item, candidateStatContext);
      let equippedItem: ItemStats | undefined;
      let equippedEvaluation: ItemEvaluation | undefined;
      let equippedStatValuation: ReturnType<typeof valueItemStats> | undefined;
      if (input.equippedItemText.trim()) {
        equippedItem = mergeItem(parseItemText(input.equippedItemText), {});
        if (!equippedItem.baseType && !equippedItem.itemType)
          return res.status(400).json({ error: 'The equipped item could not be read.' });
        equippedEvaluation = evaluateItem(equippedItem, personalizationProfile);
        equippedEvaluation.buildFitAnalysis = analyzeBuildFit(
          equippedItem,
          equippedEvaluation,
          selectedBuild,
          effectiveCharacterTotals,
        );
        const equippedSlot = equippedEvaluation.categoryAnalysis?.detectedCategory.key || 'other';
        const replacementCurrent = { ...effectiveCharacterTotals };
        for (const stat of [
          'fireResistance',
          'coldResistance',
          'lightningResistance',
          'chaosResistance',
          'strength',
          'dexterity',
          'intelligence',
          'spirit',
        ] as const) {
          replacementCurrent[stat] = Math.max(
            0,
            (Number(effectiveCharacterTotals[stat]) || 0) - (Number(equippedItem[stat]) || 0),
          );
        }
        const replacementContext = {
          ...statContextBase,
          current: replacementCurrent,
        };
        effectiveCandidateStatContext = {
          ...replacementContext,
          slot: candidateSlot,
          slotWeight: deriveSlotWeights(selectedBuild, candidateSlot),
        };
        statValuation = valueItemStats(item, effectiveCandidateStatContext);
        equippedStatValuation = valueItemStats(equippedItem, {
          ...replacementContext,
          slot: equippedSlot,
          slotWeight: deriveSlotWeights(selectedBuild, equippedSlot),
        });
      }
      const manual = parseManualListings(input.manualListings, rate);
      let marketAnalysis: MarketAnalysisResult;
      if (manual.length) {
        marketAnalysis = manualMarketAnalysis(item, manual, rate);
      } else {
        marketAnalysis = await cachedMarketPipeline(db, {
          item,
          itemAnalysis: normalizedItem,
          build: selectedBuild,
          league: input.league,
          divineRate: rate,
        });
        if (!marketAnalysis.usedCount) {
          const cached = findCachedListings(db, item, input.league, rate);
          if (cached.length) {
            const cacheAnalysis = manualMarketAnalysis(item, cached, rate);
            marketAnalysis = {
              ...cacheAnalysis,
              strategyUsed: 'cache',
              dataSource: 'cache',
              officialUrl: marketAnalysis.officialUrl,
              warning: `${marketAnalysis.warning} Showing previously saved official comparable listings instead.`,
            };
          }
        }
      }
      const dataSource = marketAnalysis.dataSource;
      const warning = marketAnalysis.warning;
      if (item.baseType)
        recordPriceSnapshot(db, {
          baseType: item.baseType,
          itemClass: item.itemType || item.itemClass || '',
          league: input.league,
          dataSource,
          valuation: marketAnalysis.valuation,
        });
      const officialUrl = marketAnalysis.officialUrl || buildTradeUrl(item, input.league);
      const estimate = toLegacyEstimate(marketAnalysis, item, rate);
      const comparableListings: Listing[] = [...marketAnalysis.comparablesUsed, ...marketAnalysis.comparablesRejected];
      const marketVerified = isLiveVerifiedSource(dataSource) && Boolean(estimate);
      const craftingPotential = assessCraftingPotential(item, evaluation, {
        craftingRiskTolerance: settings.craftingRiskTolerance,
        showCurrencyWarnings: settings.showCurrencyWarnings,
        conservativeCraftingRecommendations: settings.conservativeCraftingRecommendations,
        marketVerified,
      });
      const comparison = equippedItem
        ? compareItems(item, equippedItem, {
            selectedBuildProfile: selectedBuild,
            candidateEvaluation: evaluation,
            equippedEvaluation,
            characterTotals: effectiveCharacterTotals,
            candidateMarketValue: estimate?.fair,
            marketVerified,
          })
        : undefined;
      const recommendation = decideItem(
        {
          item,
          evaluation,
          comparison,
          estimate,
          dataSource,
          warning,
          statValuation,
        },
        craftingPotential,
      );
      const { evaluations, decision } = buildFourEvaluations({
        evaluation,
        comparison,
        craftingPotential,
        estimate,
        marketAnalysis,
        dataSource,
        recommendation,
      });
      const opportunity = analyzeOpportunity({
        item,
        statContext: effectiveCandidateStatContext,
        candidateOverallScore: statValuation.overallScore,
        estimate,
        marketAnalysis,
        comparison,
        craftingPotential,
        wastedStats: statValuation.contributions.filter((c) => c.wasted).map((c) => c.stat),
      });
      const beginnerSummary = buildBeginnerSummary({
        comparison,
        decision,
        evaluation,
      });
      const skillMechanicProfile = loadActiveSkillMechanicProfile(db, selectedBuild.mainSkill, input.patch);
      const offenceScenario = input.offenceScenario || {
        contentTarget: 'unknown' as const,
        targetRarity: 'unknown' as const,
        durationSeconds: 10,
        movementShare: 0,
      };
      const offenceResult = evaluateOffence(skillMechanicProfile, item, offenceScenario, input.patch);
      const equippedOffenceResult = equippedItem
        ? evaluateOffence(skillMechanicProfile, equippedItem, offenceScenario, input.patch)
        : undefined;
      const analysisFoundations = evaluateAnalysisFoundations(db, {
        className: selectedBuild.className,
        ascendancy: selectedBuild.ascendancy,
        patch: input.patch,
        spirit: input.spiritPlan,
        nonIdolAugments: input.nonIdolAugments,
        hollow: input.hollowPlan,
      });
      const aiAnalysis = await explainWithGemini({
        item: {
          name: item.name,
          baseType: item.baseType,
          itemType: item.itemType,
          rarity: item.rarity,
          itemLevel: item.itemLevel,
          stats: item,
        },
        category: evaluation.categoryAnalysis,
        build: {
          name: selectedBuild.name,
          className: selectedBuild.className,
          ascendancy: selectedBuild.ascendancy,
          mainSkill: selectedBuild.mainSkill,
          buildFit: evaluation.buildFitAnalysis,
        },
        deterministicEvaluation: {
          score: evaluation.score,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          recommendation: recommendation.action,
          craftingPotential,
        },
        market: {
          dataSource,
          warning,
          estimate: estimate
            ? {
                quickSell: estimate.quickSell,
                fair: estimate.fair,
                high: estimate.high,
                confidence: estimate.confidence,
                usedCount: estimate.usedCount,
              }
            : null,
          valuation: marketAnalysis.valuation,
        },
        comparison,
        statValuation,
        offenceResult,
        analysisFoundations,
      });
      // The AI is asked to restate a build-fit score alongside the deterministic one already in
      // its own context, with no enforcement that the two agree — always trust the app's real
      // computed score over whatever number the model reports back.
      if (aiAnalysis.available) aiAnalysis.result.buildFitScore = evaluation.buildFitAnalysis.score;
      const payload = {
        item,
        normalizedItem,
        evaluation,
        comparison,
        craftingPotential,
        recommendation,
        evaluations,
        decision,
        opportunity,
        beginnerSummary,
        aiAnalysis,
        league: input.league,
        dataSource,
        warning,
        officialUrl,
        divineToExalted: rate,
        estimate,
        comparableListings,
        marketAnalysis,
        statValuation,
        equippedStatValuation,
        offenceResult,
        equippedOffenceResult,
        ...analysisFoundations,
        mechanicCoverage: offenceResult.mechanicCoverage,
        exactDpsAvailable: offenceResult.mechanicCoverage.exactDpsAvailable,
        breakpointFailures: offenceResult.breakpointFailures,
        assumptions: offenceResult.assumptions,
        missingInputs: offenceResult.missingInputs,
        sourceEvidence: offenceResult.sourceEvidence,
        patchCompatibility: offenceResult.patchCompatibility,
        precisionContext: {
          buildProfile: { id: selectedBuild.id, name: selectedBuild.name, source: selectedBuild.source },
          characterTotalsSource: character
            ? 'saved-character-plus-request'
            : input.characterTotals
              ? 'request'
              : 'unknown',
          replacementAware: Boolean(equippedItem),
          requirements: statContextBase.requirements,
          resistanceCaps: statContextBase.caps,
          meta: {
            status: 'unknown',
            reason: 'No validated, patch-specific meta catalog is active; build profile priorities are used instead.',
          },
        },
        timestamp: new Date().toISOString(),
      };
      let checkId: number | undefined;
      if (input.save) checkId = saveCheck(db, payload);
      if (character) {
        const summary = `${decision.action}: ${item.name || item.baseType || item.itemType || 'item'}${estimate ? ` (~${estimate.fair} Exalted)` : ''}`;
        db.prepare('INSERT INTO character_analysis_history(character_id, check_id, summary) VALUES (?, ?, ?)').run(
          character.id,
          checkId ?? null,
          summary,
        );
        db.prepare('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(character.id);
      }
      return res.json({ id: checkId, characterId: character?.id, ...payload });
    } catch (error) {
      return res.status(500).json({ error: message(error) });
    }
  });

  app.get('/api/market-history', (req, res) => {
    const parsed = z
      .object({
        baseType: z.string().trim().min(1),
        league: z.string().trim().min(1),
      })
      .safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({
        error: 'Provide a baseType and league to look up market history.',
      });
    return res.json(getMarketHistory(db, parsed.data.baseType, parsed.data.league));
  });
}
