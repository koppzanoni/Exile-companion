import type { DatabaseSync } from 'node:sqlite';

interface Migration {
  version: number;
  name: string;
  sql: string;
  foreignKeysOff?: boolean;
}
const migrations: Migration[] = [
  {
    version: 1,
    name: 'baseline-schema',
    sql: 'CREATE INDEX IF NOT EXISTS idx_reconciliation_character ON reconciliation_history(character_id,created_at DESC);',
  },
  {
    version: 2,
    name: 'monitor-jobs-and-notifications',
    sql: `
    CREATE TABLE IF NOT EXISTS monitor_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE, plan_item_id INTEGER REFERENCES shopping_plan_items(id) ON DELETE CASCADE, enabled INTEGER NOT NULL DEFAULT 0, interval_minutes INTEGER NOT NULL DEFAULT 60, next_run_at TEXT, last_run_at TEXT, last_status TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS notification_preferences (character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE, price_change INTEGER NOT NULL DEFAULT 1, unavailable INTEGER NOT NULL DEFAULT 1, better_candidate INTEGER NOT NULL DEFAULT 1, minimum_saving REAL NOT NULL DEFAULT 1, minimum_score_gain REAL NOT NULL DEFAULT 1, daily_digest INTEGER NOT NULL DEFAULT 0, muted_until TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_monitor_jobs_due ON monitor_jobs(enabled,next_run_at);
  `,
  },
  {
    version: 3,
    name: 'request-audit-and-metrics',
    sql: `
    CREATE TABLE IF NOT EXISTS request_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT NOT NULL, route TEXT NOT NULL, status INTEGER NOT NULL, duration_ms REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_request_audit_created ON request_audit(created_at DESC);
  `,
  },
  {
    version: 4,
    name: 'worker-locks-and-users',
    sql: `
    ALTER TABLE monitor_jobs ADD COLUMN locked_at TEXT;
    ALTER TABLE monitor_jobs ADD COLUMN locked_by TEXT;
    ALTER TABLE monitor_jobs ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS app_users (id INTEGER PRIMARY KEY AUTOINCREMENT, external_subject TEXT UNIQUE, display_name TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_app_sessions_expiry ON app_sessions(expires_at);
  `,
  },
  {
    version: 5,
    name: 'password-authentication',
    sql: `
    ALTER TABLE app_users ADD COLUMN email TEXT;
    ALTER TABLE app_users ADD COLUMN password_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email) WHERE email IS NOT NULL;
  `,
  },
  {
    version: 6,
    name: 'user-owned-workspaces',
    sql: `
    ALTER TABLE characters ADD COLUMN user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE;
    ALTER TABLE sale_journal ADD COLUMN user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE;
    ALTER TABLE gemini_conversations ADD COLUMN user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sales_user ON sale_journal(user_id,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gemini_conversations_user ON gemini_conversations(user_id,updated_at DESC);
  `,
  },
  {
    version: 7,
    name: 'user-owned-poe-oauth',
    sql: `
    ALTER TABLE poe_oauth_connections ADD COLUMN user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE;
    ALTER TABLE poe_oauth_states ADD COLUMN user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_poe_connections_user ON poe_oauth_connections(user_id,updated_at DESC);
  `,
  },
  {
    version: 8,
    name: 'character-identity-per-user',
    foreignKeysOff: true,
    sql: `
    CREATE TABLE characters_next (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,league TEXT NOT NULL,level INTEGER,class_name TEXT,ascendancy TEXT,build_profile_id TEXT,stage TEXT,budget REAL,target_content TEXT,current_issues TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,UNIQUE(user_id,name,league));
    INSERT INTO characters_next(id,name,league,level,class_name,ascendancy,build_profile_id,stage,budget,target_content,current_issues,created_at,updated_at,user_id) SELECT id,name,league,level,class_name,ascendancy,build_profile_id,stage,budget,target_content,current_issues,created_at,updated_at,user_id FROM characters;
    DROP TABLE characters;
    ALTER TABLE characters_next RENAME TO characters;
    CREATE INDEX idx_characters_user ON characters(user_id,updated_at DESC);
  `,
  },
  {
    version: 9,
    name: 'gemini-usage-and-memory',
    sql: `
    CREATE TABLE IF NOT EXISTS gemini_usage (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,conversation_id INTEGER REFERENCES gemini_conversations(id) ON DELETE SET NULL,character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,model TEXT,status TEXT NOT NULL,input_chars INTEGER NOT NULL DEFAULT 0,output_chars INTEGER NOT NULL DEFAULT 0,estimated_tokens INTEGER NOT NULL DEFAULT 0,estimated_cost_usd REAL NOT NULL DEFAULT 0,latency_ms INTEGER NOT NULL,injection_flags_json TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS character_ai_memory (character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,summary TEXT NOT NULL,source_conversation_id INTEGER REFERENCES gemini_conversations(id) ON DELETE SET NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_gemini_usage_user_date ON gemini_usage(user_id,created_at DESC);
  `,
  },
  {
    version: 10,
    name: 'operations-dashboard',
    sql: `
    ALTER TABLE app_users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS backup_runs (id INTEGER PRIMARY KEY AUTOINCREMENT,status TEXT NOT NULL,target TEXT,error TEXT,verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_backup_runs_created ON backup_runs(created_at DESC);
  `,
  },
  {
    version: 11,
    name: 'market-response-cache',
    sql: `
    CREATE TABLE IF NOT EXISTS market_response_cache (cache_key TEXT PRIMARY KEY,response_json TEXT NOT NULL,expires_at TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_hit_at TEXT);
    CREATE INDEX IF NOT EXISTS idx_market_cache_expiry ON market_response_cache(expires_at);
  `,
  },
  {
    version: 12,
    name: 'character-public-profile-snapshots',
    sql: `
    CREATE TABLE IF NOT EXISTS character_public_profiles (character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,source TEXT NOT NULL,source_url TEXT NOT NULL,profile_json TEXT NOT NULL,source_updated_at TEXT,imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_character_public_profiles_imported ON character_public_profiles(imported_at DESC);
  `,
  },
  {
    version: 13,
    name: 'versioned-character-catalogs-and-history',
    sql: `
    CREATE TABLE IF NOT EXISTS character_data_catalogs (id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,patch TEXT NOT NULL,version TEXT NOT NULL,source TEXT NOT NULL,confidence TEXT NOT NULL,payload_json TEXT NOT NULL,source_updated_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(kind,patch,version));
    CREATE TABLE IF NOT EXISTS character_public_profile_history (id INTEGER PRIMARY KEY AUTOINCREMENT,character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,source TEXT NOT NULL,source_url TEXT NOT NULL,tree_version TEXT NOT NULL,profile_json TEXT NOT NULL,source_updated_at TEXT,imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_public_profile_history_character ON character_public_profile_history(character_id,imported_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_character_catalog_lookup ON character_data_catalogs(kind,version,patch);
  `,
  },
  {
    version: 14,
    name: 'user-preferences-and-conversation-lifecycle',
    sql: `
    CREATE TABLE IF NOT EXISTS user_preferences (user_id INTEGER PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,active_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,language TEXT NOT NULL DEFAULT 'en',experience_mode TEXT NOT NULL DEFAULT 'beginner',onboarding_step INTEGER NOT NULL DEFAULT 0,onboarding_complete INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    ALTER TABLE gemini_conversations ADD COLUMN archived_at TEXT;
    CREATE INDEX IF NOT EXISTS idx_gemini_conversations_active ON gemini_conversations(user_id,archived_at,updated_at DESC);
  `,
  },
  {
    version: 15,
    name: 'versioned-roster-catalog',
    sql: `
    CREATE TABLE IF NOT EXISTS roster_catalogs (patch TEXT NOT NULL,data_version TEXT NOT NULL,source TEXT NOT NULL,verified_at TEXT NOT NULL,confidence TEXT NOT NULL,checksum TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(patch,data_version,source));
    CREATE INDEX IF NOT EXISTS idx_roster_catalog_lookup ON roster_catalogs(patch,data_version,source);
  `,
  },
];

export function runMigrations(db: DatabaseSync) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  );
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map((row) => row.version),
  );
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    if (migration.foreignKeysOff) db.exec('PRAGMA foreign_keys=OFF');
    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations(version,name) VALUES (?,?)').run(migration.version, migration.name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      if (migration.foreignKeysOff) db.exec('PRAGMA foreign_keys=ON');
    }
    if (migration.foreignKeysOff) {
      const violations = db.prepare('PRAGMA foreign_key_check').all();
      if (violations.length)
        throw new Error(`Foreign-key violations after migration ${migration.version}: ${JSON.stringify(violations)}`);
    }
  }
  return db.prepare('SELECT version,name,applied_at AS appliedAt FROM schema_migrations ORDER BY version').all();
}
export function schemaIntegrity(db: DatabaseSync) {
  const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  return {
    ok: result.integrity_check === 'ok',
    result: result.integrity_check,
    migrations: db.prepare('SELECT version,name,applied_at AS appliedAt FROM schema_migrations ORDER BY version').all(),
  };
}
