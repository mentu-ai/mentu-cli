# Kanban Bug Indicator - mentu-web Changes

This document specifies the required changes in mentu-web to display bug report indicators on the Kanban board.

## Required Changes

### 1. Update useCommitments hook

Add `isBugReport` derived field:

```typescript
// In src/hooks/useCommitments.ts
const commitments = operations
  .filter(op => op.kind === 'commit')
  .map(op => {
    // Find source memory to check if it's a bug report
    const sourceMemory = operations.find(m => m.id === op.payload?.source);
    const isBugReport = sourceMemory?.kind === 'bug_report' ||
                        sourceMemory?.payload?.kind === 'bug_report';

    return {
      ...op,
      isBugReport,
    };
  });
```

### 2. Update CommitmentCard component

Add bug indicator styling:

```typescript
// In src/components/commitment/commitment-card.tsx
import { Bug } from 'lucide-react';

// In the component
{commitment.isBugReport && (
  <div className="flex items-center gap-1">
    <Bug className="h-4 w-4 text-red-500" />
    <Badge variant="destructive" className="text-[10px]">Bug</Badge>
  </div>
)}

// Add border styling
<Card className={cn(
  "...",
  commitment.isBugReport && "border-l-4 border-l-red-500"
)}>
```

### 3. Link to Bug Reports Detail

When clicking a bug commitment, navigate to Bug Reports detail:

```typescript
const handleClick = () => {
  if (commitment.isBugReport && commitment.sourceMemoryId) {
    router.push(`/workspace/${workspace}/${plane}/bug-reports/${commitment.sourceMemoryId}`);
  } else {
    // existing behavior
  }
};
```

## Visual Design

### Bug Commitment Card

```
┌─────────────────────────────────────┐
│ ▌ 🐛 Bug  [critical]                │ ← Red left border + bug icon
│                                     │
│ Login fails with error 500          │
│                                     │
│ Source: WarrantyOS                  │
│ Workflow: running                   │
│                                     │
│ ○ claimed                           │
└─────────────────────────────────────┘
```

### Severity Badge Colors

| Severity | Background | Text |
|----------|------------|------|
| critical | red-600 | white |
| high | orange-500 | white |
| medium | yellow-500 | black |
| low | gray-400 | black |

## Data Requirements

The commitment card needs access to:

1. `commitment.payload.source` - Memory ID
2. Source memory's `kind` field - Should be `bug_report`
3. Source memory's `payload.severity` - For badge
4. Source memory's `payload.source` - External system name

## Implementation Notes

1. The source memory lookup can be done in the useCommitments hook by joining with memories
2. Consider caching memory lookups for performance
3. Bug report detail view should exist at `/bug-reports/:memoryId`

## Related Components

- `src/components/commitment/commitment-card.tsx` - Card display
- `src/hooks/useCommitments.ts` - Data fetching
- `src/app/workspace/[workspace]/[plane]/bug-reports/page.tsx` - Bug list view
- `src/app/workspace/[workspace]/[plane]/bug-reports/[id]/page.tsx` - Bug detail view
