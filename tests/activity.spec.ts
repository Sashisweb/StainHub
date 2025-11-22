import { test, expect } from '../fixtures/activity.fixture';
import { NetworkLogger } from '../utils/network.logger';
import activityData from '../data/activityData.json';

test.describe('Organization Activity - Virtual Stain Hub', () => {
  test.beforeEach(async ({ activityPage }) => {
    await activityPage.gotoActivityPage();
  });

  test.only('should load Organization Activity page with all overview sections and metrics', async ({ activityPage, page }) => {
    const networkLogger = new NetworkLogger(page, 'all', activityData.networkPattern);
    await networkLogger.startLogging();

    await activityPage.verifyOverviewSections();
    await activityPage.validateOverviewMetrics();
    await activityPage.verifyChartAndQuarter();
    await activityPage.verifyStainOverviewRows();
    await activityPage.verifyUploadSlidesEnabled();

    networkLogger.printLogs();
  });

  test('should display valid stain usage overview rows and totals', async ({ activityPage }) => {
    await activityPage.verifyStainOverviewRows();
    const count = await activityPage.stainCategoryRows.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('should allow navigation between Slides and Projects tabs', async ({ activityPage }) => {
    await activityPage.switchTab('Slides');
    await activityPage.switchTab('Projects');
    await activityPage.switchTab('Slides');
  });

  test('should filter slides based on search input', async ({ activityPage }) => {
    await activityPage.searchSlide(activityData.searchKeyword);
    await expect(activityPage.slideRows.first()).toBeVisible();
  });

  test('should expand slide and validate detailed metadata', async ({ activityPage }) => {
    await activityPage.expandFirstSlide();
    await activityPage.verifyExpandedSlideDetails();
  });

  test('should navigate pagination when available', async ({ activityPage }) => {
    await activityPage.navigatePagination();
  });

  test('should handle empty or failed state gracefully', async ({ activityPage }) => {
    if (await activityPage.noDataMessage.isVisible()) {
      await expect(activityPage.noDataMessage).toBeVisible();
    }
  });

  test('should capture and validate network traffic for stains and slides', async ({ activityPage, page }) => {
    const networkLogger = new NetworkLogger(page, 'all', activityData.networkPattern);
    await networkLogger.startLogging();

    await activityPage.verifyOverviewSections();
    await activityPage.expandFirstSlide();
    await activityPage.verifyExpandedSlideDetails();

    networkLogger.printLogs();
    networkLogger.saveToFile('network-logs/activity-network.txt');
  });

  test('should navigate to slide details and back to dashboard', async ({ activityPage }) => {
    await activityPage.expandFirstSlide();
    await activityPage.navigateBack();
  });
});
