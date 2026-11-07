import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5180',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    }
  },
  webServer: {
    command:
      'npx vite build --config e2e/fixtures/rendering/vite.config.js && npx vite preview --config e2e/fixtures/rendering/vite.config.js --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180/dice-playground/e2e-fixtures/rendering/',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
