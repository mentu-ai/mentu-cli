---
title: "BugReporter SDK"
description: "TypeScript SDK for capturing bug reports and sending them to the Mentu ledger, with support for screenshots, console errors, and browser metadata."
---

The `BugReporter` class is a TypeScript SDK that captures bug reports from your application and sends them to Mentu as memories. It handles evidence collection (screenshots, console errors, page context) and provides methods for tracking fix progress.

## Installation

BugReporter is included in the main `mentu` package:

```bash
npm install mentu
```

```ts
import { BugReporter } from 'mentu';
```

## Configuration

Create a BugReporter instance with your workspace credentials:

```ts
const reporter = new BugReporter({
  apiUrl: 'https://mentu-proxy.affihub.workers.dev/ops',
  apiToken: 'your-api-token',
  workspaceId: 'your-workspace-id',
  projectDomains: ['app.example.com', 'staging.example.com'],
});
```

### Configuration Options

| Option | Type | Required | Description |
|---|---|---|---|
| `apiUrl` | `string` | Yes | The Mentu proxy API endpoint. |
| `apiToken` | `string` | Yes | Your workspace API token. |
| `workspaceId` | `string` | Yes | The UUID of your Mentu workspace. |
| `projectDomains` | `string[]` | No | Domains associated with this project. Used for the Project Match gate in triage. |

## Methods

### `report(body, options?)`

Capture a bug memory and send it to Mentu.

```ts
const memory = await reporter.report(
  'The login form rejects valid emails containing a + character',
  {
    severity: 'high',
    page: '/login',
    meta: {
      screenshot: screenshotBase64,
      consoleErrors: ['Uncaught TypeError: email.match is not a function'],
      userAgent: navigator.userAgent,
      url: window.location.href,
    },
  }
);

console.log(memory.id); // "mem_a8f3c21d..."
```

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `body` | `string` | Yes | The bug description. Should include reproduction steps and expected vs. actual behavior. |
| `options.severity` | `'low' \| 'medium' \| 'high' \| 'critical'` | No | Bug severity. Affects triage scoring. Defaults to `'medium'`. |
| `options.page` | `string` | No | The page or route where the bug occurred. |
| `options.tags` | `string[]` | No | Tags for categorization (e.g., `['ui', 'auth', 'mobile']`). |
| `options.meta` | `object` | No | Arbitrary metadata object. See [Auto-Capture](#auto-capture) for common fields. |

#### Returns

```ts
interface BugMemory {
  id: string;           // Mentu memory ID (e.g., "mem_a8f3c21d...")
  workspaceId: string;  // Workspace where the memory was created
  createdAt: string;    // ISO 8601 timestamp
  status: string;       // "open"
}
```

### `getStatus()`

Get the current pipeline status for the workspace.

```ts
const status = await reporter.getStatus();

console.log(status.open);    // 3
console.log(status.claimed); // 1
console.log(status.closed);  // 27
```

#### Returns

```ts
interface PipelineStatus {
  open: number;       // Memories not yet committed
  claimed: number;    // Commitments currently being worked on
  closed: number;     // Commitments completed (pass or fail)
  throughput: number; // Fixes per day (7-day rolling average)
}
```

### `waitForCompletion(commitmentId, timeout?)`

Poll a commitment until it reaches a terminal state (`pass` or `fail`). Useful for integrations that need to block until a fix is shipped.

```ts
const result = await reporter.waitForCompletion('cmt_x9y8z7', 300000);

if (result.status === 'pass') {
  console.log('Fix shipped:', result.evidence.pr.url);
} else {
  console.log('Fix failed:', result.reason);
}
```

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `commitmentId` | `string` | Yes | The Mentu commitment ID to watch. |
| `timeout` | `number` | No | Maximum wait time in milliseconds. Defaults to `600000` (10 minutes). |

#### Returns

```ts
interface CompletionResult {
  status: 'pass' | 'fail';
  commitmentId: string;
  evidence: {
    pr?: { url: string; number: number };
    build?: { exitCode: number; durationMs: number };
    review?: { verdict: string; passes: number };
  };
  reason?: string;        // Present when status is 'fail'
  closedAt: string;       // ISO 8601 timestamp
  totalDurationMs: number;
}
```

Throws a `TimeoutError` if the commitment does not close within the timeout period.

## Usage in React

```tsx
import { BugReporter } from 'mentu';
import { useRef, useCallback } from 'react';

const reporter = new BugReporter({
  apiUrl: import.meta.env.VITE_MENTU_API_URL,
  apiToken: import.meta.env.VITE_MENTU_API_TOKEN,
  workspaceId: import.meta.env.VITE_MENTU_WORKSPACE_ID,
});

function BugReportButton() {
  const handleReport = useCallback(async () => {
    const description = prompt('Describe the bug:');
    if (!description) return;

    try {
      const memory = await reporter.report(description, {
        page: window.location.pathname,
        meta: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          consoleErrors: getRecentConsoleErrors(),
          timestamp: new Date().toISOString(),
        },
      });
      alert(`Bug reported: ${memory.id}`);
    } catch (err) {
      console.error('Failed to report bug:', err);
    }
  }, []);

  return <button onClick={handleReport}>Report Bug</button>;
}
```

## Usage in Node.js

```ts
import { BugReporter } from 'mentu';

const reporter = new BugReporter({
  apiUrl: process.env.MENTU_API_URL!,
  apiToken: process.env.MENTU_API_TOKEN!,
  workspaceId: process.env.MENTU_WORKSPACE_ID!,
});

// Report a bug from a server-side error handler
app.use((err, req, res, next) => {
  reporter.report(`Server error: ${err.message}`, {
    severity: 'high',
    page: req.originalUrl,
    meta: {
      stack: err.stack,
      method: req.method,
      statusCode: err.statusCode || 500,
      userId: req.user?.id,
    },
  }).catch(console.error); // fire-and-forget

  next(err);
});
```

## Auto-Capture

The `meta` field on the `options` parameter is a freeform object. The following fields are recognized by the triage garbage filter and can improve scoring:

| Meta Field | Type | Description |
|---|---|---|
| `screenshot` | `string` | Base64-encoded screenshot of the page at the time of the bug. |
| `consoleErrors` | `string[]` | Recent console.error messages captured from the browser. |
| `url` | `string` | Full URL where the bug was observed (including query params). |
| `userAgent` | `string` | Browser user-agent string. |
| `viewport` | `{ width: number, height: number }` | Browser viewport dimensions. |
| `timestamp` | `string` | ISO 8601 timestamp of when the bug was observed. |
| `userId` | `string` | Authenticated user ID (for correlating with server logs). |
| `stack` | `string` | JavaScript stack trace if the bug triggered an exception. |
| `networkErrors` | `object[]` | Failed HTTP requests captured around the time of the bug. |

These fields are optional. The BugReporter sends whatever you include — the triage agent uses recognized fields to improve filtering accuracy.
