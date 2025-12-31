/**
 * Universal Ticket Layer - Client
 *
 * TypeScript SDK for interacting with the Universal Ticket Layer API.
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
 * const ticket = await utl.tickets.create({
 *   source: 'api',
 *   type: 'bug',
 *   description: 'Something went wrong',
 * });
 *
 * console.log(`Created ticket: ${ticket.id}`);
 * ```
 */

import { TicketsResource } from './tickets';
import type { UTLClientConfig } from './types';

export class UTLClient {
  readonly tickets: TicketsResource;

  private readonly config: Required<UTLClientConfig>;

  constructor(config: UTLClientConfig) {
    // Validate required config
    if (!config.apiUrl) {
      throw new Error('UTLClient: apiUrl is required');
    }
    if (!config.apiKey) {
      throw new Error('UTLClient: apiKey is required');
    }

    // Set defaults
    this.config = {
      apiUrl: config.apiUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000, // 30 seconds default
    };

    // Build headers
    const headers: HeadersInit = {
      'x-api-key': this.config.apiKey,
    };

    // Initialize resources
    this.tickets = new TicketsResource(
      this.config.apiUrl,
      headers,
      this.config.timeout
    );
  }

  /**
   * Get the configured API URL
   */
  get apiUrl(): string {
    return this.config.apiUrl;
  }

  /**
   * Create a new client with different configuration
   */
  withConfig(overrides: Partial<UTLClientConfig>): UTLClient {
    return new UTLClient({
      ...this.config,
      ...overrides,
    });
  }
}
