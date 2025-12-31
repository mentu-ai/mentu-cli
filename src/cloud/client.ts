// Cloud Client for Mentu v0.4

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getCredentials, refreshTokenIfNeeded, getSupabaseUrl, getSupabaseAnonKey } from './auth.js';
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceInvite,
  SyncPushResponse,
  SyncPullResponse,
  CloudError,
} from './types.js';
import type { Operation } from '../types.js';

/**
 * Cloud client for interacting with Mentu Cloud API.
 */
export class CloudClient {
  private supabase: SupabaseClient;
  private workspaceId?: string;

  private constructor(supabase: SupabaseClient, workspaceId?: string) {
    this.supabase = supabase;
    this.workspaceId = workspaceId;
  }

  /**
   * Create a new CloudClient with authenticated credentials.
   */
  static async create(workspaceId?: string): Promise<CloudClient> {
    const credentials = await getCredentials();
    if (!credentials) {
      throw new Error('Not logged in. Run: mentu login');
    }

    // Refresh token if needed
    const validCredentials = await refreshTokenIfNeeded(credentials);

    const supabase = createClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        global: {
          headers: { Authorization: `Bearer ${validCredentials.accessToken}` },
        },
      }
    );

    // Set the session so auth.uid() works in RLS policies
    await supabase.auth.setSession({
      access_token: validCredentials.accessToken,
      refresh_token: validCredentials.refreshToken,
    });

    return new CloudClient(supabase, workspaceId);
  }

  /**
   * Set the workspace ID for subsequent operations.
   */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId;
  }

  /**
   * Get the current workspace ID.
   */
  getWorkspaceId(): string | undefined {
    return this.workspaceId;
  }

  // ============================================
  // Workspace Management
  // ============================================

  /**
   * Create a new cloud workspace.
   */
  async createWorkspace(name: string, displayName?: string): Promise<{ workspace?: Workspace; error?: string }> {
    const { data, error } = await this.supabase.functions.invoke('workspace-create', {
      body: { name, display_name: displayName },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { workspace: data.workspace };
  }

  /**
   * Get workspace by name.
   */
  async getWorkspaceByName(name: string): Promise<{ workspace?: Workspace; error?: string }> {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select('id, name, display_name, created_at, created_by')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { error: 'Workspace not found' };
      }
      return { error: error.message };
    }

    // Get the user's role in this workspace
    const credentials = await getCredentials();
    const { data: membership } = await this.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', data.id)
      .eq('user_id', credentials?.userId)
      .single();

    return {
      workspace: {
        id: data.id,
        name: data.name,
        displayName: data.display_name,
        createdAt: data.created_at,
        createdBy: data.created_by,
        role: membership?.role || 'member',
      },
    };
  }

  /**
   * List all workspaces the user is a member of.
   */
  async listWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name,
          display_name,
          created_at,
          created_by
        )
      `)
      .order('joined_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((m: any) => ({
      id: m.workspaces.id,
      name: m.workspaces.name,
      displayName: m.workspaces.display_name,
      createdAt: m.workspaces.created_at,
      createdBy: m.workspaces.created_by,
      role: m.role,
    }));
  }

  /**
   * Get workspace members.
   */
  async getWorkspaceMembers(workspaceId?: string): Promise<WorkspaceMember[]> {
    const wsId = workspaceId || this.workspaceId;
    if (!wsId) {
      throw new Error('No workspace ID specified');
    }

    const { data, error } = await this.supabase
      .from('workspace_members')
      .select('user_id, role, joined_at')
      .eq('workspace_id', wsId);

    if (error || !data) {
      return [];
    }

    // Get user emails from auth
    const members: WorkspaceMember[] = [];
    for (const m of data) {
      members.push({
        userId: m.user_id,
        email: '', // Would need separate auth lookup
        role: m.role,
        joinedAt: m.joined_at,
      });
    }

    return members;
  }

  // ============================================
  // Invitations
  // ============================================

  /**
   * Invite a user by email.
   */
  async inviteByEmail(email: string, role: 'admin' | 'member' = 'member'): Promise<{ invite?: WorkspaceInvite; error?: string }> {
    if (!this.workspaceId) {
      return { error: 'No workspace ID specified' };
    }

    const { data, error } = await this.supabase.functions.invoke('workspace-invite', {
      body: {
        workspace_id: this.workspaceId,
        email,
        role,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { invite: data.invite };
  }

  /**
   * Create an invite link.
   */
  async createInviteLink(role: 'admin' | 'member' = 'member', expiresInDays: number = 7): Promise<{ invite?: WorkspaceInvite; error?: string }> {
    if (!this.workspaceId) {
      return { error: 'No workspace ID specified' };
    }

    const { data, error } = await this.supabase.functions.invoke('workspace-invite', {
      body: {
        workspace_id: this.workspaceId,
        role,
        link: true,
        expires_in_days: expiresInDays,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { invite: data.invite };
  }

  // ============================================
  // Sync Operations
  // ============================================

  /**
   * Push operations to the cloud.
   */
  async pushOperations(
    operations: Operation[],
    cursor: string | null,
    clientId: string
  ): Promise<{ data?: SyncPushResponse; error?: string }> {
    if (!this.workspaceId) {
      return { error: 'No workspace ID specified' };
    }

    const { data, error } = await this.supabase.functions.invoke('sync-push', {
      body: {
        workspace_id: this.workspaceId,
        client_id: clientId,
        operations,
        cursor,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { data: data as SyncPushResponse };
  }

  /**
   * Pull operations from the cloud.
   */
  async pullOperations(
    cursor: string | null,
    clientId: string,
    limit: number = 100
  ): Promise<{ data?: SyncPullResponse; error?: string }> {
    if (!this.workspaceId) {
      return { error: 'No workspace ID specified' };
    }

    const { data, error } = await this.supabase.functions.invoke('sync-pull', {
      body: {
        workspace_id: this.workspaceId,
        client_id: clientId,
        cursor,
        limit,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { data: data as SyncPullResponse };
  }

  /**
   * Get sync status.
   */
  async getSyncStatus(clientId: string): Promise<{ data?: any; error?: string }> {
    if (!this.workspaceId) {
      return { error: 'No workspace ID specified' };
    }

    const { data, error } = await this.supabase.functions.invoke('sync-status', {
      body: {
        workspace_id: this.workspaceId,
        client_id: clientId,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { data };
  }

  // ============================================
  // Direct Database Operations (for advanced use)
  // ============================================

  /**
   * Get the Supabase client for direct database access.
   */
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}
