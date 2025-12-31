import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { createApp } from './app.js';
import { WebSocketServer } from 'ws';
import { createSubscriptionManager } from './ws/subscribe.js';

export interface ServerOptions {
  port: number;
  host: string;
  workspacePath: string;
  enableCors: boolean;
}

/**
 * Create and start the Mentu API server.
 */
export function createServer(options: ServerOptions) {
  const app = createApp(options.workspacePath, options.enableCors);

  // Create HTTP server manually for WebSocket compatibility
  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      // Use the Hono app's fetch handler
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      // Read request body for non-GET/HEAD requests
      let body: string | undefined;
      if (!['GET', 'HEAD'].includes(req.method || '')) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        body = Buffer.concat(chunks).toString();
      }

      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body,
      });

      const response = await app.fetch(request);
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      const responseBody = await response.text();
      res.end(responseBody);
    } catch (err: unknown) {
      console.error('Request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(options.port, options.host);

  // WebSocket server on same port
  const wss = new WebSocketServer({ server });
  const subscriptionManager = createSubscriptionManager(wss, options.workspacePath);

  return { server, wss, subscriptionManager };
}
