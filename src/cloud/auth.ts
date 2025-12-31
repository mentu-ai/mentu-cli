// Authentication Management for Mentu Cloud v0.4

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AuthTokens } from './types.js';

const MENTU_HOME = path.join(os.homedir(), '.mentu');
const CREDENTIALS_FILE = 'credentials';

/**
 * Get the credentials file path.
 */
export function getCredentialsPath(): string {
  return path.join(MENTU_HOME, CREDENTIALS_FILE);
}

/**
 * Ensure ~/.mentu directory exists with proper permissions.
 */
function ensureMentuHome(): void {
  if (!fs.existsSync(MENTU_HOME)) {
    fs.mkdirSync(MENTU_HOME, { recursive: true, mode: 0o700 });
  }
}

/**
 * Read stored credentials data.
 */
function readCredentialsFile(): Record<string, unknown> {
  const credPath = getCredentialsPath();

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

/**
 * Write credentials data to file with secure permissions.
 */
function writeCredentialsFile(data: Record<string, unknown>): void {
  ensureMentuHome();
  const credPath = getCredentialsPath();
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/**
 * Get stored cloud credentials.
 */
export async function getCredentials(): Promise<AuthTokens | null> {
  const data = readCredentialsFile();
  const cloud = data.cloud as AuthTokens | undefined;

  if (!cloud) {
    return null;
  }

  return cloud;
}

/**
 * Save cloud credentials.
 */
export async function saveCredentials(tokens: AuthTokens): Promise<void> {
  const data = readCredentialsFile();
  data.cloud = tokens;
  writeCredentialsFile(data);
}

/**
 * Clear cloud credentials.
 */
export async function clearCredentials(): Promise<void> {
  const data = readCredentialsFile();
  delete data.cloud;
  writeCredentialsFile(data);
}

/**
 * Check if user is logged in.
 */
export async function isLoggedIn(): Promise<boolean> {
  const creds = await getCredentials();
  return creds !== null;
}

/**
 * Check if tokens are expired.
 */
export function isTokenExpired(tokens: AuthTokens): boolean {
  const expiresAt = new Date(tokens.expiresAt);
  const now = new Date();
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Check if tokens will expire soon (within 5 minutes).
 */
export function isTokenExpiringSoon(tokens: AuthTokens): boolean {
  const expiresAt = new Date(tokens.expiresAt);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  return expiresAt.getTime() - now.getTime() < fiveMinutes;
}

/**
 * Refresh token if needed.
 * Returns updated tokens or throws if refresh fails.
 */
export async function refreshTokenIfNeeded(tokens: AuthTokens): Promise<AuthTokens> {
  if (!isTokenExpiringSoon(tokens)) {
    return tokens;
  }

  // Dynamic import to avoid requiring @supabase/supabase-js if not needed
  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: tokens.refreshToken,
  });

  if (error || !data.session) {
    throw new Error('Failed to refresh token. Please run: mentu login');
  }

  const newTokens: AuthTokens = {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token!,
    expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
    userId: data.user!.id,
    email: data.user!.email!,
  };

  await saveCredentials(newTokens);
  return newTokens;
}

/**
 * Get valid credentials, refreshing if needed.
 * Returns null if not logged in.
 */
export async function getValidCredentials(): Promise<AuthTokens | null> {
  const creds = await getCredentials();

  if (!creds) {
    return null;
  }

  try {
    return await refreshTokenIfNeeded(creds);
  } catch {
    // Token refresh failed, credentials are invalid
    return null;
  }
}

// Default Supabase configuration for Mentu Cloud
const DEFAULT_SUPABASE_URL = 'https://nwhtjzgcbjuewuhapjua.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = '<JWT_REDACTED>';

/**
 * Get Supabase URL (from environment or default).
 */
export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

/**
 * Get Supabase anon key (from environment or default).
 */
export function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
}
