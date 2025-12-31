// GitHub-specific types for the integration layer

export interface GitHubIssue {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  assignee?: { login: string } | null;
  assignees?: Array<{ login: string }>;
  labels: Array<{ name: string }>;
}

export interface CreateIssueParams {
  title: string;
  body: string;
  labels?: string[];
  assignee?: string;
}

export interface UpdateIssueParams {
  title?: string;
  body?: string;
  labels?: string[];
  assignee?: string | null;
  state?: 'open' | 'closed';
}

export interface GitHubSyncResult {
  action: 'created' | 'updated' | 'closed' | 'warned' | 'reopened' | 'assigned' | 'unassigned';
  issue_number: number;
  url: string;
}

export interface SyncWarning {
  commitment: string;
  issue: number;
  action: 'warn' | 'reopen' | 'ignore';
  reason: string;
}

export interface PullSyncResult {
  synced: number;
  warnings: SyncWarning[];
  errors: Array<{ commitment: string; error: string }>;
}
