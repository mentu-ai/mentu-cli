/**
 * Remote Login Authentication Types
 *
 * Types for cookie and localStorage-based authentication management.
 */

// Cookie as stored by Puppeteer
export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  priority?: 'Low' | 'Medium' | 'High';
  sameParty?: boolean;
  sourceScheme?: 'Secure' | 'NonSecure';
}

// Metadata about a cookie file
export interface CookieFileMetadata {
  domain: string;
  path: string;
  cookieCount: number;
  captured: string;
  expiresAt?: string;
}

// Options for starting a login session
export interface LoginSessionOptions {
  target: string;
  timeout?: number;       // Default: 300000 (5 min)
  autoSaveDelay?: number; // Auto-save after idle (ms), 0 = disabled
  loadExisting?: boolean; // Pre-load existing cookies
  cookiesDir?: string;    // Override default cookies directory
}

// Result of a login session
export interface LoginSessionResult {
  success: boolean;
  domain: string;
  cookieCount: number;
  cookiePath: string;
  expiresAt?: string;
  error?: string;
}

// Cookie status for a domain
export interface CookieStatus {
  domain: string;
  exists: boolean;
  cookieCount: number;
  path: string;
  captured?: string;
  expiresAt?: string;
  isExpired: boolean;
  timeUntilExpiry?: string;
  authTokenFound: boolean;
}

// Login session state
export type LoginSessionState =
  | 'idle'
  | 'waiting'
  | 'authenticating'
  | 'capturing'
  | 'success'
  | 'failed'
  | 'timeout';

// localStorage item
export interface StoredLocalStorageItem {
  key: string;
  value: string;
}

// Complete auth storage (cookies + localStorage)
export interface AuthStorage {
  domain: string;
  captured: string;
  cookies: StoredCookie[];
  localStorage: StoredLocalStorageItem[];
  sessionStorage?: StoredLocalStorageItem[]; // Optional, rarely useful
}

// Extended result with localStorage
export interface LoginSessionResultExtended extends LoginSessionResult {
  localStorageCount: number;
  localStoragePath?: string;
  authMethod: 'cookie' | 'localStorage' | 'both' | 'none';
}

// Auth status including localStorage
export interface AuthStatus extends CookieStatus {
  localStorageCount: number;
  localStoragePath?: string;
  authMethod: 'cookie' | 'localStorage' | 'both' | 'none';
}
