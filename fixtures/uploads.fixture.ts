import { test as base, expect } from '@playwright/test';
import { UploadsPage } from '../pages/uploads.page';
import { ensureLogin } from '../utils/login.helper';

type UploadsFixture = {
  uploadsPage: UploadsPage;
};

export const test = base.extend<UploadsFixture>({
  uploadsPage: async ({ page }, use) => {
    await ensureLogin(page);
    const uploadsPage = new UploadsPage(page);
    await use(uploadsPage);
  },
});

export { expect };
