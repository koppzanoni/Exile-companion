import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [react(), ...(process.env.ANALYZE ? [visualizer({ open: true, filename: 'dist/stats.html' })] : [])],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3001' } },
});
