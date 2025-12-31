import { WebSocketServer, WebSocket } from 'ws';
import { watch } from 'fs';
import path from 'path';
import { readLedger, getLedgerPath } from '../../core/ledger.js';
import { readConfig, getMentuDir } from '../../core/config.js';
import type { Operation } from '../../types.js';
import type { Subscription, ApiKeyStored, ClientMessage, ServerEvent } from '../types.js';
import { hashApiKey } from '../types.js';

interface Client {
  ws: WebSocket;
  authenticated: boolean;
  actor: string | null;
  subscriptions: Subscription[];
}

let subscriptionIdCounter = 0;

function generateSubscriptionId(): string {
  return `sub_${++subscriptionIdCounter}`;
}

/**
 * Validate token by hash comparison.
 */
function validateToken(
  token: string,
  workspacePath: string
): { valid: boolean; actor: string | null } {
  const config = readConfig(workspacePath) as Record<string, unknown> | null;
  const apiKeys = (config?.api as Record<string, unknown> | undefined)?.keys as
    | ApiKeyStored[]
    | undefined;

  if (!apiKeys) {
    return { valid: false, actor: null };
  }

  const tokenHash = hashApiKey(token);
  const apiKey = apiKeys.find((k: ApiKeyStored) => k.key_hash === tokenHash);

  if (!apiKey) {
    return { valid: false, actor: null };
  }
  return { valid: true, actor: apiKey.actor };
}

/**
 * Check if an operation matches a client's subscription filters.
 */
function shouldReceive(client: Client, operation: Operation): boolean {
  // If no subscriptions, receive nothing
  if (client.subscriptions.length === 0) {
    return false;
  }

  // Check each subscription
  for (const sub of client.subscriptions) {
    const filters = sub.filters;

    // If no filters, receive everything
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    // Check ops filter
    if (filters.ops && filters.ops.length > 0) {
      if (!filters.ops.includes(operation.op)) {
        continue; // Try next subscription
      }
    }

    // Check actors filter
    if (filters.actors && filters.actors.length > 0) {
      if (!filters.actors.includes(operation.actor)) {
        continue; // Try next subscription
      }
    }

    // Check commitments filter (for claim/release/close operations)
    if (filters.commitments && filters.commitments.length > 0) {
      if (
        operation.op === 'claim' ||
        operation.op === 'release' ||
        operation.op === 'close'
      ) {
        if (!filters.commitments.includes(operation.payload.commitment)) {
          continue; // Try next subscription
        }
      } else if (operation.op === 'commit') {
        if (!filters.commitments.includes(operation.id)) {
          continue; // Try next subscription
        }
      } else {
        continue; // Not a commitment-related operation
      }
    }

    // Check memories filter
    if (filters.memories && filters.memories.length > 0) {
      if (operation.op === 'capture') {
        if (!filters.memories.includes(operation.id)) {
          continue; // Try next subscription
        }
      } else if (operation.op === 'annotate') {
        if (!filters.memories.includes(operation.payload.target)) {
          continue; // Try next subscription
        }
      } else {
        continue; // Not a memory-related operation
      }
    }

    // Passed all filters for this subscription
    return true;
  }

  // No subscription matched
  return false;
}

/**
 * Send a message to a WebSocket client.
 */
function sendMessage(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

/**
 * Create a WebSocket subscription manager.
 */
export function createSubscriptionManager(wss: WebSocketServer, workspacePath: string) {
  const clients = new Map<WebSocket, Client>();
  let lastLedgerLength = 0;

  // Initialize last ledger length
  try {
    const ledger = readLedger(workspacePath);
    lastLedgerLength = ledger.length;
  } catch {
    // Workspace might not exist yet
  }

  wss.on('connection', (ws: WebSocket) => {
    // Start unauthenticated - must auth via first message
    clients.set(ws, {
      ws,
      authenticated: false,
      actor: null,
      subscriptions: [],
    });

    ws.on('message', (data: Buffer) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        sendMessage(ws, {
          event: 'error',
          error: 'E_INVALID_OP',
          message: 'Invalid JSON message',
        });
        return;
      }

      const client = clients.get(ws);
      if (!client) return;

      // Handle auth message (must be first)
      if (message.action === 'auth') {
        const token = message.token;
        const result = validateToken(token, workspacePath);

        if (!result.valid) {
          sendMessage(ws, {
            event: 'error',
            error: 'E_UNAUTHORIZED',
            message: 'Invalid API key',
          });
          ws.close(1008, 'Unauthorized');
          return;
        }

        client.authenticated = true;
        client.actor = result.actor;
        sendMessage(ws, {
          event: 'authenticated',
          actor: result.actor!,
        });
        return;
      }

      // Reject all other messages if not authenticated
      if (!client.authenticated) {
        sendMessage(ws, {
          event: 'error',
          error: 'E_UNAUTHORIZED',
          message: 'Must authenticate first',
        });
        return;
      }

      // Handle subscribe
      if (message.action === 'subscribe') {
        const subscription: Subscription = {
          id: generateSubscriptionId(),
          filters: message.filters || {},
        };
        client.subscriptions.push(subscription);
        sendMessage(ws, {
          event: 'subscribed',
          filters: message.filters || {},
        });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  /**
   * Broadcast an operation to all authenticated subscribers.
   */
  function broadcast(operation: Operation): void {
    for (const [, client] of clients) {
      if (client.authenticated && shouldReceive(client, operation)) {
        sendMessage(client.ws, {
          event: 'operation',
          data: operation,
        });
      }
    }
  }

  /**
   * Watch ledger for changes and broadcast new operations.
   */
  function startWatching(): void {
    const mentuDir = getMentuDir(workspacePath);

    try {
      watch(mentuDir, (eventType, filename) => {
        if (filename === 'ledger.jsonl' && eventType === 'change') {
          try {
            const ledger = readLedger(workspacePath);
            // Broadcast new operations
            if (ledger.length > lastLedgerLength) {
              for (let i = lastLedgerLength; i < ledger.length; i++) {
                broadcast(ledger[i]);
              }
              lastLedgerLength = ledger.length;
            }
          } catch {
            // Ignore read errors
          }
        }
      });
    } catch {
      // Directory might not exist yet, that's OK
    }
  }

  // Start watching
  startWatching();

  return { broadcast };
}
