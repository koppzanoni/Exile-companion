import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import { allCodeProfiles, genericBuildFitProfile } from '../buildProfiles.js';
import { analyzeLoadout, findSimilarBuilds, simulateLoadout } from '../buildKnowledge.js';
import { diagnoseBuild } from '../buildDoctor.js';
import { mergeItem, parseItemText } from '../itemParser.js';
import { buildTradeUrlWithOptions } from '../trade.js';
import {
  getActiveBuildProfile,
  getCharacterRow,
  loadCustomBuildProfiles,
  readCharacterLoadout,
  resolveBuildFitProfile,
} from '../appHelpers.js';

const characterLoadoutSchema = z.object({
  patch: z.string().trim().min(1).max(50),
  source: z.enum(['manual', 'poe-api', 'imported']),
  confidence: z.enum(['Low', 'Medium', 'High']),
  mainSkill: z.string().trim().max(100),
  weaponSet: z.string().trim().max(100),
  availableSpirit: z.number().int().nonnegative().max(10000).optional(),
  skills: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        supports: z.array(z.string().trim().min(1).max(100)).max(12),
        spiritReservation: z.number().int().nonnegative().max(10000).optional(),
        tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
      }),
    )
    .max(30),
  keyPassives: z.array(z.string().trim().min(1).max(100)).max(50),
});

