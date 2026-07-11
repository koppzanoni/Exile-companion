import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import { defaultModifierCatalog, type ModifierCatalogEntry } from './modifierCatalog.js';
import { lookupModifier, invalidateModifierCatalogCache } from './modifierLookup.js';

const modifierEntrySchema = z.object({
  id: z.string().trim().min(1), group: z.string().trim().min(1), type: z.enum(['prefix', 'suffix', 'implicit']),
  local: z.boolean(), hybrid: z.boolean(), tags: z.array(z.string()), statKeys: z.array(z.string()),
  pattern: z.string().trim().min(1), flags: z.string(), label: z.string().trim().min(1), validClasses: z.array(z.string()),
});

export interface ValidationFailure { ok: false; errors: string[] }

export function validateModifierCatalog(raw: unknown): { ok: true; entries: ModifierCatalogEntry[] } | ValidationFailure {
  const parsed = z.array(modifierEntrySchema).safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const entries: ModifierCatalogEntry[] = [];
  for (const entry of parsed.data) {
    if (seenIds.has(entry.id)) { errors.push(`Duplicate modifier id "${entry.id}".`); continue; }
    seenIds.add(entry.id);
    try { new RegExp(entry.pattern, entry.flags); } catch { errors.push(`Modifier "${entry.id}" has an invalid regular expression pattern.`); continue; }
    entries.push({ ...entry, tags: entry.tags.map((t) => t.toLowerCase().trim()), statKeys: entry.statKeys.map((s) => s.trim()), validClasses: entry.validClasses.map((c) => c.toLowerCase().trim()) });
  }
  if (errors.length) return { ok: false, errors };
  if (!entries.length) return { ok: false, errors: ['The patch contains no valid modifier entries.'] };
  return { ok: true, entries };
}

const REGRESSION_FIXTURES: Array<{ text: string; itemClass?: string; expectedId: string }> = [
  { text: '+45 to maximum Life', expectedId: 'life' },
  { text: '35% increased Physical Damage', itemClass: 'weapon', expectedId: 'physical-damage-percent-local' },
  { text: '12% increased Attack Speed', itemClass: 'weapon', expectedId: 'attack-speed-local' },
  { text: '+40 to maximum Life and 25 to maximum Mana', expectedId: 'life-mana-hybrid' },
  { text: '25% increased Movement Speed', expectedId: 'movement-speed' },
];

export interface RegressionResult { passed: boolean; matchedFixtures: number; totalFixtures: number; issues: string[] }

export function runRegressionCheck(candidate: ModifierCatalogEntry[], active: ModifierCatalogEntry[]): RegressionResult {
  const issues: string[] = [];
  let candidateMatches = 0; let activeMatches = 0;
  for (const fixture of REGRESSION_FIXTURES) {
    const candidateResult = lookupModifier(candidate, fixture.text, fixture.itemClass);
    const activeResult = lookupModifier(active, fixture.text, fixture.itemClass);
    if (activeResult.id === fixture.expectedId) activeMatches += 1;
    if (candidateResult.id === fixture.expectedId) candidateMatches += 1;
    else if (activeResult.id === fixture.expectedId) issues.push(`Regression: "${fixture.text}" classified as "${candidateResult.id}" instead of "${fixture.expectedId}", which the active catalog still recognizes correctly.`);
  }
  const passed = candidateMatches >= activeMatches && issues.length === 0;
  if (!passed && issues.length === 0) issues.push('The candidate catalog recognizes fewer known fixtures than the currently active catalog.');
  return { passed, matchedFixtures: candidateMatches, totalFixtures: REGRESSION_FIXTURES.length, issues };
}

export interface CompareResult { addedIds: string[]; removedIds: string[]; unchangedCount: number }

export function compareToActive(candidate: ModifierCatalogEntry[], active: ModifierCatalogEntry[]): CompareResult {
  const activeIds = new Set(active.map((e) => e.id));
  const candidateIds = new Set(candidate.map((e) => e.id));
  return {
    addedIds: [...candidateIds].filter((id) => !activeIds.has(id)),
    removedIds: [...activeIds].filter((id) => !candidateIds.has(id)),
    unchangedCount: [...candidateIds].filter((id) => activeIds.has(id)).length,
  };
}

export interface CatalogVersion {
  id: number; dataset: string; patch: string; dataVersion: string; source: string; status: 'staged' | 'active' | 'rolled-back' | 'deprecated';
  entryCount: number; regression: RegressionResult; compare: CompareResult; createdAt: string; activatedAt: string | null; deprecatedAt: string | null;
}

function rowToVersion(row: any): CatalogVersion {
  return { id: row.id, dataset: row.dataset, patch: row.patch, dataVersion: row.dataVersion, source: row.source, status: row.status, entryCount: row.entryCount, regression: JSON.parse(row.regressionJson), compare: JSON.parse(row.compareJson), createdAt: row.createdAt, activatedAt: row.activatedAt, deprecatedAt: row.deprecatedAt };
}

