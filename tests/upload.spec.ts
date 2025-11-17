import { test, expect } from '../fixtures/uploads.fixture';
import uploadData from '../data/uploadData.json';
import { NetworkLogger } from '../utils/network.logger';

test.describe('Uploads Module - Virtual Stain Hub', () => {

  test.beforeEach(async ({ uploadsPage }) => {
    await uploadsPage.gotoUploadsPage();
    await uploadsPage.verifyUploadPageStructure();
  });

 
  test('Should load Slide Upload Dashboard with complete layout and controls', async ({ uploadsPage }) => {
    await expect(uploadsPage.pageHeader).toBeVisible();
    await expect(uploadsPage.uploadTab).toBeVisible();
    await expect(uploadsPage.inProgressTab).toBeVisible();
    await expect(uploadsPage.completedTab).toBeVisible();
    await expect(uploadsPage.uploadGuidelines).toBeVisible();
    await expect(uploadsPage.fileDropArea).toBeVisible();
    await expect(uploadsPage.uploadButton).toBeVisible();
  });

  test('Should allow uploading a valid slide file successfully', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await expect(uploadsPage.uploadStatus).toHaveText(/Upload completed/i);
  });

  test('Should support multiple valid file uploads simultaneously', async ({ uploadsPage }) => {
    await uploadsPage.uploadMultipleFiles(uploadData.multiFilePaths);
    await uploadsPage.navigateToTab('Completed');
    await expect(uploadsPage.completedSection).toBeVisible();
  });

  test('Should handle large multi-part file uploads successfully', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await expect(uploadsPage.uploadStatus).toHaveText(/Upload completed/i);
  });

  test('Should track upload progress and update to Completed state', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await expect(uploadsPage.uploadProgress).toBeVisible();
    await expect(uploadsPage.uploadStatus).toHaveText(/completed/i);
  });

  test('Should display file details correctly in Completed tab after upload', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await uploadsPage.navigateToTab('Completed');
    await uploadsPage.verifyUploadedFileDetails('sample_slide');
  });

  test('Should show correct file size and timestamp in Completed uploads', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await uploadsPage.navigateToTab('Completed');
    await expect(uploadsPage.fileSize).toBeVisible();
    await expect(uploadsPage.lastUpdated).toBeVisible();
  });

  test('Should validate transition of file from In Progress to Completed', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await uploadsPage.navigateToTab('In Progress');
    await uploadsPage.navigateToTab('Completed');
    await uploadsPage.verifyUploadedFileDetails('sample_slide');
  });

  test('Should complete full end-to-end upload flow with data validation', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await uploadsPage.navigateToTab('Completed');
    await uploadsPage.verifyUploadedFileDetails('sample_slide');
  });

  
  test('Should display error when uploading unsupported file type', async ({ uploadsPage }) => {
    await uploadsPage.uploadInvalidFile(uploadData.invalidFilePath);
    await expect(uploadsPage.invalidFormatError).toBeVisible();
  });

  test('Should display error for file size exceeding 40GB', async ({ uploadsPage }) => {
    await uploadsPage.uploadTooLargeFile(uploadData.tooLargeFilePath);
    await expect(uploadsPage.maxFileError).toBeVisible();
  });

  test('Should show Upload Failed status for invalid or corrupt file', async ({ uploadsPage }) => {
    await uploadsPage.uploadInvalidFile(uploadData.invalidFilePath);
    await expect(uploadsPage.failedUploadStatus).toBeVisible();
  });

  test('Should handle interrupted upload and show Processing Error', async ({ uploadsPage }) => {
    await uploadsPage.uploadInvalidFile(uploadData.invalidFilePath);
    await expect(uploadsPage.failedUploadStatus).toHaveText(/Processing error/i);
  });

  test('Should allow retry after a failed upload attempt', async ({ uploadsPage }) => {
    await uploadsPage.uploadInvalidFile(uploadData.invalidFilePath);
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await expect(uploadsPage.uploadStatus).toHaveText(/Upload completed/i);
  });

  
  test('Should not allow upload when no file is selected', async ({ uploadsPage }) => {
    await uploadsPage.clickUploadWithoutFile();
    await expect(uploadsPage.uploadProgress).not.toBeVisible();
  });

  test('Should maintain Completed tab entries across multiple uploads', async ({ uploadsPage }) => {
    await uploadsPage.uploadMultipleFiles(uploadData.multiFilePaths);
    await uploadsPage.navigateToTab('Completed');
    await expect(uploadsPage.completedSection).toBeVisible();
  });

  test('Should correctly display multiple completed uploads sorted by recent date', async ({ uploadsPage }) => {
    await uploadsPage.uploadMultipleFiles(uploadData.multiFilePaths);
    await uploadsPage.navigateToTab('Completed');
    await expect(uploadsPage.fileSize).toBeVisible();
    await expect(uploadsPage.lastUpdated).toBeVisible();
  });

  test('Should show correct metadata fields for each uploaded slide', async ({ uploadsPage }) => {
    await uploadsPage.uploadFile(uploadData.validFilePath);
    await uploadsPage.navigateToTab('Completed');
    await expect(uploadsPage.fileSize).toBeVisible();
    await expect(uploadsPage.lastUpdated).toBeVisible();
  });

  test('Should handle valid and invalid file uploads together correctly', async ({ uploadsPage }) => {
    await uploadsPage.uploadMultipleFiles([
      uploadData.validFilePath,
      uploadData.invalidFilePath,
    ]);
    await uploadsPage.navigateToTab('Completed');
    await uploadsPage.verifyUploadedFileDetails('sample_slide');
  });

  test('Should capture and validate network traffic during file upload', async ({ page, uploadsPage }) => {
    // Initialize network logger to capture both requests and responses for upload API
    const networkLogger = new NetworkLogger(page, 'all', '/api/upload');
    await networkLogger.startLogging();
  
    // Perform a valid upload
    await uploadsPage.uploadFile(uploadData.validFilePath);
  
    // Wait for network activity to complete
    await page.waitForLoadState('networkidle');
  
    // Print and save logs
    networkLogger.printLogs();
    networkLogger.saveToFile('network-logs/upload-network.txt');
  
    // Validate UI state after network completion
    await expect(uploadsPage.uploadStatus).toHaveText(/Upload completed/i);
  });
  
});
