import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: fixtureDir,
  base: '/dice-playground/e2e-fixtures/rendering/',
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true
  },
  build: {
    outDir: path.join(fixtureDir, 'dist'),
    emptyOutDir: true,
    sourcemap: false
  }
});
