// Mentu Protocol Types

// Error codes
export type ErrorCode =
  | 'E_INVALID_OP'
  | 'E_MISSING_FIELD'
  | 'E_EMPTY_BODY'
  | 'E_REF_NOT_FOUND'
  | 'E_ALREADY_CLOSED'
  | 'E_NOT_OWNER'
  | 'E_ALREADY_CLAIMED'
  | 'E_DUPLICATE_ID'
  | 'E_DUPLICATE_SOURCE_KEY'
  | 'E_PERMISSION_DENIED'
  | 'E_CONSTRAINT_VIOLATED'
  | 'E_WORKSPACE_EXISTS'
  | 'E_NO_WORKSPACE'
  | 'E_WORKSPACE_LOCKED'
  // v0.2: GitHub integration errors
  | 'E_GITHUB_NOT_CONFIGURED'
  | 'E_GITHUB_AUTH_FAILED'
  | 'E_GITHUB_RATE_LIMITED'
  | 'E_GITHUB_ISSUE_NOT_FOUND'
  | 'E_GITHUB_PERMISSION_DENIED'
  | 'E_EXTERNAL_REF_EXISTS'
  | 'E_EXTERNAL_REF_NOT_FOUND'
  // v0.3: API server errors
  | 'E_UNAUTHORIZED'
  | 'E_FORBIDDEN'
  | 'E_NOT_FOUND'
  | 'E_INTERNAL';

// Custom error class
export class MentuError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MentuError';
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...this.details,
    };
  }
}

// Operation types
export type OperationType =
  | 'capture' | 'commit' | 'claim' | 'release' | 'close' | 'annotate'
  | 'link' | 'dismiss' | 'triage'
  | 'submit' | 'approve' | 'reopen';

// Link relationship types (v0.8)
export type LinkKind =
  | 'related'      // general relationship (default)
  | 'duplicate'    // source duplicates target
  | 'caused_by'    // source was caused by target
  | 'blocks'       // source blocks target
  | 'evidence';    // source is evidence for target

// Payload types
export interface CapturePayload {
  body: string;
  kind?: string;
  path?: string;      // Document path for kind=document
  refs?: string[];    // Related IDs (cmt_xxx, mem_xxx)
  meta?: Record<string, unknown>;
}

export interface CommitPayload {
  body: string;
  source: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}

export interface ClaimPayload {
  commitment: string;
}

export interface ReleasePayload {
  commitment: string;
  reason?: string;
}

export interface ClosePayload {
  commitment: string;
  evidence?: string;       // mem_xxx - normal close (sacred invariant)
  duplicate_of?: string;   // cmt_xxx - duplicate close
}

export interface AnnotatePayload {
  target: string;
  body: string;
  kind?: string;
  refs?: string[];
  meta?: Record<string, unknown>;
}

// v0.8: Triage Layer payloads
export interface LinkPayload {
  source: string;     // mem_xxx or cmt_xxx being linked
  target: string;     // cmt_xxx to link to
  kind?: LinkKind;    // relationship type (default: 'related')
  reason?: string;    // optional explanation
}

export interface DismissPayload {
  memory: string;     // mem_xxx to dismiss
  reason: string;     // required explanation
  tags?: string[];    // optional categorization
}

export interface TriageDecision {
  memory: string;                 // mem_xxx
  action: 'create' | 'link' | 'dismiss' | 'defer';
  target?: string;                // cmt_xxx if created or linked
  reason?: string;                // explanation
}

export interface TriagePayload {
  reviewed: string[];           // memory IDs reviewed in this batch
  summary: string;              // human-readable summary
  decisions: TriageDecision[];  // what was decided
}

// Submit payload (v1.0 - enhanced)
export interface SubmitPayload {
  commitment: string;
  evidence: string[];
  summary?: string;
  tier?: string;
  validation?: Record<string, { passed: boolean; details?: string }>;
}

