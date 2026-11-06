import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/test/**/*.test.js',
      'apps/**/test/**/*.test.js'
    ],
    exclude: [
      'e2e/**',
      'legacy/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**'
    ],
    environment: 'node'
  }
});
