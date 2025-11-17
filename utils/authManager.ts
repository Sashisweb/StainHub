import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken'; // Optional, helps verify token expiry safely
import { Page } from '@playwright/test';

export class AuthManager {
  private static tokenFile = path.join(__dirname, '../localstorage.json');

  /**
   * Checks whether a valid Auth0 token exists in localstorage.json
   */
  static isTokenValid(): boolean {
    try {
      if (!fs.existsSync(this.tokenFile)) {
        console.log('⚠️ No localstorage.json found');
        return false;
      }

      const raw = fs.readFileSync(this.tokenFile, 'utf-8');
      const data = JSON.parse(raw);

      // Look for Auth0 entries with an expiry
      const authKeys = Object.keys(data).filter((key) =>
        key.startsWith('@@auth0spajs@@')
      );

      if (authKeys.length === 0) {
        console.log('❌ No Auth0-related entries found in localstorage.json');
        return false;
      }

      // Iterate over each stored Auth0 object
      for (const key of authKeys) {
        try {
          const parsed = JSON.parse(data[key]);
          const expiresAt = parsed?.expiresAt;
          const accessToken = parsed?.body?.access_token || parsed?.access_token;

          // ✅ Option 1: If "expiresAt" exists, check timestamp
          if (expiresAt) {
            const nowSec = Date.now() / 1000;
            if (nowSec < expiresAt) {
              console.log(`✅ Token valid for key: ${key}`);
              return true;
            }
          }

          // ✅ Option 2: If JWT present, decode expiry (fallback)
          if (accessToken) {
            const decoded = jwt.decode(accessToken) as { exp?: number } | null;
            if (decoded?.exp && Date.now() / 1000 < decoded.exp) {
              console.log(`✅ JWT still valid for key: ${key}`);
              return true;
            }
          }
        } catch {
          // Skip invalid JSON entries
        }
      }

      console.log('⚠️ All tokens expired or invalid');
      return false;
    } catch (error) {
      console.error('🚨 Error reading token file:', error);
      return false;
    }
  }

  /**
   * Loads Auth0 localStorage tokens into the browser context
   */
  static async loadLocalStorage(page: Page) {
    if (!fs.existsSync(this.tokenFile)) {
      console.log('⚠️ No localstorage.json file found');
      return;
    }

    const raw = fs.readFileSync(this.tokenFile, 'utf-8');
    const data: Record<string, string> = JSON.parse(raw);

    // Use baseURL from config or environment variable
    const baseUrl = process.env.BASE_URL || 'https://f18848f2.prism-app.pages.dev';
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    await page.evaluate((storage: Record<string, string>) => {
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
    }, data);

    console.log('📦 LocalStorage restored into browser');
  }

  /**
   * Save current browser localStorage after successful login
   */
  static async saveLocalStorage(page: Page) {
    const storage = await page.evaluate(() => {
      const store: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) store[key] = localStorage.getItem(key)!;
      }
      return store;
    });

    fs.writeFileSync(this.tokenFile, JSON.stringify(storage, null, 2));
    console.log('💾 LocalStorage saved after login');
  }
}
