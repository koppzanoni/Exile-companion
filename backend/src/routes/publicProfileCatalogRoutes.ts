import type { Express } from 'express';
import { z } from 'zod';
import type { AppDatabase } from '../db.js';
import {
  builtInCatalogs,
  catalogManifestSchema,
  compareProfiles,
  diagnosePublicProfile,
  resolveCatalog,
  type CatalogManifest,
} from '../characterProfile.js';
import { fetchPoeNinjaProfile } from '../poeNinjaProfile.js';
import { fetchPoe2Character, markSync } from '../poeOAuth.js';
import { diagnoseBuild } from '../buildDoctor.js';
import { genericBuildFitProfile } from '../buildProfiles.js';
import {
  equipmentFromPoeCharacter,
  getActiveBuildProfile,
  getCharacterRow,
  message,
  readCharacterLoadout,
  requireAdmin,
  resolveBuildFitProfile,
} from '../appHelpers.js';

export function installPublicProfileCatalogRoutes(app: Express, db: AppDatabase): void {
  app.get('/api/characters/:id/public-profile', (req, res) => {
    const row = db
      .prepare('SELECT profile_json AS profileJson FROM character_public_profiles WHERE character_id=?')
      .get(req.params.id) as { profileJson: string } | undefined;
    if (!row) return res.json({ profile: null });
    const profile = JSON.parse(row.profileJson);
    const catalogs = [
      ...builtInCatalogs,
      ...(
        db
          .prepare(
            'SELECT kind,patch,version,source,confidence,payload_json AS payloadJson,source_updated_at AS updatedAt FROM character_data_catalogs',
          )
          .all() as Array<any>
      ).flatMap((row) => {
        try {
          return [
            {
              kind: row.kind,
              patch: row.patch,
              version: row.version,
              source: row.source,
              confidence: row.confidence,
              payload: JSON.parse(row.payloadJson),
              updatedAt: row.updatedAt,
            } as CatalogManifest,
          ];
        } catch {
          return [];
        }
      }),
    ];
    return res.json({
      profile,
      diagnostics: diagnosePublicProfile(profile),
      catalogs: {
        passiveTree: resolveCatalog(catalogs, 'passive-tree', profile.passives.treeVersion),
        quests: resolveCatalog(catalogs, 'quests', profile.passives.treeVersion),
        ascendancy: resolveCatalog(catalogs, 'ascendancy', profile.passives.treeVersion),
      },
    });
  });
  app.get('/api/character-data/catalogs', (_req, res) =>
    res.json({
      catalogs: db
        .prepare(
          'SELECT kind,patch,version,source,confidence,source_updated_at AS updatedAt,created_at AS installedAt FROM character_data_catalogs ORDER BY kind,source_updated_at DESC',
        )
        .all(),
    }),
  );
  app.post('/api/admin/character-data/catalogs', (req, res) => {
    if (!requireAdmin(db, res)) return;
    const parsed = catalogManifestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((x) => x.message).join(', ') });
    const encoded = JSON.stringify(parsed.data.payload);
    if (encoded.length > 5_000_000) return res.status(413).json({ error: 'Catalog payload exceeds 5 MB.' });
    db.prepare(
      'INSERT INTO character_data_catalogs(kind,patch,version,source,confidence,payload_json,source_updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(kind,patch,version) DO UPDATE SET source=excluded.source,confidence=excluded.confidence,payload_json=excluded.payload_json,source_updated_at=excluded.source_updated_at,created_at=CURRENT_TIMESTAMP',
    ).run(
      parsed.data.kind,
      parsed.data.patch,
      parsed.data.version,
      parsed.data.source,
      parsed.data.confidence,
      encoded,
      parsed.data.updatedAt,
    );
    return res.status(201).json({ installed: true, kind: parsed.data.kind, version: parsed.data.version });
  });
  app.get('/api/characters/:id/public-profile/history', (req, res) => {
    const rows = db
      .prepare(
        'SELECT id,tree_version AS treeVersion,source_updated_at AS sourceUpdatedAt,imported_at AS importedAt FROM character_public_profile_history WHERE character_id=? ORDER BY imported_at DESC,id DESC',
      )
      .all(req.params.id);
    return res.json({ snapshots: rows });
  });
  app.get('/api/characters/:id/public-profile/compare', (req, res) => {
    const parsed = z
      .object({ before: z.coerce.number().int().positive(), after: z.coerce.number().int().positive() })
      .safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Two valid snapshot ids are required.' });
    const rows = db
      .prepare(
        'SELECT id,profile_json AS profileJson FROM character_public_profile_history WHERE character_id=? AND id IN (?,?)',
      )
      .all(req.params.id, parsed.data.before, parsed.data.after) as Array<{ id: number; profileJson: string }>;
    if (rows.length !== 2) return res.status(404).json({ error: 'Snapshot not found.' });
    const before = JSON.parse(rows.find((x) => x.id === parsed.data.before)!.profileJson),
      after = JSON.parse(rows.find((x) => x.id === parsed.data.after)!.profileJson);
    return res.json({ comparison: compareProfiles(before, after) });
  });
  app.post('/api/characters/:id/poe-ninja/import', async (req, res) => {
    const parsed = z.object({ url: z.string().url().max(500) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid public poe.ninja character URL.' });
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    try {
      const profile = await fetchPoeNinjaProfile(parsed.data.url);
      if (profile.identity.name.toLocaleLowerCase() !== character.name.toLocaleLowerCase())
        return res.status(409).json({
          error: `This profile belongs to ${profile.identity.name}, not ${character.name}.`,
        });
      db.prepare(
        'INSERT INTO character_public_profiles(character_id,source,source_url,profile_json,source_updated_at,imported_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id) DO UPDATE SET source=excluded.source,source_url=excluded.source_url,profile_json=excluded.profile_json,source_updated_at=excluded.source_updated_at,imported_at=CURRENT_TIMESTAMP',
      ).run(character.id, profile.source, profile.sourceUrl, JSON.stringify(profile), profile.updatedAt);
      db.prepare(
        'INSERT INTO character_public_profile_history(character_id,source,source_url,tree_version,profile_json,source_updated_at) VALUES (?,?,?,?,?,?)',
      ).run(
        character.id,
        profile.source,
        profile.sourceUrl,
        profile.passives.treeVersion,
        JSON.stringify(profile),
        profile.updatedAt,
      );
      db.prepare(
        "UPDATE characters SET league=?,level=?,class_name=CASE WHEN ?<>'' THEN ? ELSE class_name END,ascendancy=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        profile.identity.league,
        profile.identity.level,
        profile.identity.className,
        profile.identity.className,
        profile.identity.ascendancy,
        character.id,
      );
      return res.json({ profile, diagnostics: diagnosePublicProfile(profile) });
    } catch (error) {
      return res.status(502).json({ error: message(error) });
    }
  });
  app.post('/api/characters/:id/reconcile', async (req, res) => {
    const parsed = z
      .object({
        connectionId: z.number().int().positive(),
        confirmed: z.boolean().default(false),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A valid account connection is required.' });
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    try {
      const remote = await fetchPoe2Character(db, parsed.data.connectionId, character.name);
      const official = equipmentFromPoeCharacter(remote);
      const local = db
        .prepare('SELECT slot,item_text AS itemText FROM character_equipment WHERE character_id=?')
        .all(character.id) as Array<{ slot: string; itemText: string }>;
      const slots = new Set([...local.map((row) => row.slot), ...official.map((row) => row.slot)]);
      const differences = [...slots].flatMap((slot) => {
        const localText = local.find((row) => row.slot === slot)?.itemText || '';
        const officialText = official.find((row) => row.slot === slot)?.itemText || '';
        return localText === officialText
          ? []
          : [
              {
                slot,
                localItemText: localText,
                officialItemText: officialText,
                status: !localText ? 'official-only' : !officialText ? 'local-only' : 'changed',
              },
            ];
      });
      if (!parsed.data.confirmed) {
        db.prepare(
          'INSERT INTO reconciliation_history(character_id,connection_id,differences_json,applied) VALUES (?,?,?,0)',
        ).run(character.id, parsed.data.connectionId, JSON.stringify(differences));
        return res.json({
          differences,
          applied: false,
          requiresConfirmation: differences.length > 0,
        });
      }
      if (differences.length) {
        const build = character.buildProfileId
          ? resolveBuildFitProfile(db, character.buildProfileId)
          : getActiveBuildProfile(db) || genericBuildFitProfile;
        if (build) {
          const diagnosis = diagnoseBuild(local, build);
          db.prepare(
            'INSERT INTO character_snapshots(character_id,patch,score,diagnosis_json,equipment_json) VALUES (?,?,?,?,?)',
          ).run(
            character.id,
            readCharacterLoadout(db, character.id)?.patch || 'unknown',
            diagnosis.profile.overallScore,
            JSON.stringify(diagnosis),
            JSON.stringify(local),
          );
        }
        const upsert = db.prepare(
          'INSERT INTO character_equipment(character_id,slot,item_text,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id,slot) DO UPDATE SET item_text=excluded.item_text,updated_at=CURRENT_TIMESTAMP',
        );
        for (const diff of differences) {
          if (diff.officialItemText) upsert.run(character.id, diff.slot, diff.officialItemText);
          else
            db.prepare('DELETE FROM character_equipment WHERE character_id=? AND slot=?').run(character.id, diff.slot);
        }
      }
      db.prepare(
        'INSERT INTO reconciliation_history(character_id,connection_id,differences_json,applied) VALUES (?,?,?,1)',
      ).run(character.id, parsed.data.connectionId, JSON.stringify(differences));
      markSync(db, parsed.data.connectionId);
      return res.json({
        differences,
        applied: true,
        requiresConfirmation: false,
      });
    } catch (error) {
      markSync(db, parsed.data.connectionId, message(error));
      return res.status(502).json({ error: message(error) });
    }
  });
}
