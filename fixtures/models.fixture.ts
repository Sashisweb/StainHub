import { test as base, expect } from '@playwright/test';
import { ModelsPage } from '../pages/models.page';

type ModelsFixture = {
  modelsPage: ModelsPage;
};

export const test = base.extend<ModelsFixture>({
  modelsPage: async ({ page }, use) => {
    const modelsPage = new ModelsPage(page);
    await use(modelsPage);
  },
});

export { expect };

