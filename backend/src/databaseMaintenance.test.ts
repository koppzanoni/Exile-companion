import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { backupDatabase, restoreDatabase, verifyDatabase } from './databaseMaintenanceCore.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
describe('database backup and restore', () => {
  it('restores verified data and preserves a safety copy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exile-backup-'));
    roots.push(root);
    const database = path.join(root, 'app.db'),
      backup = path.join(root, 'backups', 'snapshot.db');
    let db = new DatabaseSync(database);
    db.exec("CREATE TABLE values_table(value TEXT); INSERT INTO values_table VALUES ('before')");
    db.close();
    backupDatabase(database, backup);
    db = new DatabaseSync(database);
    db.exec("UPDATE values_table SET value='after'");
    db.close();
    const restored = restoreDatabase(database, backup);
    expect(restored.safetyBackup && fs.existsSync(restored.safetyBackup)).toBe(true);
    expect(verifyDatabase(database)).toBe('ok');
    db = new DatabaseSync(database, { readOnly: true });
    expect((db.prepare('SELECT value FROM values_table').get() as { value: string }).value).toBe('before');
    db.close();
  });
  it('rejects a corrupt backup without replacing the live database', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exile-backup-'));
    roots.push(root);
    const database = path.join(root, 'app.db'),
      corrupt = path.join(root, 'bad.db');
    let db = new DatabaseSync(database);
    db.exec("CREATE TABLE safe(value TEXT); INSERT INTO safe VALUES ('kept')");
    db.close();
    fs.writeFileSync(corrupt, 'not sqlite');
    expect(() => restoreDatabase(database, corrupt)).toThrow();
    db = new DatabaseSync(database, { readOnly: true });
    expect((db.prepare('SELECT value FROM safe').get() as { value: string }).value).toBe('kept');
    db.close();
  });
});
