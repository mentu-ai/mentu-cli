import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const batchPrompt = {
  name: 'mentu_batch',
  description: 'Batch fix multiple Mentu bug tickets in a wave. Triage first, then fix top tickets sequentially with full evidence chain.',
  arguments: [
    {
      name: 'batch_size',
      description: 'Number of tickets to fix in this batch (default: 3)',
      required: false,
    },
    {
      name: 'dry_run',
      description: 'If "true", only triage without fixing',
      required: false,
    },
  ],
};

export function getBatchPrompt(args: Record<string, string | undefined>): GetPromptResult {
  const batchSize = args.batch_size || '3';
  const dryRun = args.dry_run === 'true';

  return {
    description: `Batch fix ${batchSize} Mentu tickets${dryRun ? ' (dry run)' : ''}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Run a batch fix wave for the top ${batchSize} Mentu bug tickets.${dryRun ? ' DRY RUN — triage only, do not fix.' : ''}

## Wave Pipeline

### Step 1: Triage
Use mentu_list_memories to fetch all memories.
Use mentu_list_commitments to check existing work.
Apply the 5-gate garbage filter:
- Gate 1: Body Coherence (< 20 chars = reject)
- Gate 2: Test Detection (test keywords = reject)
- Gate 3: Project Match (wrong domain = reject)
- Gate 4: Duplicate Collapse (same title + day = keep newest)
- Gate 5: Actionability (title-only = reject)

Score survivors and take top ${batchSize}.
${dryRun ? 'Present the triage dashboard and stop.' : ''}

${dryRun ? '' : `### Step 2: Per-Ticket Fix
For EACH ticket in order:
1. Investigate codebase (stack-aware search)
2. Create branch: \`git checkout -b fix/ticket-{short_id}\`
3. Create commitment: mentu_commit(body="Fix: {title}", source={mem_id})
4. Claim: mentu_claim(commitment={cmt_id})
5. Fix the bug (build after every step, one commit per step)
6. Capture progress: mentu_capture(kind="execution-progress")
7. Build verify: mentu_capture(kind="validation")
8. Return to main: \`git checkout main\`

### Step 3: Wave Wrap-up
1. Push all branches
2. Create PRs via \`gh pr create\`
3. Capture PR evidence: mentu_capture(kind="document")
4. Submit commitments: mentu_submit(commitment, evidence, summary)

### Step 4: Wave Summary
Present a markdown table:
| # | Ticket | Branch | Commitment | Tier | Status |
|---|--------|--------|------------|------|--------|`}

## Rules
1. Investigate before fixing
2. Build after EVERY step
3. Full evidence chain: commit → claim → steps → build → PR → submit
4. Skip already-committed tickets
5. Aggressive garbage filtering`,
        },
      },
    ],
  };
}
