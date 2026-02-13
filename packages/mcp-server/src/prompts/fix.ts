import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const fixPrompt = {
  name: 'mentu_fix',
  description: 'Investigate and fix a single Mentu bug ticket end-to-end: fetch ticket, investigate codebase, create branch + HANDOFF, fix the bug, push + PR, submit commitment.',
  arguments: [
    {
      name: 'memory_id',
      description: 'The memory ID (mem_xxx) of the bug to fix',
      required: true,
    },
  ],
};

export function getFixPrompt(args: Record<string, string | undefined>): GetPromptResult {
  const memId = args.memory_id || 'mem_xxx';

  return {
    description: `Fix bug ticket ${memId}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Fix the Mentu bug ticket: ${memId}

## Full Pipeline

### Phase 1: Fetch Ticket
Use mentu_list_memories or read the memory resource at mentu://memories/${memId} to get the bug details.
Extract: title, affected page, priority, description, expected vs actual, error messages.

### Phase 2: Investigate
Based on the bug description and affected page:
1. Search for the route/page component
2. Find related components and hooks
3. Check type definitions and utilities
4. Identify root cause

### Phase 3: Create Commitment
\`\`\`
mentu_commit: body="Fix: {title}", source="${memId}"
mentu_claim: commitment={cmt_id}
\`\`\`

### Phase 4: Create Branch
\`\`\`bash
git checkout -b fix/ticket-{short_id}
\`\`\`

### Phase 5: Fix the Bug
For each step:
1. Make code changes
2. Build and verify
3. Git commit: \`[Ticket-{short_id} Step N] description\`
4. Capture progress: mentu_capture with kind="execution-progress"

### Phase 6: Final Verification
Build verification: mentu_capture with kind="validation"

### Phase 7: Push + PR
\`\`\`bash
git push origin fix/ticket-{short_id} -u
gh pr create --title "Fix: {title}" ...
\`\`\`
Capture PR: mentu_capture with kind="document"

### Phase 8: Submit
mentu_submit: commitment={cmt_id}, evidence=[...], summary="Fixed: {title}"

## Rules
1. Investigate before fixing — read source files first
2. Build after EVERY step
3. One commit per step
4. Full evidence chain via Mentu tools`,
        },
      },
    ],
  };
}
