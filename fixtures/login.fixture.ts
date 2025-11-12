import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

/**
 * FIXTURE: loginFixture
 * Provides pre-authenticated session before tests.
 */
type LoginFixture = { loginPage: LoginPage };

export const test = base.extend<LoginFixture>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(process.env.EMAIL!, process.env.PASSWORD!);
    await expect(page).toHaveURL(/dashboard/);
    await use(loginPage);
  },
});

export { expect };
