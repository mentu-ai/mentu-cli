/**
 * Universal Ticket Layer - Tickets Resource
 */

import type {
  Ticket,
  CreateTicketRequest,
  UpdateTicketRequest,
  ListTicketsParams,
  ListTicketsResponse,
  TicketResponse,
  DeleteResponse,
} from './types';

export class TicketsResource {
  constructor(
    private readonly apiUrl: string,
    private readonly headers: HeadersInit,
    private readonly timeout: number
  ) {}

  /**
   * Create a new ticket
   */
  async create(data: CreateTicketRequest): Promise<Ticket> {
    const response = await this.fetch('', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    const result = (await response.json()) as TicketResponse;

    if (!result.success) {
      throw new Error((result as unknown as { error: string }).error || 'Failed to create ticket');
    }

    return result.ticket;
  }

  /**
   * List tickets with optional filters
   */
  async list(params?: ListTicketsParams): Promise<ListTicketsResponse> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    const url = query ? `?${query}` : '';

    const response = await this.fetch(url, { method: 'GET' });
    const result = (await response.json()) as ListTicketsResponse;

    if (!result.success) {
      throw new Error((result as unknown as { error: string }).error || 'Failed to list tickets');
    }

    return result;
  }

  /**
   * Get a single ticket by ID
   */
  async get(id: string): Promise<Ticket> {
    const response = await this.fetch(`/${id}`, { method: 'GET' });
    const result = (await response.json()) as TicketResponse;

    if (!result.success) {
      throw new Error((result as unknown as { error: string }).error || 'Failed to get ticket');
    }

    return result.ticket;
  }

  /**
   * Update a ticket
   */
  async update(id: string, data: UpdateTicketRequest): Promise<Ticket> {
    const response = await this.fetch(`/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    const result = (await response.json()) as TicketResponse;

    if (!result.success) {
      throw new Error((result as unknown as { error: string }).error || 'Failed to update ticket');
    }

    return result.ticket;
  }

  /**
   * Delete a ticket
   */
  async delete(id: string): Promise<void> {
    const response = await this.fetch(`/${id}`, { method: 'DELETE' });
    const result = (await response.json()) as DeleteResponse;

    if (!result.success) {
      throw new Error((result as unknown as { error: string }).error || 'Failed to delete ticket');
    }
  }

  /**
   * Internal fetch wrapper
   */
  private async fetch(path: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiUrl}/tickets-api${path}`, {
        ...options,
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
