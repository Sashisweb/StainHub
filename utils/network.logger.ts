import fs from 'fs';
import { Page, Request, Response } from '@playwright/test';

export type NetworkCaptureType = 'request' | 'response' | 'all';

export class NetworkLogger {
  private logs: string[] = [];
  private filterPattern?: string;
  private page: Page;
  private captureType: NetworkCaptureType;

  constructor(page: Page, captureType: NetworkCaptureType = 'all', filterPattern?: string) {
    this.page = page;
    this.captureType = captureType;
    this.filterPattern = filterPattern;
  }

  async startLogging(): Promise<void> {
    // Capture requests
    if (this.captureType === 'request' || this.captureType === 'all') {
      this.page.on('request', (request: Request) => {       // ✅ Type added here
        const url = request.url();
        if (this.filterPattern && !url.includes(this.filterPattern)) return;
        const method = request.method();
        this.logs.push(`➡️ [${method}] ${url}`);
      });
    }

    // Capture responses
    if (this.captureType === 'response' || this.captureType === 'all') {
      this.page.on('response', async (response: Response) => {   // ✅ Type added here
        const url = response.url();
        if (this.filterPattern && !url.includes(this.filterPattern)) return;

        const req = response.request();
        const status = response.status();
        this.logs.push(`[${req.method()}] ${url} — ${status}`);

        if (url.includes('/slides')) {
          try {
            const body = await response.text();
            console.log(`API Response for ${url}:\n${body}`);
          } catch {
            console.log(`Could not read response body for ${url}`);
          }
        }
      });
    }
  }

  printLogs(): void {
    console.log('\n--- Network Logs ---');
    this.logs.forEach((log) => console.log(log));
  }

  saveToFile(filePath = 'network-logs.txt'): void {
    fs.writeFileSync(filePath, this.logs.join('\n'), 'utf-8');
    console.log(`📁 Network logs saved to ${filePath}`);
  }

  clearLogs(): void {
    this.logs = [];
  }
}
