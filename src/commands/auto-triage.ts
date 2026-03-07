/**
 * Auto-Triage Command - Automated triage of untriaged memories
 *
 * Runs tier classification on untriaged memories, annotates them,
 * and optionally generates documentation.
 */

import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import type { Memory, AnnotateOperation } from '../types.js';
import { MentuError } from '../types.js';
import { generateId } from '../utils/id.js';
import { timestamp } from '../utils/time.js';
import { resolveActor } from '../utils/actor.js';
import { findWorkspace, readConfig, getWorkspaceName } from '../core/config.js';
import { readLedger, appendOperation } from '../core/ledger.js';
import { computeMemories, computeMemoryState } from '../core/state.js';
import { validateOperation } from '../core/validate.js';
import { readGenesisKey } from '../core/genesis.js';
import {
  triageMemory,
  getTriageConfig,
  type Tier,
  type ClassificationResult,
} from '../triage/classifier.js';
import { generateDocs, docsRequired } from '../triage/doc-generator.js';

interface AutoTriageOptions {
  dryRun?: boolean;
  limit?: number;
  verbose?: boolean;
  actor?: string;
}

interface TriageResultOutput {
  memory_id: string;
  tier: Tier;
  action: 'commit' | 'dismiss' | 'defer';
  reasoning: string;
  affected_paths: string[];
  docs_generated: string[];
}

interface AutoTriageOutput {
  triaged: number;
  dry_run: boolean;
  results: TriageResultOutput[];
  by_tier: {
    T1: number;
    T2: number;
    T3: number;
  };
  by_action: {
    commit: number;
    dismiss: number;
    defer: number;
  };
}