function getActiveEntries(db: DatabaseSync): ModifierCatalogEntry[] {
  const rows = db.prepare("SELECT modifier_json FROM modifier_definitions WHERE deprecated = 0").all() as Array<{ modifier_json: string }>;
  const parsed = rows.map((r) => { try { return JSON.parse(r.modifier_json) as ModifierCatalogEntry; } catch { return null; } }).filter((v): v is ModifierCatalogEntry => Boolean(v));
  return parsed.length ? parsed : defaultModifierCatalog;
}

export function listCatalogVersions(db: DatabaseSync): CatalogVersion[] {
  const rows = db.prepare('SELECT id, dataset, patch, data_version AS dataVersion, source, status, entry_count AS entryCount, regression_json AS regressionJson, compare_json AS compareJson, created_at AS createdAt, activated_at AS activatedAt, deprecated_at AS deprecatedAt FROM catalog_versions ORDER BY created_at DESC').all();
  return rows.map(rowToVersion);
}

export function stagePatch(db: DatabaseSync, params: { patch: string; dataVersion: string; source: string; entries: ModifierCatalogEntry[] }): CatalogVersion {
  const active = getActiveEntries(db);
  const regression = runRegressionCheck(params.entries, active);
  const compare = compareToActive(params.entries, active);
  const insertVersion = db.prepare('INSERT INTO catalog_versions(dataset, patch, data_version, source, status, entry_count, regression_json, compare_json) VALUES (?,?,?,?,?,?,?,?)');
  const result = insertVersion.run('modifiers', params.patch, params.dataVersion, params.source, 'staged', params.entries.length, JSON.stringify(regression), JSON.stringify(compare));
  const insertModifier = db.prepare('INSERT OR IGNORE INTO modifier_definitions(id, patch, data_version, source, confidence, deprecated, modifier_json) VALUES (?,?,?,?,?,1,?)');
  for (const entry of params.entries) insertModifier.run(entry.id, params.patch, params.dataVersion, params.source, 'Medium', JSON.stringify(entry));
  return rowToVersion({ id: Number(result.lastInsertRowid), dataset: 'modifiers', patch: params.patch, dataVersion: params.dataVersion, source: params.source, status: 'staged', entryCount: params.entries.length, regressionJson: JSON.stringify(regression), compareJson: JSON.stringify(compare), createdAt: new Date().toISOString(), activatedAt: null, deprecatedAt: null });
}

export function activatePatch(db: DatabaseSync, versionId: number): CatalogVersion {
  const row = db.prepare('SELECT id, dataset, patch, data_version AS dataVersion, source, status, entry_count AS entryCount, regression_json AS regressionJson, compare_json AS compareJson, created_at AS createdAt, activated_at AS activatedAt, deprecated_at AS deprecatedAt FROM catalog_versions WHERE id = ?').get(versionId) as any;
  if (!row) throw new Error('Patch version not found.');
  const version = rowToVersion(row);
  if (version.status === 'active') return version;
  if (!version.regression.passed) throw new Error('This patch failed its regression check and cannot be activated. An invalid update never replaces the active version automatically.');
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE catalog_versions SET status = 'deprecated', deprecated_at = CURRENT_TIMESTAMP WHERE dataset = ? AND status = 'active'").run(version.dataset);
    db.prepare("UPDATE modifier_definitions SET deprecated = 1 WHERE deprecated = 0").run();
    db.prepare("UPDATE catalog_versions SET status = 'active', activated_at = CURRENT_TIMESTAMP WHERE id = ?").run(versionId);
    db.prepare('UPDATE modifier_definitions SET deprecated = 0 WHERE patch = ? AND data_version = ? AND source = ?').run(version.patch, version.dataVersion, version.source);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  invalidateModifierCatalogCache(db);
  return { ...version, status: 'active', activatedAt: new Date().toISOString() };
}

export function rollbackToVersion(db: DatabaseSync, versionId: number): CatalogVersion {
  const row = db.prepare('SELECT id, dataset, patch, data_version AS dataVersion, source, status, entry_count AS entryCount, regression_json AS regressionJson, compare_json AS compareJson, created_at AS createdAt, activated_at AS activatedAt, deprecated_at AS deprecatedAt FROM catalog_versions WHERE id = ?').get(versionId) as any;
  if (!row) throw new Error('Patch version not found.');
  const version = rowToVersion(row);
  if (version.status !== 'deprecated') throw new Error('Only a previously active (now deprecated) version can be rolled back to.');
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE catalog_versions SET status = 'rolled-back', deprecated_at = CURRENT_TIMESTAMP WHERE dataset = ? AND status = 'active'").run(version.dataset);
    db.prepare("UPDATE modifier_definitions SET deprecated = 1 WHERE deprecated = 0").run();
    db.prepare("UPDATE catalog_versions SET status = 'active', activated_at = CURRENT_TIMESTAMP WHERE id = ?").run(versionId);
    db.prepare('UPDATE modifier_definitions SET deprecated = 0 WHERE patch = ? AND data_version = ? AND source = ?').run(version.patch, version.dataVersion, version.source);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  invalidateModifierCatalogCache(db);
  return { ...version, status: 'active', activatedAt: new Date().toISOString() };
}
