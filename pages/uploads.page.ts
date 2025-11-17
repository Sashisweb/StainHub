import { Page, Locator, expect } from '@playwright/test';

export class UploadsPage {
  readonly page: Page;

  // ---------- Locators ----------
  pageHeader: Locator;
  uploadTabs: Locator;
  uploadTab: Locator;
  inProgressTab: Locator;
  completedTab: Locator;
  uploadGuidelines: Locator;
  fileDropArea: Locator;
  fileInput: Locator;
  uploadButton: Locator;
  uploadProgress: Locator;
  uploadStatus: Locator;
  failedUploadStatus: Locator;
  completedSection: Locator;
  uploadedFileCard: Locator;
  fileSize: Locator;
  lastUpdated: Locator;
  maxFileError: Locator;
  invalidFormatError: Locator;
  errorToast: Locator;

  constructor(page: Page) {
    this.page = page;

    // General structure
    this.pageHeader = page.getByRole('heading', { name: /Slide Upload Dashboard/i });
    this.uploadTabs = page.getByRole('tablist');
    this.uploadTab = page.getByRole('tab', { name: /^Upload$/i });
    this.inProgressTab = page.getByRole('tab', { name: /In Progress/i });
    this.completedTab = page.getByRole('tab', { name: /Completed/i });
    this.uploadGuidelines = page.getByText(/Upload Guidelines/i);

    // Upload controls
    this.fileDropArea = page.getByText(/Choose files or drag and drop/i);
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.getByRole('button', { name: /^Upload$/i });

    // Status elements
    this.uploadProgress = page.locator('text=/Uploading|Processing/i');
    this.uploadStatus = page.locator('text=/Upload completed/i');
    this.failedUploadStatus = page.locator('text=/Upload failed|Processing error/i');
    this.completedSection = page.getByRole('region', { name: /Slide Upload History/i });
    this.uploadedFileCard = page.locator('.MuiBox-root:has-text("Upload completed")');

    // Metadata and validation
    this.fileSize = page.getByText(/MB|GB/i);
    this.lastUpdated = page.getByText(/Updated At/i);
    this.maxFileError = page.getByText(/File exceeds maximum allowed size/i);
    this.invalidFormatError = page.getByText(/Invalid file format/i);

    this.errorToast = page.locator(
      '.Toastify__toast--error, .MuiSnackbar-root .MuiAlert-message, .error-message, .toast-error'
    );
  }

  // ---------- Navigation ----------
  async gotoUploadsPage(): Promise<void> {
    await this.page.getByRole('button', { name: /Uploads/i }).click();
    await expect(this.page).toHaveURL(/uploads/);
    await expect(this.pageHeader).toBeVisible();
  }

  // ---------- Page Structure ----------
  async verifyUploadPageStructure(): Promise<void> {
    await expect(this.pageHeader).toBeVisible();
    await expect(this.uploadTabs).toBeVisible();
    await expect(this.uploadTab).toBeVisible();
    await expect(this.inProgressTab).toBeVisible();
    await expect(this.completedTab).toBeVisible();
    await expect(this.uploadGuidelines).toBeVisible();
    await expect(this.fileDropArea).toBeVisible();
    await expect(this.uploadButton).toBeVisible();
  }

  // ---------- Upload Actions ----------
  async uploadFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
    await expect(this.uploadProgress).toBeVisible({ timeout: 30000 });
    await expect(this.uploadStatus).toHaveText(/Upload completed/i, { timeout: 300000 }); // 5 minutes
  }

  async uploadInvalidFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
    await expect(this.invalidFormatError).toBeVisible({ timeout: 10000 });
  }

  async uploadTooLargeFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
    await expect(this.maxFileError).toBeVisible({ timeout: 10000 });
  }

  async clickUploadWithoutFile(): Promise<void> {
    await this.uploadButton.click();
    await expect(this.uploadProgress).not.toBeVisible();
  }

  async uploadMultipleFiles(filePaths: string[]): Promise<void> {
    await this.fileInput.setInputFiles(filePaths);
    await this.uploadButton.click();
    await expect(this.uploadProgress).toBeVisible();
  }

  // ---------- Tab Navigation ----------
  async navigateToTab(tab: 'Upload' | 'In Progress' | 'Completed'): Promise<void> {
    if (tab === 'Upload') await this.uploadTab.click();
    else if (tab === 'In Progress') await this.inProgressTab.click();
    else await this.completedTab.click();
  }

  // ---------- Verification ----------
  async verifyUploadedFileDetails(fileName: string): Promise<void> {
    const fileCard = this.page.getByText(fileName, { exact: false });
    await expect(fileCard).toBeVisible({ timeout: 30000 });
    await expect(this.uploadStatus).toHaveText(/Upload completed/i);
    await expect(this.fileSize).toBeVisible();
    await expect(this.lastUpdated).toBeVisible();
  }

  async verifyUploadFailure(fileName: string): Promise<void> {
    const fileCard = this.page.getByText(fileName, { exact: false });
    await expect(fileCard).toBeVisible();
    await expect(this.failedUploadStatus).toHaveText(/failed/i);
  }

  async selectStainType(stainType: string): Promise<void> {
    await this.page.getByRole('combobox').selectOption(stainType);
  }

  async enableAutorun(): Promise<void> {
    await this.page.getByRole('checkbox').check();
  }

  async submitUpload(): Promise<void> {
    await this.uploadButton.click();
  }

  async verifyProcessingStarted(): Promise<void> {
    await expect(this.uploadProgress).toBeVisible({ timeout: 30000 });
  }

  async waitForUploadCompletion(expectedSlideName: string): Promise<void> {
    await expect(this.page.getByText(expectedSlideName)).toBeVisible({ timeout: 300000 }); // 5 minutes
  }

  async verifyUploadSuccess(): Promise<void> {
    await expect(this.uploadStatus).toHaveText(/Upload completed/i);
  }

  async verifyUploadProgress(): Promise<void> {
    await expect(this.uploadProgress).toBeVisible({ timeout: 30000 });
  }


  async selectUnavailableStain(): Promise<void> {
    console.log('🔹 Selecting unavailable stain model for upload...');
    const stainDropdown = this.page.getByRole('combobox', { name: /stain/i });
    await stainDropdown.click();
    await this.page.getByText(/Unavailable Stain/i, { exact: false }).click();
  }
  
  async gotoCompletedTab(): Promise<void> {
    console.log('📂 Navigating to Completed uploads tab...');
    const completedTab = this.page.getByRole('tab', { name: /Completed/i });
    await completedTab.click();
    await expect(completedTab).toHaveAttribute('aria-selected', 'true');
    await this.page.waitForLoadState('networkidle');
  }

  async verifyUploadInHistory(fileName: string): Promise<void> {
    console.log(`🔍 Verifying upload history for ${fileName}`);
    const uploadedFileRow = this.page.locator(`text=${fileName}`);
    await expect(uploadedFileRow).toBeVisible({ timeout: 15000 });
    await expect(uploadedFileRow).toHaveText(fileName);
    console.log(`✅ Upload history contains: ${fileName}`);
  }

  async verifyBatchUploadSuccess(): Promise<void> {
    console.log('🧩 Verifying batch uploads success...');
    const successBadge = this.page.locator('text=Upload completed, Upload successful').first();
    const rows = this.page.locator('.upload-row, .MuiTableBody-root tr');
    await expect(rows.first()).toBeVisible();
    await expect(successBadge.or(rows)).toBeVisible();
    console.log('✅ Batch upload success verified');
  }

}