function outputResult(result: AutoTriageOutput, json: boolean, verbose: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\nTriaged ${result.triaged} memories${result.dry_run ? ' (dry run)' : ''}`);
    console.log(`  T1: ${result.by_tier.T1}`);
    console.log(`  T2: ${result.by_tier.T2}`);
    console.log(`  T3: ${result.by_tier.T3}`);
    console.log('');
    console.log('Actions:');
    console.log(`  commit:  ${result.by_action.commit}`);
    console.log(`  dismiss: ${result.by_action.dismiss}`);
    console.log(`  defer:   ${result.by_action.defer}`);

    if (verbose && result.results.length > 0) {
      console.log('\nDetails:');
      for (const r of result.results) {
        console.log(`\n  ${r.memory_id}`);
        console.log(`    Tier: ${r.tier}`);
        console.log(`    Action: ${r.action}`);
        console.log(`    Reason: ${r.reasoning}`);
        if (r.affected_paths.length > 0) {
          console.log(`    Paths: ${r.affected_paths.join(', ')}`);
        }
        if (r.docs_generated.length > 0) {
          console.log(`    Docs: ${r.docs_generated.join(', ')}`);
        }
      }
    }
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ...error.toJSON(), op: 'auto-triage' }));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

export function registerAutoTriageCommand(program: Command): void {
  program
    .command('auto-triage')
    .description('Run AI triage on untriaged memories')
    .option('--dry-run', 'Show classifications without making changes')
    .option('--limit <n>', 'Process at most N memories', parseInt)
    .option('--verbose', 'Show detailed reasoning')
    .option('--actor <id>', 'Override actor identity')
    .action(async (options: AutoTriageOptions) => {
      const json = program.opts().json || false;

      try {
        const workspacePath = findWorkspace(process.cwd());
        const config = readConfig(workspacePath);
        const genesis = readGenesisKey(workspacePath);
        const triageConfig = getTriageConfig();
        const actor = options.actor
          ? resolveActor(options.actor, config ?? undefined)
          : triageConfig.aiAgent?.actor || resolveActor(undefined, config ?? undefined);
        const workspace = getWorkspaceName(workspacePath);
        const ledger = readLedger(workspacePath);

        // Get all memories and filter to untriaged
        const memories = computeMemories(ledger);
        let untriaged = memories.filter(m => computeMemoryState(ledger, m.id) === 'untriaged');

        if (options.limit && options.limit > 0) {
          untriaged = untriaged.slice(0, options.limit);
        }

        if (untriaged.length === 0) {
          const result: AutoTriageOutput = {
            triaged: 0,
            dry_run: options.dryRun || false,
            results: [],
            by_tier: { T1: 0, T2: 0, T3: 0 },
            by_action: { commit: 0, dismiss: 0, defer: 0 },
          };
          outputResult(result, json, options.verbose || false);
          return;
        }

        const results: TriageResultOutput[] = [];
        const byTier = { T1: 0, T2: 0, T3: 0 };
        const byAction = { commit: 0, dismiss: 0, defer: 0 };

        for (const memory of untriaged) {
          const triageResult = triageMemory(memory);

          // Track stats
          byTier[triageResult.tier]++;
          byAction[triageResult.action]++;

          const resultOutput: TriageResultOutput = {
            memory_id: memory.id,
            tier: triageResult.tier,
            action: triageResult.action,
            reasoning: triageResult.reasoning,
            affected_paths: triageResult.affected_paths,
            docs_generated: [],
          };

          if (options.verbose && !json) {
            console.log(`\nMemory: ${memory.id}`);
            console.log(`  Body: ${memory.body.substring(0, 80)}${memory.body.length > 80 ? '...' : ''}`);
            console.log(`  Tier: ${triageResult.tier}`);
            console.log(`  Reason: ${triageResult.reasoning}`);
            console.log(`  Action: ${triageResult.action}`);
            if (triageResult.affected_paths.length > 0) {
              console.log(`  Paths: ${triageResult.affected_paths.join(', ')}`);
            }
          }

          if (!options.dryRun) {
            // Annotate memory with classification
            const annotateOp: AnnotateOperation = {
              id: generateId('op'),
              op: 'annotate',
              ts: timestamp(),
              actor,
              workspace,
              payload: {
                target: memory.id,
                body: `Triage: ${triageResult.tier} - ${triageResult.reasoning}`,
                kind: 'triage-classification',
                meta: {
                  tier: triageResult.tier,
                  action: triageResult.action,
                  pattern: triageResult.matching_pattern,
                  suggested_docs: triageResult.suggested_docs,
                },
              },
            };

            const annotateValidation = validateOperation(annotateOp, ledger, genesis);
            if (annotateValidation.valid) {
              appendOperation(workspacePath, annotateOp);
            }

            // Generate docs for T2/T3 if action is commit
            if (triageResult.action === 'commit' && docsRequired(triageResult.tier, triageConfig.requireDocsTiers)) {
              const classification: ClassificationResult = {
                tier: triageResult.tier,
                reason: triageResult.reasoning,
                matched_pattern: triageResult.matching_pattern || undefined,
                confidence: triageResult.matching_pattern ? 'high' : 'low',
              };

              const docs = generateDocs(memory, classification, 'cmt_pending');

              // Write docs to filesystem
              const docsDir = path.join(workspacePath, 'docs');
              if (!fs.existsSync(docsDir)) {
                fs.mkdirSync(docsDir, { recursive: true });
              }

              fs.writeFileSync(path.join(workspacePath, docs.prd.path), docs.prd.content);
              fs.writeFileSync(path.join(workspacePath, docs.handoff.path), docs.handoff.content);

              resultOutput.docs_generated = [docs.prd.path, docs.handoff.path];

              if (!json) {
                console.log(`  Generated: ${docs.prd.path}`);
                console.log(`  Generated: ${docs.handoff.path}`);
              }
            }

            // Handle dismiss action
            if (triageResult.action === 'dismiss') {
              // Note: We just annotate here. The dismiss operation would need
              // to be triggered separately if needed, as auto-triage is advisory.
              if (!json && options.verbose) {
                console.log(`  Note: Memory marked for dismissal. Run 'mentu dismiss ${memory.id} --reason "..."' to confirm.`);
              }
            }
          }

          results.push(resultOutput);
        }

        const output: AutoTriageOutput = {
          triaged: results.length,
          dry_run: options.dryRun || false,
          results,
          by_tier: byTier,
          by_action: byAction,
        };

        outputResult(output, json, options.verbose || false);
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
