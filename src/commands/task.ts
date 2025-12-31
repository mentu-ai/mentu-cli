import fs from 'fs';
import type { Command } from 'commander';
import type { CaptureOperation, CommitOperation, ClaimOperation, CloseOperation, ReleaseOperation, AnnotateOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';

interface TaskOptions {
  actor?: string;
}

interface TaskStartOutput {
  memory_id: string;
  commitment_id: string;
  actor: string;
}

interface TaskCompleteOutput {
  commitment_id: string;
  evidence_id: string;
  closed: boolean;
}

interface TaskFailOutput {
  commitment_id: string;
  released: boolean;
  error_annotated: boolean;
}

const STATE_FILE = '.claude/mentu_state.json';

function saveState(commitmentId: string, memoryId: string, actor: string): void {
  fs.mkdirSync('.claude', { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    active_commitment: commitmentId,
    source_memory: memoryId,
    actor,
  }, null, 2));
}

function loadState(): { active_commitment?: string; actor?: string } | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function clearState(): void {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // Ignore
  }
}

function outputResult(result: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'task' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerTaskCommand(program: Command): void {
  const taskCmd = program
    .command('task')
    .description('Manual task lifecycle commands for Claude Code integration');

  // mentu task start <description>
  taskCmd
    .command('start <description>')
    .description('Start a task: capture + commit + claim')
    .option('--actor <id>', 'Override actor identity')
    .action((description: string, options: TaskOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);
        const ts = timestamp();

        // 1. Capture memory
        const memId = generateId('mem');
        const captureOp: CaptureOperation = {
          id: memId,
          op: 'capture',
          ts,
          actor,
          workspace,
          payload: {
            body: `Task: ${description}`,
            kind: 'task_request',
          },
        };
        appendOperation(workspacePath, captureOp);

        if (!json) console.log(`Captured: ${memId}`);

        // 2. Commit
        const cmtId = generateId('cmt');
        const commitOp: CommitOperation = {
          id: cmtId,
          op: 'commit',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            body: description,
            source: memId,
          },
        };

        const validation = validateOperation(commitOp, [...ledger, captureOp], genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }
        appendOperation(workspacePath, commitOp);

        if (!json) console.log(`Committed: ${cmtId}`);

        // 3. Claim
        const claimId = generateId('op');
        const claimOp: ClaimOperation = {
          id: claimId,
          op: 'claim',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            commitment: cmtId,
          },
        };
        appendOperation(workspacePath, claimOp);

        if (!json) console.log(`Claimed: ${cmtId}`);

        // 4. Save state
        saveState(cmtId, memId, actor);

        const result: TaskStartOutput = {
          memory_id: memId,
          commitment_id: cmtId,
          actor,
        };

        if (!json) {
          console.log(`\nTask started: ${cmtId}`);
        }
        outputResult(result, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });

  // mentu task complete <summary>
  taskCmd
    .command('complete <summary>')
    .description('Complete a task: capture evidence + close')
    .option('--actor <id>', 'Override actor identity')
    .action((summary: string, options: TaskOptions) => {
      const json = program.opts().json || false;

      try {
        const state = loadState();
        if (!state?.active_commitment) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            'No active task. Run "mentu task start" first.'
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor || state.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        const commitmentId = state.active_commitment;

        // 1. Capture evidence
        const evidenceId = generateId('mem');
        const captureOp: CaptureOperation = {
          id: evidenceId,
          op: 'capture',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            body: `Completed: ${summary}`,
            kind: 'evidence',
          },
        };
        appendOperation(workspacePath, captureOp);

        if (!json) console.log(`Evidence: ${evidenceId}`);

        // 2. Close with evidence
        const closeId = generateId('op');
        const closeOp: CloseOperation = {
          id: closeId,
          op: 'close',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            evidence: evidenceId,
          },
        };

        const validation = validateOperation(closeOp, [...ledger, captureOp], genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }
        appendOperation(workspacePath, closeOp);

        if (!json) console.log(`Closed: ${commitmentId}`);

        // 3. Clear state
        clearState();

        const result: TaskCompleteOutput = {
          commitment_id: commitmentId,
          evidence_id: evidenceId,
          closed: true,
        };

        if (!json) {
          console.log(`\nTask completed with evidence.`);
        }
        outputResult(result, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });

  // mentu task fail <reason>
  taskCmd
    .command('fail <reason>')
    .description('Fail a task: annotate error + release')
    .option('--actor <id>', 'Override actor identity')
    .action((reason: string, options: TaskOptions) => {
      const json = program.opts().json || false;

      try {
        const state = loadState();
        if (!state?.active_commitment) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            'No active task. Run "mentu task start" first.'
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const actor = resolveActor(options.actor || state.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);

        const commitmentId = state.active_commitment;

        // 1. Annotate with error
        const annotateId = generateId('op');
        const annotateOp: AnnotateOperation = {
          id: annotateId,
          op: 'annotate',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            target: commitmentId,
            body: `Task failed: ${reason}`,
            kind: 'error',
          },
        };
        appendOperation(workspacePath, annotateOp);

        if (!json) console.log(`Annotated error on ${commitmentId}`);

        // 2. Release claim
        const releaseId = generateId('op');
        const releaseOp: ReleaseOperation = {
          id: releaseId,
          op: 'release',
          ts: timestamp(),
          actor,
          workspace,
          payload: {
            commitment: commitmentId,
            reason,
          },
        };
        appendOperation(workspacePath, releaseOp);

        if (!json) console.log(`Released: ${commitmentId}`);

        // 3. Clear state
        clearState();

        const result: TaskFailOutput = {
          commitment_id: commitmentId,
          released: true,
          error_annotated: true,
        };

        if (!json) {
          console.log(`\nTask failed and released.`);
        }
        outputResult(result, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
