import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { defaultModifierCatalog } from './modifierCatalog.js';
import { craftingCurrencies } from './craftingCurrencies.js';

const MODIFIER_SEED_PATCH = 'any';
const MODIFIER_SEED_VERSION = 'seed-1';
const MODIFIER_SEED_SOURCE = 'derived';

export function createDatabase(filename = process.env.DATABASE_PATH || path.resolve('data/poe2-analyzer.db')) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league TEXT NOT NULL,
      item_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      data_source TEXT NOT NULL,
      official_url TEXT,
      warning TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comparable_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_id INTEGER NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
      external_id TEXT,
      listing_json TEXT NOT NULL,
      similarity REAL,
      excluded_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS trade_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_url TEXT NOT NULL,
      league TEXT NOT NULL,
      parsed_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS currency_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      divine_to_exalted REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS race_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      cause TEXT NOT NULL,
      lesson TEXT NOT NULL,
      item_category TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS build_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      profile_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patch_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, UNIQUE(patch,data_version,source));
    CREATE TABLE IF NOT EXISTS data_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, authority TEXT NOT NULL, url TEXT, last_success_at TEXT, last_error TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS item_bases (id TEXT NOT NULL, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, base_json TEXT NOT NULL, PRIMARY KEY(id,patch,data_version,source));
    CREATE TABLE IF NOT EXISTS modifier_definitions (id TEXT NOT NULL, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, modifier_json TEXT NOT NULL, PRIMARY KEY(id,patch,data_version,source));
    CREATE TABLE IF NOT EXISTS modifier_groups (id TEXT NOT NULL, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, group_json TEXT NOT NULL, PRIMARY KEY(id,patch,data_version,source));
    CREATE TABLE IF NOT EXISTS crafting_currencies (id TEXT NOT NULL, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, currency_json TEXT NOT NULL, PRIMARY KEY(id,patch,data_version,source));
    CREATE TABLE IF NOT EXISTS crafting_rules (id TEXT NOT NULL, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, rule_json TEXT NOT NULL, PRIMARY KEY(id,patch,data_version,source));
    CREATE TABLE IF NOT EXISTS skill_profiles (id TEXT NOT NULL, patch TEXT NOT NULL, data_version TEXT NOT NULL, source TEXT NOT NULL, fetched_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confidence TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, profile_json TEXT NOT NULL, PRIMARY KEY(id,patch,data_version,source));
    CREATE TABLE IF NOT EXISTS market_searches (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, league TEXT NOT NULL, patch TEXT NOT NULL, query_json TEXT NOT NULL, status TEXT NOT NULL, warning TEXT, fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS market_listings (id TEXT NOT NULL, search_id INTEGER REFERENCES market_searches(id) ON DELETE CASCADE, listing_json TEXT NOT NULL, indexed_at TEXT, fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id,search_id));
    CREATE TABLE IF NOT EXISTS price_estimates (id INTEGER PRIMARY KEY AUTOINCREMENT, analysis_id INTEGER, patch TEXT NOT NULL, league TEXT NOT NULL, estimate_json TEXT NOT NULL, confidence REAL NOT NULL, sample_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS analysis_history (id INTEGER PRIMARY KEY AUTOINCREMENT, patch TEXT NOT NULL, data_version TEXT NOT NULL, input_json TEXT NOT NULL, result_json TEXT NOT NULL, confidence TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS user_equipment (slot TEXT PRIMARY KEY, item_json TEXT NOT NULL, build_profile_id TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      league TEXT NOT NULL,
      level INTEGER,
      class_name TEXT,
      ascendancy TEXT,
      build_profile_id TEXT,
      stage TEXT,
      budget REAL,
      target_content TEXT,
      current_issues TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, league)
    );
    CREATE TABLE IF NOT EXISTS character_equipment (
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      slot TEXT NOT NULL,
      item_text TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (character_id, slot)
    );
    CREATE TABLE IF NOT EXISTS character_analysis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      check_id INTEGER REFERENCES checks(id) ON DELETE SET NULL,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_checks_created ON checks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comparables_check ON comparable_listings(check_id);
    CREATE TABLE IF NOT EXISTS crafting_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL,
      currency_spent_count INTEGER NOT NULL,
      value_before REAL,
      value_after REAL,
      gain_loss REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_character_equipment ON character_equipment(character_id);
    CREATE INDEX IF NOT EXISTS idx_character_history ON character_analysis_history(character_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_crafting_history ON crafting_history(character_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS catalog_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dataset TEXT NOT NULL,
      patch TEXT NOT NULL,
      data_version TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      entry_count INTEGER NOT NULL,
      regression_json TEXT NOT NULL,
      compare_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activated_at TEXT,
      deprecated_at TEXT,
      UNIQUE(patch, data_version, source)
    );
    CREATE TABLE IF NOT EXISTS build_import_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      provider TEXT NOT NULL,
      method TEXT NOT NULL,
      partial INTEGER NOT NULL,
      fields_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS poe_oauth_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poe_subject TEXT NOT NULL UNIQUE,
      poe_username TEXT,
      scope TEXT NOT NULL,
      access_token_ciphertext TEXT NOT NULL,
      refresh_token_ciphertext TEXT,
      access_expires_at TEXT,
      refresh_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_sync_at TEXT,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS poe_oauth_states (
      state TEXT PRIMARY KEY,
      verifier TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  ensureColumn(db, 'price_estimates', 'base_type', 'base_type TEXT');
  ensureColumn(db, 'price_estimates', 'item_class', 'item_class TEXT');
  ensureColumn(db, 'price_estimates', 'data_source', 'data_source TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_price_estimates_history ON price_estimates(base_type, league, created_at DESC);');
  db.prepare(`INSERT OR IGNORE INTO settings(key, value) VALUES ('divineToExalted', '65'), ('defaultLeague', 'Runes of Aldur'), ('craftingRiskTolerance', 'Medium'), ('showCurrencyWarnings', 'true'), ('conservativeCraftingRecommendations', 'true'), ('interfaceMode', 'Beginner')`).run();
  if (!db.prepare('SELECT 1 FROM currency_rates LIMIT 1').get()) {
    db.prepare('INSERT INTO currency_rates(divine_to_exalted, source) VALUES (?, ?)').run(65, 'default');
  }
  seedModifierCatalog(db);
  seedCraftingCurrencies(db);
  seedInitialCatalogVersion(db);
  return db;
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function seedCraftingCurrencies(db: DatabaseSync) {
  const insert = db.prepare('INSERT OR IGNORE INTO crafting_currencies(id, patch, data_version, source, confidence, currency_json) VALUES (?, ?, ?, ?, ?, ?)');
  for (const currency of craftingCurrencies) insert.run(currency.id, MODIFIER_SEED_PATCH, MODIFIER_SEED_VERSION, MODIFIER_SEED_SOURCE, 'Medium', JSON.stringify(currency));
}

function seedInitialCatalogVersion(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM catalog_versions WHERE dataset = 'modifiers' AND status = 'active'").get()) return;
  db.prepare('INSERT OR IGNORE INTO catalog_versions(dataset, patch, data_version, source, status, entry_count, regression_json, compare_json, activated_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
    .run('modifiers', MODIFIER_SEED_PATCH, MODIFIER_SEED_VERSION, MODIFIER_SEED_SOURCE, 'active', defaultModifierCatalog.length, JSON.stringify({ passed: true, matchedFixtures: 0, totalFixtures: 0, issues: [] }), JSON.stringify({ addedIds: [], removedIds: [], unchangedCount: 0 }));
}

function seedModifierCatalog(db: DatabaseSync) {
  db.prepare(`INSERT OR IGNORE INTO data_sources(name, authority, url, updated_at) VALUES ('modifier-catalog-derived', 'inferred', NULL, CURRENT_TIMESTAMP)`).run();
  const insertModifier = db.prepare('INSERT OR IGNORE INTO modifier_definitions(id, patch, data_version, source, confidence, modifier_json) VALUES (?, ?, ?, ?, ?, ?)');
  const insertGroup = db.prepare('INSERT OR IGNORE INTO modifier_groups(id, patch, data_version, source, confidence, group_json) VALUES (?, ?, ?, ?, ?, ?)');
  const groups = new Map<string, { type: string; local: boolean; hybrid: boolean }>();
  for (const entry of defaultModifierCatalog) {
    insertModifier.run(entry.id, MODIFIER_SEED_PATCH, MODIFIER_SEED_VERSION, MODIFIER_SEED_SOURCE, 'Medium', JSON.stringify(entry));
    if (!groups.has(entry.group)) groups.set(entry.group, { type: entry.type, local: entry.local, hybrid: entry.hybrid });
  }
  for (const [id, info] of groups) insertGroup.run(id, MODIFIER_SEED_PATCH, MODIFIER_SEED_VERSION, MODIFIER_SEED_SOURCE, 'Medium', JSON.stringify(info));
}

export type AppDatabase = ReturnType<typeof createDatabase>;

export function getSettings(db: AppDatabase) {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    divineToExalted: Number(values.divineToExalted || 65),
    defaultLeague: values.defaultLeague || 'Runes of Aldur',
    craftingRiskTolerance: ['Low','Medium','High'].includes(values.craftingRiskTolerance) ? values.craftingRiskTolerance as 'Low'|'Medium'|'High' : 'Medium',
    showCurrencyWarnings: values.showCurrencyWarnings !== 'false',
    conservativeCraftingRecommendations: values.conservativeCraftingRecommendations !== 'false',
    interfaceMode: values.interfaceMode === 'Advanced' ? 'Advanced' : 'Beginner',
  };
}
