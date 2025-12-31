/**
 * Universal Ticket Layer - TypeScript SDK
 *
 * @packageDocumentation
 * @module @warrantyos/utl-sdk
 *
 * @example
 * ```typescript
 * import { UTLClient } from '@warrantyos/utl-sdk';
 *
 * const utl = new UTLClient({
 *   apiUrl: 'https://your-project.supabase.co/functions/v1',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Create a ticket
 * const ticket = await utl.tickets.create({
 *   source: 'api',
 *   type: 'bug',
 *   description: 'Something went wrong',
 *   priority: 'high',
 * });
 *
 * // List tickets
 * const { tickets } = await utl.tickets.list({
 *   type: 'bug',
 *   status: 'submitted',
 *   limit: 10,
 * });
 *
 * // Update ticket
 * await utl.tickets.update(ticket.id, {
 *   status: 'in_progress',
 * });
 * ```
 */

// Main client
export { UTLClient } from './client';

// Resources
export { TicketsResource } from './tickets';

// Types
export type {
  // Core types
  Ticket,
  ExternalRef,
  TicketSource,
  TicketType,
  TicketPriority,
  TicketStatus,

  // Request/Response types
  CreateTicketRequest,
  UpdateTicketRequest,
  ListTicketsParams,
  ListTicketsResponse,
  TicketResponse,
  DeleteResponse,
  ErrorResponse,

  // Config
  UTLClientConfig,
} from './types';

// Constants
export {
  TICKET_SOURCES,
  TICKET_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from './types';
