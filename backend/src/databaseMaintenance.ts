import path from 'node:path';
import { backupDatabase, restoreDatabase, verifyDatabase } from './databaseMaintenanceCore.js';

const command = process.argv[2],
  database = path.resolve(process.env.DATABASE_PATH || 'data/poe2-analyzer.db');
if (command === 'backup') {
  const target = path.resolve(process.argv[3] || `backups/poe2-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  console.log(JSON.stringify({ ok: true, action: 'backup', ...backupDatabase(database, target) }));
} else if (command === 'verify') {
  const target = path.resolve(process.argv[3] || database);
  console.log(JSON.stringify({ ok: true, action: 'verify', target, result: verifyDatabase(target) }));
} else if (command === 'restore') {
  console.log(
    JSON.stringify({ ok: true, action: 'restore', ...restoreDatabase(database, path.resolve(process.argv[3] || '')) }),
  );
} else throw new Error('Use backup, verify, or restore.');
