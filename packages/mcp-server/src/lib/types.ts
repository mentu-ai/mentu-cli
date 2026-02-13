/**
 * Mentu MCP Server — Core Types
 *
 * These mirror the Mentu protocol types but are self-contained
 * (no dependency on the main mentu package).
 */

// Operation types supported by the proxy API
export type OperationType =
  | 'capture' | 'commit' | 'claim' | 'release' | 'close'
  | 'annotate' | 'link' | 'dismiss' | 'triage'
  | 'submit' | 'approve' | 'reopen' | 'cancel';

// Commitment lifecycle states
export type CommitmentState =
  | 'open'
  | 'claimed'
  | 'in_review'
  | 'closed'
  | 'reopened';

// Memory triage states
export type MemoryState = 'untriaged' | 'linked' | 'dismissed' | 'committed';

// Link relationship types
export type LinkKind = 'related' | 'duplicate' | 'caused_by' | 'blocks' | 'evidence';

// --- API request payloads ---

export interface OpRequest {
  op: OperationType;
  body?: string;
  source?: string;
  commitment?: string;
  evidence?: string | string[];
  target?: string;
  tags?: string[];
  kind?: string;
  source_key?: string;
  meta?: Record<string, unknown>;
  reason?: string;
  duplicate_of?: string;
  refs?: string[];
  memory?: string;
  reviewed?: string[];
  summary?: string;
  decisions?: TriageDecision[];
  validation?: Record<string, { passed: boolean; details?: string }>;
  tier?: string;
  comment?: string;
  auto?: boolean;
  from_state?: 'in_review' | 'closed';
}

export interface TriageDecision {
  memory: string;
  action: 'create' | 'link' | 'dismiss' | 'defer';
  target?: string;
  reason?: string;
}

// --- API response types ---

export interface OpResponse {
  id: string;
  op: OperationType;
  ts: string;
  actor: string;
  [key: string]: unknown;
}

export interface Memory {
  id: string;
  body: string;
  ts: string;
  actor: string;
  kind: string | null;
  refs?: string[];
  meta?: Record<string, unknown>;
  annotations: Annotation[];
  commitments?: string[];
  triage_state?: MemoryState;
}

export interface Commitment {
  id: string;
  body: string;
  source: string;
  state: CommitmentState;
  owner: string | null;
  created_at: string;
  created_by: string;
  closed_at?: string | null;
  closed_by?: string | null;
  evidence?: string | null;
  tags: string[];
  annotations?: Annotation[];
  history?: HistoryEntry[];
}

export interface Annotation {
  id: string;
  body: string;
  kind?: string;
  actor: string;
  ts: string;
}

export interface HistoryEntry {
  op: string;
  ts: string;
  actor: string;
}

export interface MemoriesListResponse {
  memories: Memory[];
  total: number;
  limit: number;
  offset: number;
}

export interface CommitmentsListResponse {
  commitments: Commitment[];
  total: number;
  limit: number;
  offset: number;
}

export interface StatusResponse {
  workspace: string;
  ledger: {
    operations: number;
    last_operation: string | null;
  };
  memories: {
    total: number;
  };
  commitments: {
    total: number;
    open: number;
    claimed: number;
    in_review: number;
    reopened: number;
    closed: number;
  };
}

// --- Configuration ---

export interface MentuConfig {
  apiUrl: string;
  apiToken: string;
  workspaceId: string;
  projectDomains?: string[];
}

export interface ApiError {
  error: string;
  message: string;
  [key: string]: unknown;
}