export function installCharacterLoadoutRoutes(app: Express, db: AppDatabase): void {
  app.post('/api/characters/:id/snapshots', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const equipment = db
      .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    const build = character.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(422).json({ error: 'Build profile not found.' });
    const diagnosis = diagnoseBuild(equipment, build);
    const patch = String(req.body?.patch || 'unknown').slice(0, 50);
    const result = db
      .prepare(
        'INSERT INTO character_snapshots(character_id,patch,score,diagnosis_json,equipment_json) VALUES (?,?,?,?,?)',
      )
      .run(character.id, patch, diagnosis.profile.overallScore, JSON.stringify(diagnosis), JSON.stringify(equipment));
    return res.status(201).json({
      snapshot: {
        id: Number(result.lastInsertRowid),
        patch,
        score: diagnosis.profile.overallScore,
        diagnosis,
      },
    });
  });
  app.get('/api/characters/:id/snapshots', (req, res) =>
    res.json({
      snapshots: db
        .prepare(
          'SELECT id,patch,score,diagnosis_json AS diagnosisJson,equipment_json AS equipmentJson,created_at AS createdAt FROM character_snapshots WHERE character_id=? ORDER BY created_at DESC',
        )
        .all(req.params.id),
    }),
  );
  app.get('/api/characters/:id/loadout', (req, res) => {
    if (!getCharacterRow(db, Number(req.params.id))) return res.status(404).json({ error: 'Character not found.' });
    return res.json({
      loadout: readCharacterLoadout(db, Number(req.params.id)),
    });
  });
  app.put('/api/characters/:id/loadout', (req, res) => {
    if (!getCharacterRow(db, Number(req.params.id))) return res.status(404).json({ error: 'Character not found.' });
    const parsed = characterLoadoutSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    const loadout = parsed.data;
    db.prepare(
      `INSERT INTO character_build_loadouts(character_id,patch,source,confidence,main_skill,weapon_set,available_spirit,skills_json,key_passives_json) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(character_id) DO UPDATE SET patch=excluded.patch,source=excluded.source,confidence=excluded.confidence,main_skill=excluded.main_skill,weapon_set=excluded.weapon_set,available_spirit=excluded.available_spirit,skills_json=excluded.skills_json,key_passives_json=excluded.key_passives_json,updated_at=CURRENT_TIMESTAMP`,
    ).run(
      req.params.id,
      loadout.patch,
      loadout.source,
      loadout.confidence,
      loadout.mainSkill,
      loadout.weaponSet,
      loadout.availableSpirit ?? null,
      JSON.stringify(loadout.skills),
      JSON.stringify(loadout.keyPassives),
    );
    return res.json({ loadout });
  });
  app.get('/api/characters/:id/build-knowledge', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const loadout = readCharacterLoadout(db, character.id);
    if (!loadout) return res.status(404).json({ error: 'Character loadout not found.' });
    const profiles = [...allCodeProfiles(), ...loadCustomBuildProfiles(db)];
    return res.json({
      loadout,
      analysis: analyzeLoadout(loadout),
      similar: findSimilarBuilds(character, loadout, profiles),
      provenance: {
        patch: loadout.patch,
        source: loadout.source,
        confidence: loadout.confidence,
      },
    });
  });
  app.post('/api/characters/:id/loadout/simulate', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const current = readCharacterLoadout(db, character.id);
    if (!current) return res.status(404).json({ error: 'Character loadout not found.' });
    const parsed = characterLoadoutSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    return res.json(simulateLoadout(current, parsed.data));
  });
  app.get('/api/characters/:id/action-plan', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const budget = Math.max(0, Math.min(1000000, Number(req.query.budget ?? character.budget ?? 0) || 0));
    const equipment = db
      .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
      .all(character.id) as Array<{ slot: string; itemText: string }>;
    const build = character.buildProfileId
      ? resolveBuildFitProfile(db, character.buildProfileId)
      : getActiveBuildProfile(db) || genericBuildFitProfile;
    if (!build) return res.status(422).json({ error: 'Build profile not found.' });
    const diagnosis = diagnoseBuild(equipment, build);
    const allocation = diagnosis.recommendedUpgradeOrder.length
      ? budget / Math.min(3, diagnosis.recommendedUpgradeOrder.length)
      : 0;
    const purchases = diagnosis.recommendedUpgradeOrder.slice(0, 5).map((entry, index) => {
      const equipped = equipment.find((item) => item.slot === entry.slot);
      let tradeUrl: string | null = null;
      if (equipped?.itemText) {
        try {
          tradeUrl = buildTradeUrlWithOptions(
            mergeItem(parseItemText(equipped.itemText), {}),
            character.league,
            'same-slot',
            {
              toleranceScale: 1,
              onlyStats: [
                'life',
                'fireResistance',
                'coldResistance',
                'lightningResistance',
                'chaosResistance',
                'movementSpeed',
                'spirit',
              ],
            },
          );
        } catch {
          tradeUrl = null;
        }
      }
      return {
        rank: index + 1,
        slot: entry.slot,
        reason: entry.reason,
        priority: entry.budgetPriority,
        suggestedBudget: Math.round(allocation * 100) / 100,
        tradeUrl,
        requiresEquippedItem: !equipped?.itemText,
      };
    });
    return res.json({
      characterId: character.id,
      budget,
      score: diagnosis.profile.overallScore,
      purchases,
      blockers: [...diagnosis.alerts.map((alert) => alert.message), ...diagnosis.profile.gaps],
      warning: 'Search links are live queries, not guaranteed listings or completed-sale prices.',
    });
  });
  app.post('/api/characters/:id/action-plan/persist', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const parsed = z
      .object({
        confirmed: z.literal(true),
        purchases: z
          .array(
            z.object({
              slot: z.string().min(1).max(50),
              reason: z.string().max(500),
              priority: z.enum(['High', 'Medium', 'Low']),
              suggestedBudget: z.number().nonnegative(),
              tradeUrl: z.string().url().nullable(),
            }),
          )
          .max(10),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: 'Explicit confirmation and a valid shopping plan are required.',
      });
    const insert = db.prepare(
      'INSERT INTO shopping_plan_items(character_id,slot,reason,priority,suggested_budget,trade_url) VALUES (?,?,?,?,?,?)',
    );
    const ids = parsed.data.purchases.map((item) =>
      Number(
        insert.run(character.id, item.slot, item.reason, item.priority, item.suggestedBudget, item.tradeUrl)
          .lastInsertRowid,
      ),
    );
    return res.status(201).json({ ids });
  });
}
