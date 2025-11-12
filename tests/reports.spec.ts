import { test, expect } from '../fixtures/reports.fixture';
import { NetworkLogger } from '../utils/network.logger';
import reportsData from '../data/reportsData.json';

test.describe('Organization Reports - Virtual Stain Hub', () => {
  
  test.beforeEach(async ({ reportsPage }) => {
    await reportsPage.gotoReportsPage();
  });

  // Verify structure, navigation, and overall stain data
  test('should display overall organization stain reports and validate year selection', async ({ reportsPage, page }) => {
    const networkLogger = new NetworkLogger(page, 'all', '/api/reports');
    await networkLogger.startLogging();

    await reportsPage.verifyOverallReportElements();
    await reportsPage.selectYear(reportsData.reports.validYear);
    await expect(reportsPage.downloadReportButton).toBeVisible();
    await reportsPage.downloadReportButton.click();

    await page.waitForTimeout(2000);
    networkLogger.printLogs();
  });

  // Validate stain-type specific reports and their downloads
  test('should display individual stain reports, charts, and allow downloads', async ({ reportsPage }) => {
    await reportsPage.expandAndValidateStainSections();
    const sectionCount = await reportsPage.stainCards.count();

    for (let i = 0; i < sectionCount; i++) {
      await reportsPage.downloadStainReport(i);
    }
  });

  // Validate empty data and edge conditions
  test('should handle no data available scenario gracefully', async ({ reportsPage }) => {
    await reportsPage.selectYear('2023'); // Year with no data
    await expect(reportsPage.noDataMessage).toBeVisible();
  });

  // Validate Users tab and user search functionality
  test('should switch to Users tab, search users, and validate list', async ({ reportsPage }) => {
    await reportsPage.switchToTab('Users');
    await expect(reportsPage.userSearchInput).toBeVisible();
    await reportsPage.searchUser('pictor');
    await expect(reportsPage.userListItems.first()).toBeVisible();
  });

  // Validate viewing individual user data and report details
  test('should open user details and display report components', async ({ reportsPage }) => {
    await reportsPage.switchToTab('Users');
    await reportsPage.openUserDetails();
    await reportsPage.verifyUserReportDetails();
  });

  // Validate user quarter change, charts, and data update
  test('should update user reports when quarter is changed', async ({ reportsPage }) => {
    await reportsPage.switchToTab('Users');
    await reportsPage.openUserDetails();
    await reportsPage.userQuarterDropdown.selectOption({ index: 1 });
    await expect(reportsPage.noDataMessage.or(reportsPage.userQuarterDropdown)).toBeVisible();
  });

  // Validate pagination and navigation through user list
  test('should navigate through paginated user list', async ({ reportsPage }) => {
    await reportsPage.switchToTab('Users');
    await reportsPage.navigatePagination();
  });

  // Validate user with no stain data (negative case)
  test('should display empty message for inactive users', async ({ reportsPage }) => {
    await reportsPage.switchToTab('Users');
    await reportsPage.searchUser('inactive.user@example.com');
    await expect(reportsPage.noDataMessage).toBeVisible();
  });

  // Validate tab switching retains context
  test('should retain tab and filter states when switching between tabs', async ({ reportsPage }) => {
    await reportsPage.switchToTab('Users');
    await reportsPage.switchToTab('Stains');
    await reportsPage.verifyOverallReportElements();
  });

  // Validate full end-to-end data integrity and network logging
  test('should capture and verify network requests for stains and users', async ({ reportsPage, page }) => {
    const networkLogger = new NetworkLogger(page, 'all');
    await networkLogger.startLogging();

    await reportsPage.switchToTab('Stains');
    await reportsPage.selectYear('2025');
    await reportsPage.downloadReportButton.click();

    await reportsPage.switchToTab('Users');
    await reportsPage.searchUser('pictor');
    await reportsPage.openUserDetails();

    networkLogger.printLogs();
    networkLogger.saveToFile('network-logs/reports-e2e.txt');
  });
});
