import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export const triagePrompt = {
  name: 'mentu_triage',
  description: 'Triage bug memories using the 5-gate garbage filter. Fetches untriaged memories, scores survivors, and presents an actionable dashboard.',
  arguments: [
    {
      name: 'project_name',
      description: 'Project name for domain matching (Gate 3)',
      required: false,
    },
    {
      name: 'batch_size',
      description: 'Maximum number of tickets to show (default: 10)',
      required: false,
    },
  ],
};

export function getTriagePrompt(args: Record<string, string | undefined>): GetPromptResult {
  const project = args.project_name || 'this project';
  const batchSize = args.batch_size || '10';

  return {
    description: `Triage Mentu bug memories for ${project}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are triaging bug reports for "${project}". Follow the Mentu 5-gate garbage filter.

## Instructions

1. **Fetch data** using mentu_list_memories and mentu_list_commitments tools
2. **Apply 5-gate filter** to each memory:
   - Gate 1: Body Coherence — reject if < 20 chars or gibberish
   - Gate 2: Test Detection — reject test submissions ("test", "prueba", "E2E", etc.)
   - Gate 3: Project Match — reject if page_url domain doesn't match "${project}" or localhost
   - Gate 4: Duplicate Collapse — same title + same day = keep newest
   - Gate 5: Actionability — reject title-only with no description
3. **Skip** memories that already have commitments
4. **Score survivors**: score = priority_weight × age_factor × description_quality × scope_estimate
5. **Take top ${batchSize}** by score
6. **Present dashboard** as a markdown table with columns: #, ID, Priority, Score, Title, Page, Status

For each filtered-out memory, track the rejection gate and reason.

## Output Format

\`\`\`markdown
# Triage Dashboard — {today's date}

## Actionable ({count})
| # | ID | Priority | Score | Title | Status |
|---|-----|----------|-------|-------|--------|

## Filtered Out ({count})
- {N} test/junk tickets
- {N} duplicates collapsed
- {N} wrong-project
- {N} low-actionability

## Suggested Next
-> Use mentu_commit to create commitments for the top tickets
\`\`\`

Use mentu_dismiss for clearly junk memories (with reason).
Use mentu_triage to record the triage session when done.`,
        },
      },
    ],
  };
}
