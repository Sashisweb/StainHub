// dashboard.spec.ts
import { test, expect } from '@playwright/test';
import { login } from '../fixtures/login.fixture';

test.beforeEach(async ({ page }) => {
  await login(page, process.env.EMAIL!, process.env.PASSWORD!);
});

test('Verify dashboard loads with navigation controls', async ({ page }) => {
  await expect(page.getByText('Organization Activity')).toBeVisible();
  await expect(page.locator('text=Dashboard')).toBeVisible();
});