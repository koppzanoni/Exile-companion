import express from 'express';
import { z } from 'zod';
import { getSettings, type AppDatabase } from '../db.js';
import {
  customId,
  getActiveBuildProfile,
  loadCustomBuildProfiles,
  message,
  upsertActiveBuildProfile,
  withTransaction,
} from '../appHelpers.js';
import { importBuildGuide } from '../buildImporter.js';
import { allCodeProfiles, createCustomBuildProfile } from '../buildProfiles.js';

const itemCategorySchema = z.enum([
  'body-armour',
  'helmet',
  'gloves',
  'boots',
  'shield',
  'focus',
  'quiver',
  'ring',
  'amulet',
  'belt',
  'bow',
  'crossbow',
  'one-handed-melee',
  'two-handed-melee',
  'staff',
  'quarterstaff',
  'wand',
  'sceptre',
  'other',
]);
const customBuildProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  mainSkill: z.string().trim().max(100).default(''),
  className: z.string().trim().min(1).max(60),
  ascendancy: z.string().trim().max(60).optional().default(''),
  weaponType: itemCategorySchema.optional(),
  mainDamageType: z.string().trim().max(60).default('general'),
  defensiveLayer: z.string().trim().max(100).default('life'),
  importantStats: z.array(z.string().trim().min(1).max(100)).max(40),
  badStats: z.array(z.string().trim().min(1).max(100)).max(30),
  notes: z.string().max(1500).optional().default(''),
});

const buildPrioritySchema = z.object({
  stat: z.enum([
    'life',
    'mana',
    'energyShield',
    'armour',
    'evasion',
    'movementSpeed',
    'fireResistance',
    'coldResistance',
    'lightningResistance',
    'chaosResistance',
    'strength',
    'dexterity',
    'intelligence',
    'spirit',
    'rarityFind',
    'attacksPerSecond',
    'criticalHitChance',
    'physicalDps',
    'elementalDps',
  ]),
  level: z.enum(['required', 'high', 'useful']),
  minimum: z.number().positive().max(100000).optional(),
});
const buildProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  className: z.string().trim().min(1).max(50),
  ascendancy: z.string().trim().max(50).optional().default(''),
  mainSkill: z.string().trim().max(100).optional().default(''),
  guideUrl: z
    .union([z.string().url(), z.literal('')])
    .optional()
    .default(''),
  stage: z.enum(['campaign', 'early-maps', 'established', 'transition', 'endgame', 'aspirational']),
  evaluationStyle: z.enum(['balanced', 'campaign-race', 'hardcore-gauntlet']).optional().default('balanced'),
  defenceStyle: z.enum(['life-armour', 'life-evasion', 'energy-shield', 'hybrid', 'custom']),
  priorities: z.array(buildPrioritySchema).max(30),
  requiredMods: z.array(z.string().trim().min(1).max(150)).max(20),
  desiredMods: z.array(z.string().trim().min(1).max(150)).max(30),
  notes: z.string().max(2000).optional().default(''),
});

export function installSettingsBuildProfileRoutes(app: express.Express, db: AppDatabase) {
  app.get('/api/settings', (_req, res) => res.json(getSettings(db)));
  app.put('/api/settings', (req, res) => {
    const schema = z.object({
      divineToExalted: z.number().positive().max(100000),
      defaultLeague: z.string().min(1).max(100),
      craftingRiskTolerance: z.enum(['Low', 'Medium', 'High']).default('Medium'),
      showCurrencyWarnings: z.boolean().default(true),
      conservativeCraftingRecommendations: z.boolean().default(true),
      interfaceMode: z.enum(['Beginner', 'Advanced']).default('Beginner'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(', ') });
    withTransaction(db, () => {
      for (const [key, value] of Object.entries(parsed.data))
        db.prepare(
          `INSERT INTO settings(key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        ).run(key, String(value));
      db.prepare('INSERT INTO currency_rates(divine_to_exalted, source) VALUES (?, ?)').run(
        parsed.data.divineToExalted,
        'manual',
      );
    });
    return res.json(getSettings(db));
  });

  app.get('/api/build-profile', (_req, res) => res.json({ profile: getActiveBuildProfile(db) }));
  app.get('/api/build-profiles', (_req, res) =>
    res.json({
      profiles: [...allCodeProfiles(), ...loadCustomBuildProfiles(db)],
    }),
  );
  app.post('/api/build-profiles', (req, res) => {
    const parsed = customBuildProfileSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    try {
      const temp = createCustomBuildProfile(0, parsed.data);
      const result = db
        .prepare('INSERT INTO build_profiles(name,profile_json) VALUES (?,?)')
        .run(parsed.data.name, JSON.stringify(temp));
      const profile = createCustomBuildProfile(Number(result.lastInsertRowid), parsed.data);
      db.prepare('UPDATE build_profiles SET profile_json=? WHERE id=?').run(
        JSON.stringify(profile),
        result.lastInsertRowid,
      );
      return res.status(201).json({ profile });
    } catch (error) {
      return res.status(409).json({ error: message(error) });
    }
  });
  app.put('/api/build-profiles/:id', (req, res) => {
    const parsed = customBuildProfileSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    const id = customId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Only custom profiles can be edited.' });
    const profile = createCustomBuildProfile(id, parsed.data);
    try {
      const result = db
        .prepare('UPDATE build_profiles SET name=?,profile_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(profile.name, JSON.stringify(profile), id);
      return result.changes
        ? res.json({ profile })
        : res.status(404).json({ error: 'Custom build profile not found.' });
    } catch (error) {
      return res.status(409).json({ error: message(error) });
    }
  });
  app.delete('/api/build-profiles/:id', (req, res) => {
    const id = customId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Default profiles cannot be deleted.' });
    const result = db.prepare('DELETE FROM build_profiles WHERE id=?').run(id);
    return result.changes ? res.status(204).send() : res.status(404).json({ error: 'Custom build profile not found.' });
  });
  app.post('/api/build-profile/import', async (req, res) => {
    const parsed = z.object({ url: z.string().trim().min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a supported PoE 2 build URL.' });
    try {
      const result = await importBuildGuide(parsed.data.url);
      const snapshot = db
        .prepare(
          'INSERT INTO build_import_snapshots(url, provider, method, partial, fields_json, warnings_json) VALUES (?,?,?,?,?,?)',
        )
        .run(
          parsed.data.url,
          result.provider,
          result.method,
          result.partial ? 1 : 0,
          JSON.stringify(result.fields),
          JSON.stringify(result.warnings),
        );
      return res.json({
        ...result,
        snapshotId: Number(snapshot.lastInsertRowid),
      });
    } catch (error) {
      return res.status(422).json({ error: message(error) });
    }
  });
  app.put('/api/build-profile', (req, res) => {
    const parsed = buildProfileSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(', '),
      });
    try {
      return res.json({ profile: upsertActiveBuildProfile(db, parsed.data) });
    } catch (error) {
      return res.status(409).json({ error: message(error) });
    }
  });
  app.delete('/api/build-profile', (_req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'activeBuildProfileId'").run();
    db.prepare("DELETE FROM settings WHERE key = 'buildProfile'").run();
    return res.status(204).send();
  });
}
