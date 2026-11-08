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
  webServer: [
    {
      command:
        'npx vite build --config e2e/fixtures/rendering/vite.config.js && npx vite preview --config e2e/fixtures/rendering/vite.config.js --port 5180 --strictPort',
      url: 'http://127.0.0.1:5180/dice-playground/e2e-fixtures/rendering/',
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    },
    {
      // Production build preview: build the registry apps with the Pages
      // base path, then serve the whole dist/ tree with vite preview.
      command:
        'BASE_PATH=/dice-playground/ npm run build && BASE_PATH=/dice-playground/ npx vite preview --host 127.0.0.1 --port 5181 --strictPort',
      url: 'http://127.0.0.1:5181/dice-playground/apps/demos/enclosure-gallery/',
      reuseExistingServer: !process.env.CI,
      timeout: 180000
    }
  ]
});
