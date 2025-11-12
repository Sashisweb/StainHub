import { test as base, expect } from '@playwright/test';
import { ReportsPage } from '../pages/reports.page';
import { ensureLogin } from '../utils/login.helper';

type ReportsFixture = {
  reportsPage: ReportsPage;
};

export const test = base.extend<ReportsFixture>({
  reportsPage: async ({ page }, use) => {
    await ensureLogin(page);
    const reportsPage = new ReportsPage(page);
    await use(reportsPage);
  },
});

export { expect };