// Approve payload (v1.0)
export interface ApprovePayload {
  commitment: string;
  comment?: string;
  auto?: boolean;
  tier?: string;
}

// Reopen payload (v1.0)
export interface ReopenPayload {
  commitment: string;
  reason: string;
  from_state: 'in_review' | 'closed';
}

export type Payload =
  | CapturePayload
  | CommitPayload
  | ClaimPayload
  | ReleasePayload
  | ClosePayload
  | AnnotatePayload
  | LinkPayload
  | DismissPayload
  | TriagePayload
  | SubmitPayload
  | ApprovePayload
  | ReopenPayload;

// Base operation (common envelope)
export interface BaseOperation {
  id: string;
  op: OperationType;
  ts: string;
  actor: string;
  workspace: string;
  source_key?: string;
}

// Specific operation types
export interface CaptureOperation extends BaseOperation {
  op: 'capture';
  payload: CapturePayload;
}

export interface CommitOperation extends BaseOperation {
  op: 'commit';
  payload: CommitPayload;
}

export interface ClaimOperation extends BaseOperation {
  op: 'claim';
  payload: ClaimPayload;
}

export interface ReleaseOperation extends BaseOperation {
  op: 'release';
  payload: ReleasePayload;
}

export interface CloseOperation extends BaseOperation {
  op: 'close';
  payload: ClosePayload;
}

export interface AnnotateOperation extends BaseOperation {
  op: 'annotate';
  payload: AnnotatePayload;
}

// v0.8: Triage Layer operations
export interface LinkOperation extends BaseOperation {
  op: 'link';
  payload: LinkPayload;
}

export interface DismissOperation extends BaseOperation {
  op: 'dismiss';
  payload: DismissPayload;
}

export interface TriageOperation extends BaseOperation {
  op: 'triage';
  payload: TriagePayload;
}

// Submit operation (v1.0 - enhanced)
export interface SubmitOperation extends BaseOperation {
  op: 'submit';
  payload: SubmitPayload;
}

// Approve operation (v1.0)
export interface ApproveOperation extends BaseOperation {
  op: 'approve';
  payload: ApprovePayload;
}

// Reopen operation (v1.0)
export interface ReopenOperation extends BaseOperation {
  op: 'reopen';
  payload: ReopenPayload;
}

export type Operation =
  | CaptureOperation
  | CommitOperation
  | ClaimOperation
  | ReleaseOperation
  | CloseOperation
  | AnnotateOperation
  | LinkOperation
  | DismissOperation
  | TriageOperation
  | SubmitOperation
  | ApproveOperation
  | ReopenOperation;

// Computed state types
// Commitment states (v1.0)
export type CommitmentState =
  | 'open'
  | 'claimed'
  | 'in_review'   // Submitted, awaiting approval
  | 'closed'
  | 'reopened';   // Disputed, needs rework

// v0.8: Memory triage state
export type MemoryState = 'untriaged' | 'linked' | 'dismissed' | 'committed';

export interface Annotation {
  id: string;
  body: string;
  kind?: string;
  actor: string;
  ts: string;
}

export interface Memory {
  id: string;
  body: string;
  kind: string | null;
  actor: string;
  ts: string;
  refs?: string[];
  meta?: Record<string, unknown>;
  annotations: Annotation[];
}

export interface Commitment {
  id: string;
  body: string;
  source: string;
  state: CommitmentState;
  owner: string | null;
  evidence: string | null;
  closed_by: string | null;
  actor: string;
  ts: string;
  tags?: string[];
  meta?: Record<string, unknown>;
  annotations: Annotation[];
}

// External system reference (v0.2)
export interface ExternalRef {
  system: 'github' | 'linear' | 'jira';
  type: 'issue' | 'project_card' | 'pr';
  id: string;
  url: string;
  synced_at: string;
}

// GitHub integration config (v0.2)
export interface GitHubSyncPushConfig {
  on_commit: boolean;
  on_claim: boolean;
  on_release: boolean;
  on_close: boolean;
  on_annotate: boolean;
}

