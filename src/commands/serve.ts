import type { Command } from 'commander';
import { findWorkspace } from '../core/config.js';
import { createServer } from '../server/index.js';
import { MentuError } from '../types.js';

interface ServeOptions {
  port: string;
  host: string;
  cors: boolean;
  json: boolean;
}

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the API server')
    .option('--port <port>', 'Port to listen on', '3000')
    .option('--host <host>', 'Host to bind to', 'localhost')
    .option('--cors', 'Enable CORS for browser access')
    .option('--json', 'Output server info as JSON')
    .action((options: ServeOptions) => {
      try {
        const workspacePath = findWorkspace(process.cwd());
        const port = parseInt(options.port, 10);

        if (isNaN(port) || port < 1 || port > 65535) {
          if (options.json) {
            console.log(
              JSON.stringify({
                error: 'E_INVALID_OP',
                message: 'Invalid port number',
              })
            );
          } else {
            console.error('Error: Invalid port number');
          }
          process.exit(1);
        }

        createServer({
          port,
          host: options.host,
          workspacePath,
          enableCors: options.cors,
        });

        if (options.json) {
          console.log(
            JSON.stringify({
              status: 'running',
              host: options.host,
              port: port,
              pid: process.pid,
              workspace: workspacePath,
            })
          );
        } else {
          console.log(`Starting Mentu API server...`);
          console.log(`Server running at http://${options.host}:${port}`);
          console.log(`WebSocket at ws://${options.host}:${port}`);
          console.log('Press Ctrl+C to stop');
        }
      } catch (err) {
        if (err instanceof MentuError) {
          if (options.json) {
            console.log(JSON.stringify(err.toJSON()));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        }
        throw err;
      }
    });
}
