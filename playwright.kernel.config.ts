import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

export default defineConfig({
  ...baseConfig,
  testDir: './tests/kernel',
  outputDir: './test-results/kernel',
  timeout: 60_000,
});
