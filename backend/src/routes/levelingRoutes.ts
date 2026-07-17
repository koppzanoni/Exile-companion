import express from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { mapToLevelingSlot, message } from '../appHelpers.js';
import { importBuildGuide } from '../buildImporter.js';
import { diagnoseBuild } from '../buildDoctor.js';
import {
  milestoneFor,
  nextMilestoneLevel,
  searchLevelingItems,
  whatChangesAtNextMilestone,
  type LevelingSlot,
} from '../leveling.js';

export function installLevelingRoutes(app: express.Express, _db: AppDatabase) {
  app.post('/api/leveling/search', async (req, res) => {
    const parsed = z
      .object({
        guideUrl: z.string().trim().min(1).max(500),
        level: z.number().int().min(10).max(100),
        league: z.string().trim().min(1).max(100).default('Runes of Aldur'),
        // High budgets are useful when the player is already mapping; do not reject
        // a legitimate guide simply because the item budget is above 1,000 Ex.
        maxPrice: z.number().positive().max(10000).default(3),
        currency: z.enum(['exalted', 'divine', 'chaos']).default('exalted'),
        equipment: z
          .array(
            z.object({
              slot: z.string().trim().min(1).max(50),
              itemText: z.string().max(20000),
            }),
          )
          .max(20)
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: 'Enter a valid build link, a level from 10 to 100, and a positive budget.',
      });
    try {
      const imported = await importBuildGuide(parsed.data.guideUrl);
      const weakestSlots = parsed.data.equipment?.length
        ? diagnoseBuild(parsed.data.equipment, imported.profile)
            .weakestSlots.map(mapToLevelingSlot)
            .filter((s): s is LevelingSlot => Boolean(s))
        : undefined;
      const slots = await searchLevelingItems(
        imported.profile,
        parsed.data.level,
        parsed.data.league,
        parsed.data.maxPrice,
        { weakestSlots, currency: parsed.data.currency },
      );
      const milestone = milestoneFor(parsed.data.level);
      return res.json({
        profile: imported.profile,
        source: imported.source,
        provider: imported.provider,
        warnings: imported.warnings,
        level: parsed.data.level,
        league: parsed.data.league,
        maxPrice: parsed.data.maxPrice,
        slots,
        milestone,
        nextMilestoneLevel: nextMilestoneLevel(parsed.data.level),
        whatChangesNext: whatChangesAtNextMilestone(parsed.data.level),
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
}
