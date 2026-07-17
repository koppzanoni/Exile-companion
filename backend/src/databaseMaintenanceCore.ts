import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function verifyDatabase(filename: string) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (row.integrity_check !== 'ok') throw new Error(`Integrity check failed: ${row.integrity_check}`);
    return row.integrity_check;
  } finally {
    db.close();
  }
}
export function backupDatabase(database: string, target: string) {
  const source = path.resolve(database),
    destination = path.resolve(target);
  if (!fs.existsSync(source)) throw new Error(`Database not found: ${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) throw new Error(`Backup already exists: ${destination}`);
  const db = new DatabaseSync(source);
  try {
    db.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
  } finally {
    db.close();
  }
  verifyDatabase(destination);
  return { source, target: destination };
}
export function restoreDatabase(database: string, source: string) {
  const target = path.resolve(database),
    backup = path.resolve(source);
  if (!fs.existsSync(backup)) throw new Error('Pass an existing backup path to restore.');
  verifyDatabase(backup);
  const safety = `${target}.before-restore-${Date.now()}`;
  if (fs.existsSync(target)) fs.copyFileSync(target, safety);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.copyFileSync(backup, target);
    verifyDatabase(target);
  } catch (error) {
    if (fs.existsSync(safety)) fs.copyFileSync(safety, target);
    throw error;
  }
  return { source: backup, target, safetyBackup: fs.existsSync(safety) ? safety : null };
}
