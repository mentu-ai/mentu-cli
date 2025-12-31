/**
 * Universal Ticket Layer - TypeScript Types
 */

// ===========================================
// ENUMS / VALID VALUES
// ===========================================

export const TICKET_SOURCES = [
  'bug_reporter',
  'email',
  'slack',
  'api',
  'manual',
  'zapier',
  'webhook',
] as const;

export type TicketSource = typeof TICKET_SOURCES[number];

export const TICKET_TYPES = [
  'bug',
  'feature',
  'support',
  'task',
  'question',
] as const;

export type TicketType = typeof TICKET_TYPES[number];

export const TICKET_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type TicketPriority = typeof TICKET_PRIORITIES[number];

export const TICKET_STATUSES = [
  'submitted',
  'triaged',
  'in_progress',
  'resolved',
  'closed',
  'wont_fix',
] as const;

export type TicketStatus = typeof TICKET_STATUSES[number];

// ===========================================
// TICKET MODEL
// ===========================================

export interface ExternalRef {
  system: string;
  id: string;
  url?: string;
  synced_at: string;
}

export interface Ticket {
  id: string;
  source: TicketSource;
  source_id?: string;
  source_metadata?: Record<string, unknown>;
  type: TicketType;
  title?: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to?: string;
  assigned_at?: string;
  payload?: Record<string, unknown>;
  page_url?: string;
  environment?: Record<string, unknown>;
  external_refs: ExternalRef[];
  created_by?: string;
  session_id?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

// ===========================================
// REQUEST / RESPONSE TYPES
// ===========================================

export interface CreateTicketRequest {
  source: TicketSource;
  description: string;
  type?: TicketType;
  title?: string;
  priority?: TicketPriority;
  page_url?: string;
  environment?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  source_id?: string;
  source_metadata?: Record<string, unknown>;
}

export interface UpdateTicketRequest {
  type?: TicketType;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  assigned_to?: string;
  resolution_notes?: string;
}

export interface ListTicketsParams {
  type?: TicketType;
  status?: TicketStatus;
  priority?: TicketPriority;
  source?: TicketSource;
  assigned_to?: string;
  created_by?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
  order?: 'asc' | 'desc';
}

export interface ListTicketsResponse {
  success: boolean;
  tickets: Ticket[];
  count: number;
  total: number;
  limit: number;
  offset: number;
}

export interface TicketResponse {
  success: boolean;
  ticket: Ticket;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

// ===========================================
// CLIENT CONFIGURATION
// ===========================================

export interface UTLClientConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}
