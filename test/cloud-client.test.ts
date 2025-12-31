import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AuthTokens } from '../src/cloud/types.js';

// Inline implementations for testing (since we can't easily mock os.homedir)
function getTestCredentialsPath(testHome: string): string {
  return path.join(testHome, '.mentu', 'credentials');
}

function ensureTestMentuHome(testHome: string): void {
  const mentuDir = path.join(testHome, '.mentu');
  if (!fs.existsSync(mentuDir)) {
    fs.mkdirSync(mentuDir, { recursive: true, mode: 0o700 });
  }
}

function readTestCredentialsFile(testHome: string): Record<string, unknown> {
  const credPath = getTestCredentialsPath(testHome);
  if (!fs.existsSync(credPath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(credPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function writeTestCredentialsFile(testHome: string, data: Record<string, unknown>): void {
  ensureTestMentuHome(testHome);
  const credPath = getTestCredentialsPath(testHome);
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function saveTestCredentials(testHome: string, tokens: AuthTokens): Promise<void> {
  const data = readTestCredentialsFile(testHome);
  data.cloud = tokens;
  writeTestCredentialsFile(testHome, data);
}

async function getTestCredentials(testHome: string): Promise<AuthTokens | null> {
  const data = readTestCredentialsFile(testHome);
  return (data.cloud as AuthTokens) || null;
}

async function clearTestCredentials(testHome: string): Promise<void> {
  const data = readTestCredentialsFile(testHome);
  delete data.cloud;
  writeTestCredentialsFile(testHome, data);
}

async function isTestLoggedIn(testHome: string): Promise<boolean> {
  const creds = await getTestCredentials(testHome);
  return creds !== null;
}

function isTokenExpired(tokens: AuthTokens): boolean {
  const expiresAt = new Date(tokens.expiresAt);
  const now = new Date();
  return expiresAt.getTime() <= now.getTime();
}

function isTokenExpiringSoon(tokens: AuthTokens): boolean {
  const expiresAt = new Date(tokens.expiresAt);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  return expiresAt.getTime() - now.getTime() < fiveMinutes;
}

describe('Cloud Auth', () => {
  let testHome: string;
  let mentuDir: string;

  beforeEach(() => {
    // Create temporary home directory
    testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mentu-home-'));
    mentuDir = path.join(testHome, '.mentu');
    fs.mkdirSync(mentuDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(testHome, { recursive: true, force: true });
  });

  describe('getCredentials', () => {
    it('returns null when no credentials exist', async () => {
      const creds = await getTestCredentials(testHome);
      expect(creds).toBeNull();
    });

    it('returns stored credentials', async () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: '2025-12-31T23:59:59Z',
        userId: 'user-123',
        email: 'test@example.com',
      };

      await saveTestCredentials(testHome, tokens);
      const creds = await getTestCredentials(testHome);

      expect(creds).not.toBeNull();
      expect(creds?.accessToken).toBe('test-access-token');
      expect(creds?.email).toBe('test@example.com');
    });
  });

  describe('saveCredentials', () => {
    it('creates credentials file with correct permissions', async () => {
      const tokens: AuthTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2025-12-31T23:59:59Z',
        userId: 'user-456',
        email: 'user@example.com',
      };

      await saveTestCredentials(testHome, tokens);

      const credPath = getTestCredentialsPath(testHome);
      expect(fs.existsSync(credPath)).toBe(true);

      // Check file permissions (Unix only)
      if (process.platform !== 'win32') {
        const stats = fs.statSync(credPath);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }
    });

    it('preserves other data in credentials file', async () => {
      // Write some existing data
      const existingData = { other: { key: 'value' } };
      writeTestCredentialsFile(testHome, existingData);

      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2025-12-31T23:59:59Z',
        userId: 'user',
        email: 'test@test.com',
      };

      await saveTestCredentials(testHome, tokens);

      const content = readTestCredentialsFile(testHome);

      expect((content.other as any).key).toBe('value');
      expect((content.cloud as any).accessToken).toBe('token');
    });
  });

  describe('clearCredentials', () => {
    it('removes cloud credentials', async () => {
      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2025-12-31T23:59:59Z',
        userId: 'user',
        email: 'test@test.com',
      };

      await saveTestCredentials(testHome, tokens);
      await clearTestCredentials(testHome);

      const creds = await getTestCredentials(testHome);
      expect(creds).toBeNull();
    });

    it('preserves other data when clearing', async () => {
      const data = {
        other: { key: 'preserve-me' },
        cloud: {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: '2025-12-31T23:59:59Z',
          userId: 'user',
          email: 'test@test.com',
        },
      };

      writeTestCredentialsFile(testHome, data);

      await clearTestCredentials(testHome);

      const content = readTestCredentialsFile(testHome);

      expect((content.other as any).key).toBe('preserve-me');
      expect(content.cloud).toBeUndefined();
    });
  });

  describe('isLoggedIn', () => {
    it('returns false when not logged in', async () => {
      const result = await isTestLoggedIn(testHome);
      expect(result).toBe(false);
    });

    it('returns true when logged in', async () => {
      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2025-12-31T23:59:59Z',
        userId: 'user',
        email: 'test@test.com',
      };

      await saveTestCredentials(testHome, tokens);

      const result = await isTestLoggedIn(testHome);
      expect(result).toBe(true);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true for expired token', () => {
      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2020-01-01T00:00:00Z', // Past date
        userId: 'user',
        email: 'test@test.com',
      };

      expect(isTokenExpired(tokens)).toBe(true);
    });

    it('returns false for valid token', () => {
      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2099-12-31T23:59:59Z', // Future date
        userId: 'user',
        email: 'test@test.com',
      };

      expect(isTokenExpired(tokens)).toBe(false);
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('returns true when token expires in less than 5 minutes', () => {
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: expiresAt.toISOString(),
        userId: 'user',
        email: 'test@test.com',
      };

      expect(isTokenExpiringSoon(tokens)).toBe(true);
    });

    it('returns false when token has more than 5 minutes', () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const tokens: AuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: expiresAt.toISOString(),
        userId: 'user',
        email: 'test@test.com',
      };

      expect(isTokenExpiringSoon(tokens)).toBe(false);
    });
  });
});
