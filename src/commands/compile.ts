import type { Command } from 'commander';
import { MentuError } from '../types.js';
import { findWorkspace } from '../core/config.js';
import { readLedger } from '../core/ledger.js';
import { getMemory } from '../core/state.js';
import { compileEvidence } from '../core/evidence-compiler.js';

export function registerCompileCommand(program: Command): void {
  program
    .command('compile <memory_id>')
    .description('Compile a memory into structured evidence')
    .action(async (memoryId: string) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const ledger = readLedger(workspacePath);
        const memory = getMemory(ledger, memoryId);

        if (!memory) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Memory not found: ${memoryId}`,
            { field: 'memory', value: memoryId }
          );
        }

        const compiled = compileEvidence(memory);
        console.log(JSON.stringify(compiled, null, 2));
      } catch (err) {
        if (err instanceof MentuError) {
          if (json) {
            console.log(JSON.stringify({ ...err.toJSON(), op: 'compile' }));
          } else {
            console.error(`Error: ${err.message}`);
          }
          process.exit(1);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          if (json) {
            console.log(JSON.stringify({ ...error.toJSON(), op: 'compile' }));
          } else {
            console.error(`Error: ${error.message}`);
          }
          process.exit(1);
        }
      }
    });
}
