import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.ts';

export default defineConfig(baseConfig, {
  testMatch: '**/visual.spec.ts',
  outputDir: './test-results/visual',
  snapshotPathTemplate: '{testDir}/../visual/baselines/{platform}/{projectName}/{arg}{ext}',
  reporter: [['list'], ['html', { outputFolder: 'visual-report', open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.001 },
  },
});
