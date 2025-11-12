import { test as base, expect } from '@playwright/test';
import { ActivityPage } from '../pages/activity.page';
import { ensureLogin } from '../utils/login.helper';

type ActivityFixture = {
  activityPage: ActivityPage;
};

export const test = base.extend<ActivityFixture>({
  activityPage: async ({ page }, use) => {
    await ensureLogin(page);
    const activityPage = new ActivityPage(page);
    await use(activityPage);
  },
});

export { expect };
