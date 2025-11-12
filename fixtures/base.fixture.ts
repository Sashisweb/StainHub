import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ActivityPage } from '../pages/activity.page';
import { ModelsPage } from '../pages/models.page';
import { UploadsPage } from '../pages/uploads.page';
import { ReportsPage } from '../pages/reports.page';
import { ensureLogin } from '../utils/login.helper';    

type VirtualStainFixture = {
  loginPage: LoginPage;
  activityPage: ActivityPage;
  modelsPage: ModelsPage;
  uploadsPage: UploadsPage;
  reportsPage: ReportsPage;
};

export const test = base.extend<VirtualStainFixture>({
    loginPage: async ({ page }, use) => {
      const loginPage = new LoginPage(page);
      await use(loginPage);
    },
    activityPage: async ({ page }, use) => {
      const activityPage = new ActivityPage(page);
      await use(activityPage);
    },
    modelsPage: async ({ page }, use) => {
      const modelsPage = new ModelsPage(page);
      await use(modelsPage);
    },
    uploadsPage: async ({ page }, use) => {
      const uploadsPage = new UploadsPage(page);
      await use(uploadsPage);
    },
    reportsPage: async ({ page }, use) => {
      const reportsPage = new ReportsPage(page);
      await use(reportsPage);
    },
  });
  
  export { expect };