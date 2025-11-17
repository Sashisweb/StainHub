import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// ✅ Load environment variables from .env file before Playwright reads them
dotenv.config();

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  
  // Timeouts
  timeout: 60000, // Test timeout (60 seconds)
  expect: {
    timeout: 10000, // Assertion timeout (10 seconds)
  },
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Allow 1 retry locally for flaky tests
  workers: process.env.CI ? 4 : undefined,
  
  // Reporters
  reporter: process.env.CI
    ? [
        ['html'],
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }],
        ['github'],
      ]
    : [
        ['html'],
        ['list'],
        ['json', { outputFile: 'test-results/results.json' }],
      ],
  
  use: {
    baseURL: process.env.BASE_URL || 'https://f18848f2.prism-app.pages.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000, // Action timeout (15 seconds)
    navigationTimeout: 30000, // Navigation timeout (30 seconds)
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: undefined,
});