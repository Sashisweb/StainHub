import { Page, Locator, expect } from '@playwright/test';

/**
 * ------------------------------------------------------------------
 * PAGE OBJECT: ModelsPage
 * DESCRIPTION:
 * Encapsulates locators and reusable actions for Models (Stain Management).
 * ------------------------------------------------------------------
 */

export class ModelsPage {
  readonly page: Page;

  // ---------- Locators ----------
  loaderMessage: Locator;
  totalStainersLabel: Locator;
  totalStainerCount: Locator;
  stainManagementHeader: Locator;
  modelCards: Locator;
  modelToggles: Locator;
  alertMessage: Locator;
  permissionWrapper: Locator;
  hematoxylinEosinStain: Locator;
  cd45Stain: Locator;
  autoDeepStainerHeading: Locator;
  autoRestainerHeading: Locator;
  pancMarker: Locator;
  header: Locator;
  loader: Locator;

  constructor(page: Page) {
    this.page = page;

    // Assign all locators
    this.loaderMessage = page.locator('text=Loading stain information...');
    this.totalStainersLabel = page.locator('text=Total Stainers Available');
    this.totalStainerCount = page.locator('//div[text()="Total Stainers Available"]/following-sibling::div[1]')
    this.stainManagementHeader = page.getByRole('tab', { name: 'Stain Management' })
    this.modelCards = page.locator('.m-2.MuiBox-root');
    this.modelToggles = page.locator('button[role="switch"]');
    this.alertMessage = page.locator('.toast-message, .alert, [role="alert"]');
    
    // Stain selection locators
    this.permissionWrapper = page.getByTestId('permission-wrapper');
    this.hematoxylinEosinStain = page.getByText('H&E(Hematoxylin and Eosin)');
    this.cd45Stain = page.getByText('CD45(Immunohistochemistry)');
    this.autoDeepStainerHeading = page.getByRole('heading', { name: 'Auto Deep Stainer' });
    this.autoRestainerHeading = page.getByRole('heading', { name: 'Auto Restainer' });
    this.pancMarker = page.getByText('PanCK-MG-TRT(');
    this.header = page.getByRole('heading', { name: /Stain Management/i });
    this.loader = page.getByText(/Loading stain information/i);
  }

  // ---------- Reusable Functions ----------

  /** Wait until models are fully loaded */
  async waitForModelsToLoad(): Promise<void> {
    await expect(this.loaderMessage).toBeVisible();
    await expect(this.loaderMessage).toBeHidden({ timeout: 20000 });
    // await expect(this.modelCards.first()).toBeVisible();
  }

  /** Get total number of displayed model cards */
  async getDisplayedModelCount(): Promise<number> {
    return await this.modelCards.count();
  }

  /** Extract numeric count from "Total Stainers Available" label */
  async getTotalStainersCountFromLabel(): Promise<number> {
    const text = await this.totalStainerCount.textContent();
    console.log('Total Stainers Label Text:', text);
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /** Toggle model ON/OFF by index */
  async toggleModel(index: number): Promise<void> {
    const toggle = this.modelToggles.nth(index);
    await toggle.click();
  }

  /** Get current ON/OFF state of a model toggle */
  async getModelToggleState(index: number): Promise<boolean> {
    const toggle = this.modelToggles.nth(index);
    const value = await toggle.getAttribute('aria-checked');
    return value === 'true';
  }

  /** Validate headers and metadata visibility */
  async validateHeadersAndMetadata(): Promise<void> {
    await expect(this.stainManagementHeader).toBeVisible();
    await expect(this.totalStainersLabel).toBeVisible();
    // await expect(this.modelCards.first()).toContainText(/Version|Type/i);
  }

  /** Validate that Total Stainers label matches actual model count */
  async validateModelCountMatchesLabel(): Promise<void> {
    const labelCount = await this.getTotalStainersCountFromLabel();
    const cardCount = await this.getDisplayedModelCount();
    expect(labelCount).toBe(cardCount);
  }

  /** Attempt to disable all models, verify rule "at least one enabled" */
  async disableAllModelsAndValidateRule(): Promise<void> {
    const toggles = this.modelToggles;
    const count = await toggles.count();

    for (let i = 0; i < count; i++) {
      const state = await toggles.nth(i).getAttribute('aria-checked');
      if (state === 'true') {
        await toggles.nth(i).click();
      }
    }

    await expect(this.alertMessage).toContainText('At least one model must remain enabled');
  }

  /** Verify at least one model remains enabled after toggling */
  async verifyAtLeastOneModelEnabled(): Promise<void> {
    const states = await this.modelToggles.evaluateAll(toggles =>
      toggles.map(t => t.getAttribute('aria-checked'))
    );
    const anyEnabled = states.includes('true');
    expect(anyEnabled).toBeTruthy();
  }

  /** Select stains: H&E and CD45 */
  async selectStains(): Promise<void> {
    await this.permissionWrapper.first().click();
    await this.hematoxylinEosinStain.first().click();
    await this.cd45Stain.click();
  }

  /** Navigate and verify stainer models (Auto Deep Stainer, Auto Restainer) */
  async navigateAndVerifyStainers(): Promise<void> {
    await this.autoDeepStainerHeading.click();
    await expect(this.autoDeepStainerHeading).toBeVisible();
    await expect(this.autoRestainerHeading).toBeVisible();
  }

  /** Verify all stain markers are visible */
  async verifyStainMarkersVisible(): Promise<void> {
    await expect(this.hematoxylinEosinStain.first()).toBeVisible();
    await expect(this.pancMarker).toBeVisible();
  }

  async goto(): Promise<void> {
    await this.page.getByRole('link', { name: /Models/i }).click();
    await expect(this.page).toHaveURL(/models/);
  }

  async waitForLoad(): Promise<void> {
    await expect(this.loader).toBeHidden({ timeout: 20000 });
    await expect(this.header).toBeVisible();
  }

  async verifyModelList(): Promise<void> {
    const count = await this.modelCards.count();
    expect(count).toBeGreaterThan(0);
  }

  async simulateModelOutage(): Promise<void> {
    console.log('⚙️ Simulating Model API outage...');
    await this.page.route('**/api/models', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Model service not available' }),
      });
    });
  
    // Navigate to Models page to trigger the interception
    await this.goto();
    await expect(this.page.getByText(/Model service not available/i)).toBeVisible();
    console.log('✅ Model outage simulated successfully');
  }

  /**
 * Intercepts the /api/models endpoint and increases the model count.
 * Useful for testing dynamic model rendering and frontend count display.
 */
async interceptAndIncreaseModelCount(extraModels = 3): Promise<void> {
  console.log(`⚙️ Intercepting /api/models to add ${extraModels} new mock models...`);

  await this.page.route('**/api/models', async route => {
    // Fetch the real response first
    const originalResponse = await route.fetch();
    const originalBody = await originalResponse.json();

    // Create mock models
    const newModels = Array.from({ length: extraModels }).map((_, i) => ({
      name: `Mock-Stain-${i + 1}`,
      enabled: true,
      description: 'Auto-generated mock stain for testing',
    }));

    // Merge existing + mock models
    const updatedModels = [...originalBody.models, ...newModels];
    const updatedResponse = {
      ...originalBody,
      models: updatedModels,
      totalCount: updatedModels.length,
    };

    // Fulfill with modified data
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(updatedResponse),
    });
  });

  // Navigate to trigger interception
  await this.goto();

  console.log('Model interception applied, mock models added');
}

  
}
