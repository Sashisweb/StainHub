import { Page, Locator, expect } from '@playwright/test';

/**
 * PAGE OBJECT: LoginPage
 * Handles login UI operations.
 */
export class LoginPage {
  readonly page: Page;

  // ---------- Locators ----------
 signInButton: Locator;
  emailInput: Locator;
  passwordInput: Locator;
  loginButton: Locator;
  dashboardTitle: Locator;
  errorToast: Locator;
  continueButton: Locator;

  constructor(page: Page) {
    this.page = page;
     // The initial “Sign In” button on your landing page
    this.loginButton = page.locator('button:has-text("Login")');
    this.dashboardTitle = page.locator('text=Organization Activity');
    this.errorToast = page.locator('.toast-error, .error-message');
    
    //  specific locators
    this.signInButton = page.getByRole('button', { name: 'Sign In ' });
    this.emailInput = page.getByRole('textbox', { name: 'Email address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
  }

  /** Opens login page */
  async openApplication(): Promise<void> {
    await this.page.goto('');
  }

  /** Performs login with credentials */
  async login(email: string, password: string): Promise<void> {
   await this.openApplication();

    // Step 1: Click “Sign In” before any inputs
    await expect(this.signInButton).toBeVisible({ timeout: 10000 });
    await this.signInButton.click();

    // Step 2: Wait for login form to appear
    await expect(this.emailInput).toBeVisible({ timeout: 15000 });

    // Step 3: Fill credentials
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    // Step 4: Click “Continue” / “Log In”
    await this.continueButton.click();

    // Step 5: Wait for dashboard/homepage confirmation
    await expect(this.dashboardTitle).toBeVisible({ timeout: 20000 });
  }

  /** Verifies invalid login message */
  async verifyInvalidLogin(): Promise<void> {
    await expect(this.errorToast).toContainText(/Invalid|Incorrect/i);
  }

  /** Opens login page */
  async openLoginPage(): Promise<void> {
    await this.page.goto('/login');
  }

  async expireSessionToken(): Promise<void> {
    console.log('🕒 Simulating token expiry...');
    await this.page.evaluate(() => {
      const token = localStorage.getItem('authToken');
      if (token) {
        const expiredToken = `${token}_expired`;
        localStorage.setItem('authToken', expiredToken);
      }
    });
    console.log('⚠️ Token manually expired in localStorage');
  }

  async refreshAndValidateReauth(): Promise<void> {
    console.log('🔄 Refreshing page to validate reauthentication...');
    await this.page.reload();
    await this.page.waitForTimeout(2000);
  
    // Expect redirect to login or auto re-login
    const loginField = this.page.locator('input[placeholder="Email"], input[type="email"]');
    if (await loginField.isVisible()) {
      console.log('🔐 Session expired - redirected to login page');
      await expect(loginField).toBeVisible();
    } else {
      console.log('✅ Token refreshed successfully, still authenticated');
      await expect(this.page.getByText(/Dashboard|Organization Activity/i)).toBeVisible();
    }
  }
}