export interface GitHubSyncPullConfig {
  on_issue_closed: 'ignore' | 'warn' | 'reopen';
  on_issue_commented: 'ignore' | 'annotate';
  on_pr_merged: 'ignore' | 'capture';
}

export interface GitHubConfig {
  enabled: boolean;
  owner: string;
  repo: string;
  token_env: string;
  project?: string;
  sync: {
    push: GitHubSyncPushConfig;
    pull: GitHubSyncPullConfig;
  };
}

export interface IntegrationsConfig {
  github?: GitHubConfig;
}

// Cloud config (v0.4)
export interface CloudConfig {
  enabled: boolean;
  endpoint: string;
  workspace_id: string;
}

// Config types
export interface Config {
  workspace: string;
  created: string;
  default_actor?: string;
  integrations?: IntegrationsConfig;
  cloud?: CloudConfig;
}

// Genesis Key types
export interface GenesisKey {
  genesis: {
    version: string;
    created: string;
  };
  identity: {
    workspace: string;
    owner: string;
  };
  permissions?: {
    actors?: Record<string, { operations: OperationType[] }>;
    defaults?: {
      authenticated?: { operations: OperationType[] };
      anonymous?: { operations: OperationType[] };
    };
  };
  constraints?: {
    require_claim?: Array<{ match: MatchRule }>;
    require_validation?: Array<{
      match: MatchRule;
      validator?: string;
    }>;
    require_human?: Array<{
      operation: OperationType;
      match: MatchRule;
    }>;
  };
}

export type MatchRule = 'all' | { tags?: string[]; actor?: string; source_kind?: string } | Record<string, never>;

// Validation result
export interface ValidationResult {
  valid: boolean;
  error?: MentuError;
}

// JSON output types
export interface InitOutput {
  workspace: string;
  created: string[];
  project_root: string;
  gitignore_updated: boolean;
}

export interface CaptureOutput {
  id: string;
  op: 'capture';
  ts: string;
  actor: string;
  body: string;
  kind?: string;
  path?: string;
  refs?: string[];
  source_key?: string;
}

export interface CommitOutput {
  id: string;
  op: 'commit';
  ts: string;
  actor: string;
  body: string;
  source: string;
}

export interface ClaimOutput {
  id: string;
  op: 'claim';
  ts: string;
  actor: string;
  commitment: string;
}

export interface ReleaseOutput {
  id: string;
  op: 'release';
  ts: string;
  actor: string;
  commitment: string;
  reason?: string;
}

export interface CloseOutput {
  id: string;
  op: 'close';
  ts: string;
  actor: string;
  commitment: string;
  evidence: string;
}

export interface AnnotateOutput {
  id: string;
  op: 'annotate';
  ts: string;
  actor: string;
  target: string;
  body: string;
  kind?: string;
}

// v0.8: Triage outputs
export interface LinkOutput {
  id: string;
  op: 'link';
  ts: string;
  actor: string;
  source: string;
  target: string;
  kind: LinkKind;
}

export interface DismissOutput {
  id: string;
  op: 'dismiss';
  ts: string;
  actor: string;
  memory: string;
  reason: string;
}

export interface TriageOutput {
  id: string;
  op: 'triage';
  ts: string;
  actor: string;
  reviewed_count: number;
  summary: string;
}

export interface StatusOutput {
  workspace: string;
  open: Array<{ id: string; body: string; owner: null }>;
  claimed: Array<{ id: string; body: string; owner: string }>;
  in_review: Array<{ id: string; body: string; owner: string | null; evidence: string | null }>;
  reopened: Array<{ id: string; body: string; owner: string | null }>;
  closed: Array<{ id: string; body: string; closed_by: string; evidence: string | null }>;
}

export interface ErrorOutput {
  error: ErrorCode;
  op?: OperationType;
  field?: string;
  value?: string;
  message: string;
  [key: string]: unknown;
}
