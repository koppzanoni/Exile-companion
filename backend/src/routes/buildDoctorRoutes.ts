import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { genericBuildFitProfile } from '../buildProfiles.js';
import { diagnoseBuild } from '../buildDoctor.js';
import { evaluateAnalysisFoundations } from '../analysisFoundations.js';
import { mergeItem, parseItemText } from '../itemParser.js';
import { buildTradeUrlWithOptions } from '../trade.js';
import { builtInRosterCatalog } from '../rosterCatalog.js';
import { compareUpgradeCandidates, planUpgradesByBudget } from '../upgradePlanner.js';
import {
  evaluateBuildDoctorOffence,
  getActiveBuildProfile,
  hollowPlanSchema,
  message,
  resolveBuildFitProfile,
  spiritPlanSchema,
} from '../appHelpers.js';

const upgradePlannerSchema = z.object({
  equipment: z
    .array(
      z.object({
        slot: z.string().trim().min(1).max(50),
        itemText: z.string().max(20000),
      }),
    )
    .min(1)
    .max(20),
  candidates: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        slot: z.string().trim().min(1).max(50),
        itemText: z.string().trim().min(1).max(20000),
        price: z.number().nonnegative().max(1000000),
        currency: z.literal('exalted'),
      }),
    )
    .min(1)
    .max(30),
  selectedBuildProfileId: z.string().trim().max(100).optional(),
});

export function installBuildDoctorRoutes(app: Express, db: AppDatabase): void {
  app.post('/api/build-doctor', (req, res) => {
    const parsed = z
      .object({
        equipment: z
          .array(
            z.object({
              slot: z.string().trim().min(1).max(50),
              itemText: z.string().max(20000),
            }),
          )
          .min(1)
          .max(20),
        selectedBuildProfileId: z.string().trim().max(100).optional(),
        selectedBuildProfileName: z.string().trim().max(100).optional(),
        // Defaults to the roster catalog's own current patch so rosterCompatibility() checks
        // don't spuriously report "unsupported" on every request that omits this field.
        patch: z.string().trim().min(1).max(30).default(builtInRosterCatalog.patch),
        spiritPlan: spiritPlanSchema.optional(),
        nonIdolAugments: z.number().int().nonnegative().nullable().optional(),
        hollowPlan: hollowPlanSchema.optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    const selectedKey = parsed.data.selectedBuildProfileId || parsed.data.selectedBuildProfileName;
    const build = selectedKey
      ? resolveBuildFitProfile(db, selectedKey)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(400).json({ error: 'Selected build profile was not found.' });
    try {
      const diagnosis = diagnoseBuild(parsed.data.equipment, build);
      const offenceResult = evaluateBuildDoctorOffence(db, parsed.data.equipment, build.mainSkill, parsed.data.patch);
      const analysisFoundations = evaluateAnalysisFoundations(db, {
        className: build.className,
        ascendancy: build.ascendancy,
        patch: parsed.data.patch,
        spirit: parsed.data.spiritPlan,
        nonIdolAugments: parsed.data.nonIdolAugments,
        hollow: parsed.data.hollowPlan,
      });
      return res.json({ ...diagnosis, offenceResult, ...analysisFoundations });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });

  app.post('/api/build-doctor/upgrade-search', (req, res) => {
    const parsed = z
      .object({
        itemText: z.string().trim().min(1).max(20000),
        league: z.string().trim().min(1).max(100).default('Runes of Aldur'),
        tolerance: z.number().min(70).max(120).default(100),
        preserveStats: z
          .array(
            z.enum([
              'life',
              'mana',
              'fireResistance',
              'coldResistance',
              'lightningResistance',
              'chaosResistance',
              'movementSpeed',
              'spirit',
            ]),
          )
          .max(8)
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    try {
      const item = mergeItem(parseItemText(parsed.data.itemText), {});
      const toleranceScale = Math.max(0.25, 2 - parsed.data.tolerance / 100);
      const url = buildTradeUrlWithOptions(item, parsed.data.league, 'same-slot', {
        toleranceScale,
        onlyStats: parsed.data.preserveStats,
      });
      return res.json({
        url,
        tolerance: parsed.data.tolerance,
        mode: 'same-slot',
        protectedStats: parsed.data.preserveStats || [],
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });

  app.post('/api/build-doctor/simulate-swap', (req, res) => {
    const parsed = z
      .object({
        equipment: z
          .array(
            z.object({
              slot: z.string().trim().min(1).max(50),
              itemText: z.string().max(20000),
            }),
          )
          .min(1)
          .max(20),
        slot: z.string().trim().min(1).max(50),
        candidateItemText: z.string().trim().min(1).max(20000),
        selectedBuildProfileId: z.string().trim().max(100).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    const build = parsed.data.selectedBuildProfileId
      ? resolveBuildFitProfile(db, parsed.data.selectedBuildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(400).json({ error: 'Selected build profile was not found.' });
    try {
      const before = diagnoseBuild(parsed.data.equipment, build);
      const next = parsed.data.equipment.filter((entry) => entry.slot !== parsed.data.slot);
      next.push({
        slot: parsed.data.slot,
        itemText: parsed.data.candidateItemText,
      });
      const after = diagnoseBuild(next, build);
      const scoreDelta = after.profile.overallScore - before.profile.overallScore;
      const newGaps = after.profile.gaps.filter((gap) => !before.profile.gaps.includes(gap));
      const resolvedGaps = before.profile.gaps.filter((gap) => !after.profile.gaps.includes(gap));
      const verdict =
        scoreDelta >= 5 && !newGaps.length
          ? 'Clear upgrade'
          : scoreDelta > 0 && !newGaps.length
            ? 'Small upgrade'
            : scoreDelta < 0
              ? 'Downgrade'
              : newGaps.length
                ? 'Risky sidegrade'
                : 'Sidegrade';
      return res.json({
        slot: parsed.data.slot,
        verdict,
        scoreDelta,
        beforeScore: before.profile.overallScore,
        afterScore: after.profile.overallScore,
        newGaps,
        resolvedGaps,
        diagnosis: after,
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });

  app.post('/api/build-doctor/compare-candidates', (req, res) => {
    const parsed = upgradePlannerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    const build = parsed.data.selectedBuildProfileId
      ? resolveBuildFitProfile(db, parsed.data.selectedBuildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(400).json({ error: 'Selected build profile was not found.' });
    try {
      return res.json({
        candidates: compareUpgradeCandidates(parsed.data.equipment, parsed.data.candidates, build),
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.post('/api/build-doctor/upgrade-plan', (req, res) => {
    const parsed = upgradePlannerSchema.extend({ budget: z.number().positive().max(1000000) }).safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    const build = parsed.data.selectedBuildProfileId
      ? resolveBuildFitProfile(db, parsed.data.selectedBuildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(400).json({ error: 'Selected build profile was not found.' });
    try {
      return res.json(planUpgradesByBudget(parsed.data.equipment, parsed.data.candidates, parsed.data.budget, build));
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
}
