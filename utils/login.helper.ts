import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { AuthManager } from '../utils/authManager';

export async function ensureLogin(page: Page): Promise<void> {
  const hasValidToken = AuthManager.isTokenValid();

  if (hasValidToken) {
    console.log('🔁 Using existing valid Auth0 token...');
    await AuthManager.loadLocalStorage(page);
    await page.reload();  // Apply token and refresh session
    return;
  }

  console.log('🔐 Performing full login...');
  const loginPage = new LoginPage(page);
  await loginPage.login(process.env.EMAIL!, process.env.PASSWORD!);
  await AuthManager.saveLocalStorage(page);
}
