import { test, expect } from '../fixtures/base.fixture';
import { NetworkLogger } from '../utils/network.logger';
import e2eData from '../data/e2eData.json';

/**
 * ------------------------------------------------------------------
 * TEST SUITE: Full End-to-End Virtual Stain Hub Workflow
 * Covers the complete user flow:
 * Login → Model Selection → Upload Slide → Verify Activity → Reports
 * ------------------------------------------------------------------
 */

test.describe('Virtual Stain Hub - End-to-End User Flow', () => {
  let networkLogger: NetworkLogger;

  test.beforeEach(async ({ page }) => {
    networkLogger = new NetworkLogger(page, 'all', '/api');
    await networkLogger.startLogging();
  });

  test('should complete end-to-end flow from login to reports validation', async ({
    loginPage,
    modelsPage,
    uploadsPage,
    activityPage,
    reportsPage,
  }) => {
    // STEP 1: LOGIN
    await loginPage.login(e2eData.validEmail, e2eData.validPassword);
    await expect(loginPage.dashboardTitle).toBeVisible();

    // STEP 2: VERIFY MODEL AVAILABILITY
    await modelsPage.goto();
    await modelsPage.verifyModelList();
    const totalModels = await modelsPage.modelCards.count();
    expect(totalModels).toBeGreaterThan(0);

    // STEP 3: UPLOAD VALID SLIDE AND PROCESS STAIN
    await uploadsPage.gotoUploadsPage();
    await uploadsPage.uploadFile(e2eData.validSlidePath);
    await uploadsPage.selectStainType(e2eData.stainType);
    await uploadsPage.enableAutorun();
    await uploadsPage.submitUpload();
    await uploadsPage.verifyProcessingStarted();

    // Wait until processing completes
    await uploadsPage.waitForUploadCompletion(e2eData.expectedSlideName);
    await uploadsPage.verifyUploadSuccess();

    // STEP 4: VALIDATE IN ORGANIZATION ACTIVITY
    await activityPage.gotoActivityPage();
    await activityPage.verifyOverviewSections();
    await activityPage.validateOverviewMetrics();

    // Verify slide appears in activity with correct status and stain
    await activityPage.searchSlide(e2eData.expectedSlideName);
    await activityPage.expandFirstSlide();
    await activityPage.verifyExpandedSlideDetails();

    // Validate stain usage chart reflects uploaded stain
    await activityPage.verifyStainOverviewRows();
    await activityPage.verifyChartAndQuarter();

    // STEP 5: VALIDATE IN ORGANIZATION REPORTS
    await reportsPage.gotoReportsPage();
    await reportsPage.selectYear(e2eData.reportYear);
    await reportsPage.validateStainChartLoaded();

    // Verify uploaded slide name or stain appears in reports
    await expect(reportsPage.page.getByText(e2eData.stainType)).toBeVisible();

    // Download yearly usage report and validate completion
    await reportsPage.downloadUsageReport();
    await reportsPage.verifyDownloadSuccess();

    //STEP 6: VALIDATE USER REPORT TAB
    await reportsPage.switchToUsersTab();
    await reportsPage.searchUser('pictor');
    await reportsPage.openUserDetails();
    await reportsPage.validateUserReportElements();

    // Network validation
    networkLogger.printLogs();
    networkLogger.saveToFile('network-logs/full-e2e.txt');
  });

  test('should gracefully recover when stain service temporarily unavailable', async ({
    modelsPage,
    uploadsPage,
    activityPage,
  }) => {
    // Simulate model service outage
    await modelsPage.simulateModelOutage();

    await uploadsPage.gotoUploadsPage();
    await uploadsPage.uploadFile(e2eData.validSlidePath);

    // Attempt to stain with unavailable model
    await uploadsPage.selectUnavailableStain();
    await uploadsPage.submitUpload();

    // Validate proper error message
    await expect(uploadsPage.errorToast).toContainText(/Model service not available/i);

    // Ensure upload does not progress incorrectly
    await activityPage.gotoActivityPage();
    await expect(activityPage.page.getByText(/Processing|Completed/)).not.toBeVisible();
  });

  test('should maintain data consistency across Upload → Activity → Reports', async ({
    uploadsPage,
    activityPage,
    reportsPage,
  }) => {
    const slideName = e2eData.expectedSlideName;

    // Validate in Upload History
    await uploadsPage.gotoCompletedTab();
    await uploadsPage.verifyUploadInHistory(slideName);

    // Validate in Activity
    await activityPage.gotoActivityPage();
    await activityPage.searchSlide(slideName);
    await expect(activityPage.page.getByText(slideName)).toBeVisible();

    // Validate in Reports
    await reportsPage.gotoReportsPage();
    await expect(reportsPage.page.getByText(e2eData.stainType)).toBeVisible();
  });

  test('should recover session after token expiry mid-flow', async ({ loginPage, page }) => {
    await loginPage.login(e2eData.validEmail, e2eData.validPassword);
    await loginPage.expireSessionToken();

    // Try accessing restricted page after expiry
    await page.goto('https://f18848f2.prism-app.pages.dev/models');
    await loginPage.refreshAndValidateReauth();
    await expect(loginPage.dashboardTitle).toBeVisible();
  });

  test('should handle concurrent uploads and reflect correctly in activity and reports', async ({
    uploadsPage,
    activityPage,
    reportsPage,
  }) => {
    // Upload multiple slides simultaneously
    await uploadsPage.gotoUploadsPage();
    await uploadsPage.uploadMultipleFiles(e2eData.concurrentSlidePaths);
    await uploadsPage.verifyBatchUploadSuccess();

    // Validate in Activity
    await activityPage.gotoActivityPage();
    for (const file of e2eData.concurrentSlidePaths) {
      const slideName = file.split('/').pop();
      await activityPage.searchSlide(slideName!);
      await expect(activityPage.page.getByText(slideName!)).toBeVisible();
    }

    // Validate stain summary in Reports
    await reportsPage.gotoReportsPage();
    await reportsPage.selectYear(e2eData.reportYear);
    await reportsPage.validateStainChartLoaded();
  });

  test.afterEach(async () => {
    networkLogger.printLogs();
    networkLogger.saveToFile('network-logs/e2e-network.txt');
  });
});
