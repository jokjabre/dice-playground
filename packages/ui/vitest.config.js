import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@dice/settings': resolve(__dirname, '../settings/src/index.js'),
      '@dice/core': resolve(__dirname, '../core/src/index.js')
    }
  },
  test: {
    environment: 'node'
  }
});
