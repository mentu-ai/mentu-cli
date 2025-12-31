// Cloud Sync Types for Mentu v0.4

import type { Operation } from '../types.js';

// Cloud configuration stored in .mentu/config.yaml
export interface CloudConfig {
  enabled: boolean;
  endpoint: string;        // https://nwhtjzgcbjuewuhapjua.supabase.co
  workspace_id: string;    // UUID from cloud
}

// Stored in ~/.mentu/credentials
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;       // ISO timestamp
  userId: string;          // Supabase user ID
  email: string;
}

// Stored in .mentu/sync-state.json
export interface SyncState {
  workspaceId: string;
  clientId: string;        // Unique per device, e.g., "macbook-pro-abc123"
  lastSyncedCursor: string | null;  // Last synced operation ID
  lastSyncAt: string | null;        // ISO timestamp
  pendingOperations: number;
  status: SyncStatus;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline' | 'error';

// Push request to cloud
export interface SyncPushRequest {
  workspace_id: string;
  client_id: string;
  operations: Operation[];
  cursor: string | null;   // Last known synced cursor
}

// Push response from cloud
export interface SyncPushResponse {
  accepted: string[];      // Operation IDs that were stored
  rejected: string[];      // Operation IDs that failed
  warnings: string[];      // Human-readable warnings
  new_cursor: string;      // New cursor position
}

// Pull request to cloud
export interface SyncPullRequest {
  workspace_id: string;
  client_id: string;
  cursor: string | null;   // Get operations after this
  limit?: number;          // Max operations to return
}

// Pull response from cloud
export interface SyncPullResponse {
  operations: Operation[];
  new_cursor: string;
  has_more: boolean;
}

// Workspace info
export interface Workspace {
  id: string;
  name: string;            // Unique slug, e.g., "mentu-ai"
  displayName: string | null;
  createdAt: string;
  createdBy: string;
  role: WorkspaceRole;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';

// Workspace member
export interface WorkspaceMember {
  userId: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

// Invite
export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email?: string;          // If email invite
  token?: string;          // If link invite
  role: 'admin' | 'member';
  expiresAt: string;
  createdBy: string;
}

// Sync result types for CLI output
export interface SyncPushResult {
  pushed: number;
  accepted: string[];
  rejected: string[];
  warnings: string[];
  newCursor: string;
}

export interface SyncPullResult {
  pulled: number;
  operations: Operation[];
  newCursor: string;
  hasMore: boolean;
}

// Cloud API error response
export interface CloudError {
  error: string;
  message?: string;
  code?: string;
}

// Sync status response
export interface SyncStatusResponse {
  workspace_id: string;
  client_id: string;
  local_cursor: string | null;
  cloud_cursor: string | null;
  pending_push: number;
  pending_pull: number;
  last_sync: string | null;
}
