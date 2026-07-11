import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{
    name: 'externalize-node-sqlite',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'sqlite' || source === 'node:sqlite') return { id: 'node:sqlite', external: true };
    },
  }],
  test: {
    environment: 'node',
    server: { deps: { external: ['node:sqlite'] } },
  },
  ssr: { external: ['node:sqlite'] },
});
