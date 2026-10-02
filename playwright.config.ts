import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: process.env.PLAYWRIGHT_GAME_TESTS === '1'
    ? ['**/navigation.spec.ts', '**/ranking.spec.ts', '**/gameplay.spec.ts', '**/registration.spec.ts']
    : ['**/navigation.spec.ts', '**/ranking.spec.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } } },
    { name: 'mobile-portrait-chromium', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } } },
  ],
});
