/**
 * Remote Login Authentication Module
 *
 * Cookie-based authentication for agent-invocable remote login.
 */

// Types
export type {
  StoredCookie,
  CookieFileMetadata,
  LoginSessionOptions,
  LoginSessionResult,
  CookieStatus,
  LoginSessionState,
} from './types.js';

// Cookie Manager
export { CookieManager, cookieManager } from './cookie-manager.js';

// Login Session
export { LoginSession, runLoginSession } from './login-session.js';
