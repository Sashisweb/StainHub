import { Page, Locator, expect } from '@playwright/test';

export class ActivityPage {
  readonly page: Page;

  // ---------- Locators ----------
  pageTitle: Locator;
  slideOverviewHeader: Locator;
  totalScanned: Locator;
  totalStained: Locator;
  totalDownloads: Locator;
  stainUsageOverview: Locator;
  stainCategoryRows: Locator;
  donutChart: Locator;
  quarterDropdown: Locator;
  organizationOverviewHeader: Locator;
  slidesTab: Locator;
  projectsTab: Locator;
  searchInput: Locator;
  addFiltersButton: Locator;
  uploadSlidesButton: Locator;
  slideRows: Locator;
  orderStainsButton: Locator;
  createProjectButton: Locator;
  qcCheckbox: Locator;
  pagination: Locator;
  slideExpandToggle: Locator;
  expandedSlideStatus: Locator;
  expandedSlideName: Locator;
  expandedStainType: Locator;
  expandedDate: Locator;
  backButton: Locator;
  noDataMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // ---------- Overview Locators ----------
    this.pageTitle = page.getByRole('heading', { name: /Organization Activity/i });
    this.slideOverviewHeader = page.getByText(/Slide Overview/i);
    this.totalScanned = page.getByText(/Total WSI Slides Scanned/i);
    this.totalStained = page.getByText(/Total VSI Slides Stained/i);
    this.totalDownloads = page.getByText(/Total Downloads/i);
    this.stainUsageOverview = page.getByText(/Stain Usage Overview/i);
    this.stainCategoryRows = page.locator('.MuiTableBody-root tr');
    this.donutChart = page.locator('canvas, svg').first();
    this.quarterDropdown = page.getByRole('combobox');

    // ---------- Organization Overview Locators ----------
    this.organizationOverviewHeader = page.getByText(/Organization Overview/i);
    this.slidesTab = page.getByRole('tab', { name: /Slides/i });
    this.projectsTab = page.getByRole('tab', { name: /Projects/i });
    this.searchInput = page.getByPlaceholder(/Search/i);
    this.addFiltersButton = page.getByRole('button', { name: /Add Filters/i });
    this.uploadSlidesButton = page.getByRole('button', { name: /Upload Slides/i });
    this.slideRows = page.locator('.MuiTableBody-root tr');
    this.orderStainsButton = page.getByRole('button', { name: /Order Stains/i });
    this.createProjectButton = page.getByRole('button', { name: /Create|Add to Project/i });
    this.qcCheckbox = page.locator('input[type="checkbox"]');
    this.pagination = page.locator('.pagination, button[aria-label*="page"]');

    // ---------- Expanded Row Locators ----------
    this.slideExpandToggle = page.locator('.MuiTableBody-root tr').first();
    this.expandedSlideStatus = page.getByText(/Processing|Completed|Failed/i);
    this.expandedSlideName = page.locator('.Mui-expanded .MuiTypography-root');
    this.expandedStainType = page.getByText(/PanCK|H&E|IHC/i);
    this.expandedDate = page.getByText(/\d{2}\s\w{3},\s\d{4}/);
    this.noDataMessage = page.getByText(/No slides available|Unknown|Failed/i);

    this.backButton = page.locator('button, a').filter({ hasText: '<' });
  }

  // ---------- Actions ----------
  async gotoActivityPage(): Promise<void> {
    await this.page.goto();
    await expect(this.pageTitle).toBeVisible();
  }

  async verifyOverviewSections(): Promise<void> {
    await expect(this.slideOverviewHeader).toBeVisible();
    await expect(this.organizationOverviewHeader).toBeVisible();
  }

  async validateOverviewMetrics(): Promise<void> {
    await expect(this.totalScanned).toBeVisible();
    await expect(this.totalStained).toBeVisible();
    await expect(this.totalDownloads).toBeVisible();
  }

  async verifyChartAndQuarter(): Promise<void> {
    await expect(this.donutChart).toBeVisible();
    await this.quarterDropdown.selectOption({ index: 1 });
  }

  async verifyStainOverviewRows(): Promise<void> {
    await expect(this.stainUsageOverview).toBeVisible();
    await expect(this.stainCategoryRows.first()).toBeVisible();
  }

  async switchTab(tab: 'Slides' | 'Projects'): Promise<void> {
    const tabButton = tab === 'Slides' ? this.slidesTab : this.projectsTab;
    await tabButton.click();
    await expect(tabButton).toHaveAttribute('aria-selected', 'true');
  }

  async searchSlide(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    await this.page.keyboard.press('Enter');
  }

  async expandFirstSlide(): Promise<void> {
    await this.slideExpandToggle.first().click();
    await expect(this.expandedSlideStatus).toBeVisible();
  }

  async verifyExpandedSlideDetails(): Promise<void> {
    await expect(this.expandedSlideName).toBeVisible();
    await expect(this.expandedDate).toBeVisible();
    await expect(this.expandedStainType.or(this.noDataMessage)).toBeVisible();
  }

  async navigatePagination(): Promise<void> {
    if (await this.pagination.count() > 1) {
      await this.pagination.nth(1).click();
      await expect(this.slideRows.first()).toBeVisible();
    }
  }

  async navigateBack(): Promise<void> {
    if (await this.backButton.isVisible()) {
      await this.backButton.click();
      await expect(this.pageTitle).toBeVisible();
    }
  }
}
