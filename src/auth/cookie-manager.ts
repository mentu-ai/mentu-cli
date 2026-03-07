/**
 * Cookie Manager
 *
 * Handles cookie storage, loading, and status checking.
 * Cookies are stored in ~/.mentu/cookies/ with domain-based filenames.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  StoredCookie,
  CookieStatus,
  CookieFileMetadata,
  StoredLocalStorageItem,
  AuthStorage,
  AuthStatus,
} from './types.js';

const DEFAULT_COOKIES_DIR = path.join(
  process.env.HOME || '/tmp',
  '.mentu',
  'cookies'
);

export class CookieManager {
  private cookiesDir: string;

  constructor(cookiesDir?: string) {
    this.cookiesDir = cookiesDir || DEFAULT_COOKIES_DIR;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.cookiesDir)) {
      fs.mkdirSync(this.cookiesDir, { recursive: true });
    }
  }

  /**
   * Convert URL or domain to cookie filename
   * mentu.ai → mentu-ai.json
   * www.github.com → github-com.json
   */
  domainToFilename(urlOrDomain: string): string {
    let domain: string;

    try {
      // Try parsing as URL
      const url = new URL(urlOrDomain.includes('://') ? urlOrDomain : `https://${urlOrDomain}`);
      domain = url.hostname;
    } catch {
      domain = urlOrDomain;
    }

    // Remove www. prefix and replace dots with hyphens
    return domain.replace(/^www\./, '').replace(/\./g, '-') + '.json';
  }

  /**
   * Get full path to cookie file for a domain
   */
  getCookiePath(urlOrDomain: string): string {
    return path.join(this.cookiesDir, this.domainToFilename(urlOrDomain));
  }

  /**
   * Load cookies for a domain
   */
  loadCookies(urlOrDomain: string): StoredCookie[] | null {
    const cookiePath = this.getCookiePath(urlOrDomain);

    if (!fs.existsSync(cookiePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cookiePath, 'utf-8');
      return JSON.parse(content) as StoredCookie[];
    } catch {
      return null;
    }
  }

  /**
   * Save cookies for a domain
   */
  saveCookies(urlOrDomain: string, cookies: StoredCookie[]): string {
    const cookiePath = this.getCookiePath(urlOrDomain);
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
    return cookiePath;
  }

  /**
   * Delete cookies for a domain
   */
  deleteCookies(urlOrDomain: string): boolean {
    const cookiePath = this.getCookiePath(urlOrDomain);

    if (fs.existsSync(cookiePath)) {
      fs.unlinkSync(cookiePath);
      return true;
    }

    return false;
  }

  /**
   * Get status of cookies for a domain
   */
  getStatus(urlOrDomain: string): CookieStatus {
    const cookiePath = this.getCookiePath(urlOrDomain);
    const domain = this.domainToFilename(urlOrDomain).replace('.json', '').replace(/-/g, '.');

    if (!fs.existsSync(cookiePath)) {
      return {
        domain,
        exists: false,
        cookieCount: 0,
        path: cookiePath,
        isExpired: true,
        authTokenFound: false,
      };
    }

    try {
      const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8')) as StoredCookie[];
      const stats = fs.statSync(cookiePath);

      // Find earliest expiration among non-session cookies
      const expirations = cookies
        .filter(c => !c.session && c.expires > 0)
        .map(c => c.expires * 1000); // Convert to ms

      const earliestExpiry = expirations.length > 0
        ? Math.min(...expirations)
        : null;

      const now = Date.now();
      const isExpired = earliestExpiry ? earliestExpiry < now : false;

      // Check for common auth token patterns
      const authTokenFound = cookies.some(c =>
        c.name.includes('auth') ||
        c.name.includes('token') ||
        c.name.includes('session') ||
        c.name.includes('sb-') // Supabase tokens
      );

      let timeUntilExpiry: string | undefined;
      if (earliestExpiry && !isExpired) {
        const diff = earliestExpiry - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timeUntilExpiry = `${hours}h ${minutes}m`;
      }

      return {
        domain,
        exists: true,
        cookieCount: cookies.length,
        path: cookiePath,
        captured: stats.mtime.toISOString(),
        expiresAt: earliestExpiry ? new Date(earliestExpiry).toISOString() : undefined,
        isExpired,
        timeUntilExpiry,
        authTokenFound,
      };
    } catch {
      return {
        domain,
        exists: true,
        cookieCount: 0,
        path: cookiePath,
        isExpired: true,
        authTokenFound: false,
      };
    }
  }

  /**
   * List all stored cookie files
   */
  listAll(): CookieFileMetadata[] {
    if (!fs.existsSync(this.cookiesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.cookiesDir)
      .filter(f => f.endsWith('.json'));

    return files.map(file => {
      const filePath = path.join(this.cookiesDir, file);
      const domain = file.replace('.json', '').replace(/-/g, '.');

      try {
        const cookies = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as StoredCookie[];
        const stats = fs.statSync(filePath);

        const expirations = cookies
          .filter(c => !c.session && c.expires > 0)
          .map(c => c.expires * 1000);

        const earliestExpiry = expirations.length > 0
          ? new Date(Math.min(...expirations)).toISOString()
          : undefined;

        return {
          domain,
          path: filePath,
          cookieCount: cookies.length,
          captured: stats.mtime.toISOString(),
          expiresAt: earliestExpiry,
        };
      } catch {
        return {
          domain,
          path: filePath,
          cookieCount: 0,
          captured: 'unknown',
        };
      }
    });
  }

  /**
   * Get localStorage file path for a domain
   */
  getLocalStoragePath(urlOrDomain: string): string {
    const filename = this.domainToFilename(urlOrDomain).replace('.json', '-localStorage.json');
    return path.join(this.cookiesDir, filename);
  }

  /**
   * Save localStorage for a domain
   */
  saveLocalStorage(urlOrDomain: string, items: StoredLocalStorageItem[]): string {
    const storagePath = this.getLocalStoragePath(urlOrDomain);
    fs.writeFileSync(storagePath, JSON.stringify(items, null, 2));
    return storagePath;
  }

  /**
   * Load localStorage for a domain
   */
  loadLocalStorage(urlOrDomain: string): StoredLocalStorageItem[] | null {
    const storagePath = this.getLocalStoragePath(urlOrDomain);

    if (!fs.existsSync(storagePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(storagePath, 'utf-8');
      return JSON.parse(content) as StoredLocalStorageItem[];
    } catch {
      return null;
    }
  }

  /**
   * Save complete auth storage (cookies + localStorage)
   */
  saveAuthStorage(urlOrDomain: string, cookies: StoredCookie[], localStorage: StoredLocalStorageItem[]): {
    cookiePath: string;
    localStoragePath: string;
  } {
    const cookiePath = this.saveCookies(urlOrDomain, cookies);
    const localStoragePath = this.saveLocalStorage(urlOrDomain, localStorage);
    return { cookiePath, localStoragePath };
  }

  /**
   * Get extended auth status including localStorage
   */
  getAuthStatus(urlOrDomain: string): AuthStatus {
    const cookieStatus = this.getStatus(urlOrDomain);
    const localStoragePath = this.getLocalStoragePath(urlOrDomain);
    const localStorage = this.loadLocalStorage(urlOrDomain);
    const localStorageCount = localStorage?.length || 0;

    // Determine auth method
    let authMethod: 'cookie' | 'localStorage' | 'both' | 'none' = 'none';

    const hasCookieAuth = cookieStatus.authTokenFound;
    const hasLocalStorageAuth = localStorage?.some(item =>
      item.key.includes('token') ||
      item.key.includes('auth') ||
      item.key.includes('session') ||
      item.key.includes('supabase') ||
      item.key.includes('sb-')
    ) || false;

    if (hasCookieAuth && hasLocalStorageAuth) {
      authMethod = 'both';
    } else if (hasCookieAuth) {
      authMethod = 'cookie';
    } else if (hasLocalStorageAuth) {
      authMethod = 'localStorage';
    }

    return {
      ...cookieStatus,
      localStorageCount,
      localStoragePath: localStorageCount > 0 ? localStoragePath : undefined,
      authMethod,
    };
  }
}

// Export singleton for convenience
export const cookieManager = new CookieManager();
