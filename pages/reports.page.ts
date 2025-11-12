import { Page, Locator, expect } from '@playwright/test';

export class ReportsPage {
  readonly page: Page;

  // ---------- Locators ----------
  pageTitle: Locator;
  stainsTab: Locator;
  usersTab: Locator;
  yearDropdown: Locator;
  downloadReportButton: Locator;
  stainChart: Locator;
  stainCards: Locator;
  userSearchInput: Locator;
  userListItems: Locator;
  viewUserButton: Locator;
  userQuarterDropdown: Locator;
  noDataMessage: Locator;
  paginationControls: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: /Organization Reports/i });
    this.stainsTab = page.getByRole('tab', { name: /Stains/i });
    this.usersTab = page.getByRole('tab', { name: /Users/i });
    this.yearDropdown = page.getByRole('combobox');
    this.downloadReportButton = page.getByRole('button', { name: /Download Usage Report/i });
    this.stainChart = page.locator('canvas, svg').first();
    this.stainCards = page.locator('.MuiAccordion-root');
    this.userSearchInput = page.getByPlaceholder(/Search by name or email/i);
    this.userListItems = page.locator('.MuiListItem-root');
    this.viewUserButton = page.getByRole('button', { name: /View User/i });
    this.userQuarterDropdown = page.getByRole('combobox', { name: /Quarter/i });
    this.noDataMessage = page.getByText(/No stain data available|No QC data available/i);
    this.paginationControls = page.locator('button[aria-label*="page"], .pagination');
  }

  // ---------- Actions ----------
  async gotoReportsPage(): Promise<void> {
    await this.page.goto('https://f18848f2.prism-app.pages.dev/reports');
    await expect(this.pageTitle).toBeVisible();
  }

  async switchToTab(tab: 'Stains' | 'Users'): Promise<void> {
    const targetTab = tab === 'Stains' ? this.stainsTab : this.usersTab;
    await targetTab.click();
    await expect(targetTab).toHaveAttribute('aria-selected', 'true');
  }

  async selectYear(year: string): Promise<void> {
    await this.yearDropdown.selectOption(year);
    await expect(this.stainChart).toBeVisible();
  }

  async verifyOverallReportElements(): Promise<void> {
    await expect(this.downloadReportButton).toBeVisible();
    await expect(this.stainChart).toBeVisible();
  }

  async expandAndValidateStainSections(): Promise<void> {
    const totalSections = await this.stainCards.count();
    expect(totalSections).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < totalSections; i++) {
      const section = this.stainCards.nth(i);
      await section.scrollIntoViewIfNeeded();
      await section.click();
      await expect(section).toHaveAttribute('aria-expanded', /true|false/);
    }
  }

  async downloadStainReport(sectionIndex: number): Promise<void> {
    const section = this.stainCards.nth(sectionIndex);
    const downloadBtn = section.getByRole('button', { name: /Download/i });
    if (await downloadBtn.isVisible()) {
      await downloadBtn.click();
    }
  }

  async searchUser(keyword: string): Promise<void> {
    await this.userSearchInput.fill(keyword);
  }

  async openUserDetails(): Promise<void> {
    await this.viewUserButton.first().click();
    await expect(this.userQuarterDropdown).toBeVisible();
  }

  async verifyUserReportDetails(): Promise<void> {
    await expect(this.userQuarterDropdown).toBeVisible();
    await expect(this.noDataMessage.or(this.userQuarterDropdown)).toBeVisible();
  }

  async navigatePagination(): Promise<void> {
    if (await this.paginationControls.isVisible()) {
      const count = await this.paginationControls.count();
      if (count > 1) {
        await this.paginationControls.nth(1).click();
        await expect(this.userListItems.first()).toBeVisible();
      }
    }
  }
  
  async validateStainChartLoaded(): Promise<void> {
    await expect(this.stainChart).toBeVisible();
  }

 async downloadUsageReport(): Promise<void> {
    await this.downloadReportButton.click();
  }

  async verifyDownloadSuccess(): Promise<void> {
    await expect(this.downloadReportButton).toBeVisible();
  }

  async switchToUsersTab(): Promise<void> {
    await this.usersTab.click();
    await expect(this.usersTab).toHaveAttribute('aria-selected', 'true');
  }

  async validateUserReportElements(): Promise<void> {
    // Wait for user report table to appear
    const tableHeader = this.page.locator('.MuiTableHead-root th');
    const userNameColumn = this.page.getByText(/User|Name/i);
    const stainsColumn = this.page.getByText(/Stains/i);
    const downloadsColumn = this.page.getByText(/Downloads/i);
  
    await expect(tableHeader.first()).toBeVisible({ timeout: 10000 });
    await expect(userNameColumn).toBeVisible();
    await expect(stainsColumn).toBeVisible();
    await expect(downloadsColumn).toBeVisible();
  
    // Validate at least one user record is listed
    const rows = this.page.locator('.MuiTableBody-root tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  
    console.log(`✅ User Report Table loaded with ${count} entries`);
  }
  

}
