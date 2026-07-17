import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, pruneRequestAudit } from './app.js';
import { createDatabase } from './db.js';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const port = Number(process.env.PORT || 3001);
const db = createDatabase();
const app = createApp(db);
app.listen(port, '0.0.0.0', () => console.log(`poe2-orb-analyzer backend listening on ${port}`));

pruneRequestAudit(db);
setInterval(() => pruneRequestAudit(db), 6 * 60 * 60 * 1000).unref();
