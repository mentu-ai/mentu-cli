/**
 * Mentu API Client
 *
 * Fetch wrapper for the Mentu proxy API.
 * Reads config from env vars or .mentu.json in project root.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  MentuConfig,
  OpRequest,
  OpResponse,
  MemoriesListResponse,
  CommitmentsListResponse,
  StatusResponse,
  Memory,
  Commitment,
  ApiError,
} from './types.js';

let cachedConfig: MentuConfig | null = null;

/**
 * Resolve Mentu configuration from env vars, falling back to .mentu.json.
 */
export function resolveConfig(): MentuConfig {
  if (cachedConfig) return cachedConfig;

  const apiUrl =
    process.env.MENTU_API_URL ||
    process.env.VITE_MENTU_API_URL ||
    '';
  const apiToken =
    process.env.MENTU_API_TOKEN ||
    process.env.VITE_MENTU_API_TOKEN ||
    '';
  const workspaceId =
    process.env.MENTU_WORKSPACE_ID ||
    process.env.VITE_MENTU_WORKSPACE_ID ||
    '';

  // If all env vars are present, use them
  if (apiUrl && apiToken && workspaceId) {
    cachedConfig = { apiUrl, apiToken, workspaceId };
    return cachedConfig;
  }

  // Try .mentu.json in cwd
  try {
    const raw = readFileSync(join(process.cwd(), '.mentu.json'), 'utf-8');
    const json = JSON.parse(raw) as Partial<MentuConfig>;
    cachedConfig = {
      apiUrl: apiUrl || json.apiUrl || 'https://mentu-proxy.affihub.workers.dev',
      apiToken: apiToken || json.apiToken || '',
      workspaceId: workspaceId || json.workspaceId || '',
      projectDomains: json.projectDomains,
    };
    return cachedConfig;
  } catch {
    // No .mentu.json found
  }

  cachedConfig = {
    apiUrl: apiUrl || 'https://mentu-proxy.affihub.workers.dev',
    apiToken,
    workspaceId,
  };
  return cachedConfig;
}

/**
 * Reset cached config (useful for testing).
 */
export function resetConfig(): void {
  cachedConfig = null;
}

class MentuApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MentuApiError';
  }
}

/**
 * Make an authenticated request to the Mentu proxy API.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const config = resolveConfig();

  if (!config.apiToken) {
    throw new MentuApiError(401, 'E_NO_TOKEN', 'MENTU_API_TOKEN not configured. Set it in env vars or .mentu.json');
  }
  if (!config.workspaceId) {
    throw new MentuApiError(400, 'E_NO_WORKSPACE', 'MENTU_WORKSPACE_ID not configured. Set it in env vars or .mentu.json');
  }

  const url = `${config.apiUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Proxy-Token': config.apiToken,
    'X-Workspace-Id': config.workspaceId,
  };

  const init: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new MentuApiError(res.status, 'E_PARSE', `Failed to parse response: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err = data as unknown as ApiError;
    throw new MentuApiError(res.status, err.error || 'E_UNKNOWN', err.message || `HTTP ${res.status}`);
  }

  return data;
}

// --- Operations ---

export async function postOp(payload: OpRequest): Promise<OpResponse> {
  return request<OpResponse>('POST', '/ops', payload);
}

// --- Memories ---

export async function listMemories(params?: {
  limit?: number;
  offset?: number;
  kind?: string;
  since?: string;
}): Promise<MemoriesListResponse> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.kind) qs.set('kind', params.kind);
  if (params?.since) qs.set('since', params.since);
  const query = qs.toString();
  return request<MemoriesListResponse>('GET', `/memories${query ? `?${query}` : ''}`);
}

export async function getMemory(id: string): Promise<Memory> {
  return request<Memory>('GET', `/memories/${id}`);
}

// --- Commitments ---

export async function listCommitments(params?: {
  limit?: number;
  offset?: number;
  state?: string;
  owner?: string;
  tags?: string;
  since?: string;
}): Promise<CommitmentsListResponse> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.state) qs.set('state', params.state);
  if (params?.owner) qs.set('owner', params.owner);
  if (params?.tags) qs.set('tags', params.tags);
  if (params?.since) qs.set('since', params.since);
  const query = qs.toString();
  return request<CommitmentsListResponse>('GET', `/commitments${query ? `?${query}` : ''}`);
}

export async function getCommitment(id: string): Promise<Commitment> {
  return request<Commitment>('GET', `/commitments/${id}`);
}

// --- Status ---

export async function getStatus(): Promise<StatusResponse> {
  return request<StatusResponse>('GET', '/status');
}
