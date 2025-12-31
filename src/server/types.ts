import { createHash } from 'crypto';

// API Key type (stored form - key is hashed)
export interface ApiKeyStored {
  id: string;
  name: string;
  key_hash: string; // sha256:xxxxxxxx (hashed, not plain text)
  key_prefix: string; // First 8 chars for identification
  actor: string; // Actor identity for this key
  permissions: ('read' | 'write')[];
  created: string;
}

// Hash function for API key verification
export function hashApiKey(key: string): string {
  return 'sha256:' + createHash('sha256').update(key).digest('hex');
}

// Request context (runtime)
export interface RequestContext {
  apiKey: ApiKeyStored;
  actor: string; // Always from API key, never from request
  workspacePath: string;
}

// Pagination params
export interface PaginationParams {
  limit: number;
  offset: number;
}

// Query filter params for memories
export interface MemoryQueryParams extends PaginationParams {
  kind?: string;
  tags?: string[];
  since?: string;
}

// Query filter params for commitments
export interface CommitmentQueryParams extends PaginationParams {
  state?: 'open' | 'claimed' | 'in_review' | 'reopened' | 'closed';
  owner?: string;
  tags?: string[];
  since?: string;
}

// Query filter params for ledger
export interface LedgerQueryParams extends PaginationParams {
  since?: string;
  op?: string;
  actor?: string;
}

// WebSocket subscription
export interface Subscription {
  id: string;
  filters: {
    ops?: string[];
    actors?: string[];
    commitments?: string[];
    memories?: string[];
  };
}

// WebSocket message types
export interface AuthMessage {
  action: 'auth';
  token: string;
}

export interface SubscribeMessage {
  action: 'subscribe';
  filters?: Subscription['filters'];
}

export type ClientMessage = AuthMessage | SubscribeMessage;

export interface AuthenticatedEvent {
  event: 'authenticated';
  actor: string;
}

export interface SubscribedEvent {
  event: 'subscribed';
  filters: Subscription['filters'];
}

export interface OperationEvent {
  event: 'operation';
  data: unknown;
}

export interface ErrorEvent {
  event: 'error';
  error: string;
  message: string;
}

export type ServerEvent = AuthenticatedEvent | SubscribedEvent | OperationEvent | ErrorEvent;
