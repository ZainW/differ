import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled'
    }
  },
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 860 },
    colorScheme: 'dark',
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command:
      'node ./node_modules/vite/bin/vite.js preview --config vite.visual.config.ts --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/visual.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  outputDir: 'test-results'
})
