import type { Command } from 'commander';
import type { AnnotateOperation, ExternalRef } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { commitmentExists } from '../core/state.js';
import { hasExternalRef } from '../core/external.js';
import { readGenesisKey } from '../core/genesis.js';
import { validateOperation } from '../core/validate.js';
import { GitHubClient, buildGitHubConfig } from '../integrations/github/index.js';

interface LinkOptions {
  github?: string;
  actor?: string;
}

interface LinkOutput {
  id: string;
  op: 'annotate';
  commitment: string;
  external_ref: ExternalRef;
}

function outputResult(result: LinkOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Linked commitment ${result.commitment} to GitHub issue #${result.external_ref.id}`);
    console.log(`URL: ${result.external_ref.url}`);
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'link' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerGitHubLinkCommand(program: Command): void {
  program
    .command('github-link <commitment>')
    .description('Link a commitment to a GitHub issue')
    .option('--github <issue_number>', 'GitHub issue number to link')
    .option('--actor <id>', 'Override actor identity')
    .action(async (commitmentId: string, options: LinkOptions) => {
      const json = program.opts().json || false;

      try {
        if (!options.github) {
          throw new MentuError(
            'E_MISSING_FIELD',
            'Must specify --github <issue_number>',
            { field: 'github' }
          );
        }

        const issueNumber = parseInt(options.github, 10);
        if (isNaN(issueNumber) || issueNumber <= 0) {
          throw new MentuError(
            'E_INVALID_OP',
            'Invalid issue number',
            { value: options.github }
          );
        }

        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const actor = resolveActor(options.actor, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Validate commitment exists
        if (!commitmentExists(ledger, commitmentId)) {
          throw new MentuError(
            'E_REF_NOT_FOUND',
            `Commitment ${commitmentId} does not exist`,
            { field: 'commitment', value: commitmentId }
          );
        }

        // Check if already linked to GitHub
        if (hasExternalRef(ledger, commitmentId, 'github')) {
          throw new MentuError(
            'E_EXTERNAL_REF_EXISTS',
            `Commitment ${commitmentId} is already linked to a GitHub issue`,
            { commitment: commitmentId, system: 'github' }
          );
        }

        // Build GitHub config from env
        const githubConfig = buildGitHubConfig(config?.integrations?.github);
        if (!githubConfig) {
          throw new MentuError(
            'E_GITHUB_NOT_CONFIGURED',
            'GitHub integration not configured. Set GITHUB_ENABLED=true, GITHUB_OWNER, and GITHUB_REPO'
          );
        }

        // Validate issue exists on GitHub
        const client = new GitHubClient(githubConfig);
        const issue = await client.getIssue(issueNumber);

        // Create external ref
        const externalRef: ExternalRef = {
          system: 'github',
          type: 'issue',
          id: String(issueNumber),
          url: issue.html_url,
          synced_at: timestamp(),
        };

        const id = generateId('op');
        const ts = timestamp();

        const operation: AnnotateOperation = {
          id,
          op: 'annotate',
          ts,
          actor,
          workspace,
          payload: {
            target: commitmentId,
            body: `Linked to GitHub issue #${issueNumber}`,
            meta: {
              kind: 'external_ref',
              external_ref: externalRef,
            },
          },
        };

        // Validate with Genesis Key
        const validation = validateOperation(operation, ledger, genesis);
        if (!validation.valid && validation.error) {
          throw validation.error;
        }

        appendOperation(workspacePath, operation);

        const result: LinkOutput = {
          id,
          op: 'annotate',
          commitment: commitmentId,
          external_ref: externalRef,
        };

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
