import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createDatabase } from './db.js';
import { runMigrations, schemaIntegrity } from './migrations.js';

describe('runMigrations', () => {
  it('applies every migration exactly once against the production schema and passes integrity checks', () => {
    const db = createDatabase(':memory:');
    const integrity = schemaIntegrity(db);
    expect(integrity.ok).toBe(true);
    expect(integrity.result).toBe('ok');
    const versions = (integrity.migrations as Array<{ version: number }>).map((row) => row.version);
    expect(versions.length).toBeGreaterThanOrEqual(15);
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
  });

  it('is a no-op on a second run against an already-migrated database', () => {
    const db = createDatabase(':memory:');
    const before = db.prepare('SELECT COUNT(*) count FROM schema_migrations').get() as { count: number };
    const result = runMigrations(db);
    const after = db.prepare('SELECT COUNT(*) count FROM schema_migrations').get() as { count: number };
    expect(after.count).toBe(before.count);
    expect(result).toHaveLength(before.count);
  });

  it('rolls back and leaves no schema_migrations row when a migration fails', () => {
    const db = new Database(':memory:');
    expect(() => runMigrations(db)).toThrow(/no such table/i);
    const rows = db.prepare('SELECT COUNT(*) count FROM schema_migrations').get() as { count: number };
    expect(rows.count).toBe(0);
  });
});
