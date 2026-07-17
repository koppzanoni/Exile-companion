import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.js';

for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
  if (existsSync(candidate)) { process.loadEnvFile(candidate); break; }
}

const port = Number(process.env.PORT || 3001);
const app = createApp();
app.listen(port, '0.0.0.0', () => console.log(`poe2-orb-analyzer backend listening on ${port}`));
