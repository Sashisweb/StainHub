import { test, expect } from '../fixtures/models.fixture';
import { ensureLogin } from '../utils/login.helper';
import { NetworkLogger } from '../utils/network.logger';

/**
 * ------------------------------------------------------------------
 * TEST SUITE: Models (Stain Management)
 * DESCRIPTION:
 * Uses ModelsPage fixture for initialization
 * and performs login in beforeEach() using token or UI.
 * ------------------------------------------------------------------
 */

test.describe('Models Module - Stain Management', () => {

  test.beforeEach(async ({ page }) => {
    // Login handled here using helper
    await ensureLogin(page);

    // Navigate to Models page after successful login
   await page.getByRole('button', { name: 'Model' }).click();
    await expect(page).toHaveURL(/models/);
  });

  // --------------------------------------------------------------
  // TEST CASES
  // --------------------------------------------------------------



  test('Load models and verify counts', async ({ page, modelsPage }) => {
   
    //capture network logs
    const networkLogger = new NetworkLogger(page, 'response', '/models');
    await networkLogger.startLogging();

    await modelsPage.waitForModelsToLoad();
    await modelsPage.validateHeadersAndMetadata();
    await modelsPage.validateModelCountMatchesLabel();

    const total = await modelsPage.getDisplayedModelCount();
    expect(total).toBeGreaterThan(0);
    networkLogger.printLogs();
    networkLogger.saveToFile('logs/models-network.txt');
   
  });

  test('Verify "Total Stainers" and "Stain Management" sections visible', async ({ modelsPage }) => {
    await modelsPage.waitForModelsToLoad();
    await expect(modelsPage.totalStainersLabel).toBeVisible();
    await expect(modelsPage.stainManagementHeader).toBeVisible();
  });

 test('Display all models with correct metadata', async ({ page }) => {
    await expect(page.getByText('Auto Deep Stainer')).toBeVisible();
    await expect(page.getByText('Auto Restainer')).toBeVisible();

    const modelCards = page.locator('.model-card');
    await expect(modelCards).toHaveCount(6);

    // Validate metadata visibility
    await expect(page.getByText(/Version:/)).toBeVisible();
    await expect(page.getByText(/Type:/)).toBeVisible();
  });

 test('Match Total Stainers Available count with model cards', async ({ modelsPage }) => {
    await modelsPage.waitForModelsToLoad();
    const labelCount = await modelsPage.getTotalStainersCountFromLabel();
    const actualCount = await modelsPage.getDisplayedModelCount();
    expect(labelCount).toBe(actualCount);
  });
 
  test('Toggle model ON/OFF successfully', async ({ modelsPage }) => {
    await modelsPage.waitForModelsToLoad();
    const index = 0;
    const before = await modelsPage.getModelToggleState(index);
    await modelsPage.toggleModel(index);
    const after = await modelsPage.getModelToggleState(index);
    expect(after).not.toBe(before);
  });

  test('Enforce at least one model enabled', async ({ modelsPage }) => {
    await modelsPage.waitForModelsToLoad();
    await modelsPage.disableAllModelsAndValidateRule();
  });

  test('Persist model state after reload', async ({ page, modelsPage }) => {
    await modelsPage.waitForModelsToLoad();
    const index = 1;
    const before = await modelsPage.getModelToggleState(index);
    await page.reload();
    await modelsPage.waitForModelsToLoad();
    const after = await modelsPage.getModelToggleState(index);

    expect(after).toBe(before);
  });

  test('Allow admin to enable a model', async ({ page }) => {
    const disabledModel = page.locator('.model-card:has(button[aria-checked="false"])').first();
    await disabledModel.getByRole('switch').click();
    await expect(disabledModel.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  test('Allow admin to disable a model when multiple enabled', async ({ page }) => {
    const enabledModel = page.locator('.model-card:has(button[aria-checked="true"])').nth(1);
    await enabledModel.getByRole('switch').click();
    await expect(enabledModel.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  test('Prevent disabling the last active model', async ({ page }) => {
    const switches = page.locator('button[role="switch"][aria-checked="true"]');
    const count = await switches.count();

    if (count === 1) {
      const lastModel = switches.first();
      await lastModel.click();
      const alert = page.getByText(/At least one model must remain enabled/i);
      await expect(alert).toBeVisible();
      await expect(lastModel).toHaveAttribute('aria-checked', 'true');
    } else {
      test.skip();
    }
  });

  test('Restrict access for unauthorized users', async ({ page, context }) => {
    // Simulate a new unauthenticated session
    const newPage = await context.newPage();
    await newPage.goto('/models');
    await expect(newPage).toHaveURL(/login|dashboard/);
  });

  test('Display read-only mode for viewer role', async ({ page }) => {
    if (process.env.USER_ROLE === 'viewer') {
      const toggles = await page.getByRole('switch').count();
      expect(toggles).toBe(0);
    }
  });

  test('Show correct section headers', async ({ page }) => {
    await expect(page.getByText('Auto Deep Stainer')).toBeVisible();
    await expect(page.getByText('Auto Restainer')).toBeVisible();
  });

  test('Make valid API call when toggling model', async ({ page }) => {
    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('/api/org/') && req.method() === 'PATCH') {
        apiCalled = true;
      }
    });

    const toggle = page.locator('button[role="switch"]').first();
    await toggle.click();
    expect(apiCalled).toBeTruthy();
  });

  test('Handle backend failure Data Loading with Proper message', async ({ page }) => {
    // Simulated by intercepting PATCH and forcing failure
    await page.route('**/api/org/**/models/**', route => route.abort('failed'));

    const toggle = page.locator('button[role="switch"]').first();
    await toggle.click();

    const errorToast = page.getByText(/Unable to update model state/i);
    await expect(errorToast).toBeVisible();
  });

  test('Reflect new models dynamically', async ({ page }) => {
    await page.reload();
    const modelList = await page.locator('.model-card').allTextContents();
    expect(modelList.length).toBeGreaterThan(0);
  });

  test('Visually indicate enabled vs disabled models', async ({ page }) => {
    const enabled = page.locator('.model-card:has(button[aria-checked="true"])');
    const disabled = page.locator('.model-card:has(button[aria-checked="false"])');
    await expect(enabled.first()).toHaveClass(/active|enabled/);
    await expect(disabled.first()).toHaveClass(/inactive|disabled/);
  });

  test('Reflect model state changes across users', async ({ page, context }) => {
    // Simulate another user session
    const otherPage = await context.newPage();
    await ensureLogin(otherPage);
    await otherPage.getByRole('link', { name: /Models/i }).click();
    const firstToggle = otherPage.getByRole('switch').first();
    await expect(firstToggle).toBeVisible();
  });

  test('Support keyboard interaction for toggles', async ({ page }) => {
    const firstToggle = page.getByRole('switch').first();
    await firstToggle.focus();
    await page.keyboard.press('Space');
    await expect(firstToggle).toHaveAttribute('aria-checked', 'true');
  });

  test(' show friendly message when no models available', async ({ page }) => {
    await page.route('**/api/org/**/models', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.reload();
    await expect(page.getByText(/No models available/i)).toBeVisible();
  });

  test(' log audit entry when model state changes', async ({ page }) => {
    // Simulated check for audit log trigger
    const toggle = page.locator('button[role="switch"]').first();
    await toggle.click();
    const auditEntry = page.locator('.audit-log-entry');
    await expect(auditEntry).toBeVisible();
  });

  test('should intercept model API and increase model count dynamically', async ({ modelsPage }) => {
    // Intercept and add 3 extra models
    await modelsPage.interceptAndIncreaseModelCount(3);
  
    // Wait for the model list to load
    await modelsPage.waitForModelsToLoad();
  
    // Verify total count increased (original + 3)
    const modelCount = await modelsPage.getDisplayedModelCount();
    expect(modelCount).toBeGreaterThanOrEqual(9); // assuming original count was 6
  
    // Verify total stainers message updates in UI
    const totalStainersLabel = modelsPage.page.getByText(/Total Stainers Available/i);
    await expect(totalStainersLabel).toContainText(String(modelCount));
  
    console.log(`✅ Model count successfully intercepted and increased to ${modelCount}`);
  });

});
