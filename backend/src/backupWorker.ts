import { existsSync, globSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const interval = Math.max(60_000, Number(process.env.BACKUP_INTERVAL_MS || 86_400_000));
const retention = Math.max(1, Number(process.env.BACKUP_RETENTION_COUNT || 14));
const backupDir = resolve(process.env.BACKUP_DIRECTORY || 'backups');
const database = resolve(process.env.DATABASE_PATH || 'data/poe2-analyzer.db');
function record(status: string, target: string, error: string | null, verified: number) {
  try {
    const db = new DatabaseSync(database);
    db.prepare('INSERT INTO backup_runs(status,target,error,verified) VALUES (?,?,?,?)').run(
      status,
      target,
      error,
      verified,
    );
    db.close();
  } catch {}
}

function runBackup() {
  if (!existsSync(database)) {
    console.error(
      JSON.stringify({ level: 'error', service: 'backup-worker', error: `Database not found: ${database}` }),
    );
    return;
  }
  const target = resolve(backupDir, `poe2-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  const result = spawnSync(process.execPath, [resolve('backend/dist/databaseMaintenance.js'), 'backup', target], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const error = (result.stderr || result.stdout).trim();
    record('error', target, error, 0);
    console.error(JSON.stringify({ level: 'error', service: 'backup-worker', error }));
    return;
  }
  const backups = globSync('poe2-*.db', { cwd: backupDir })
    .map((name) => resolve(backupDir, name))
    .sort()
    .reverse();
  for (const expired of backups.slice(retention)) rmSync(expired, { force: true });
  record('ok', target, null, 1);
  console.log(
    JSON.stringify({ level: 'info', service: 'backup-worker', target, retained: Math.min(backups.length, retention) }),
  );
}

runBackup();
setInterval(runBackup, interval);
