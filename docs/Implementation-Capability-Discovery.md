---
id: Implementation-Capability-Discovery-v1.0
path: docs/Implementation-Capability-Discovery.md
type: reference
intent: reference
version: "1.0"
created: 2025-12-30
last_updated: 2025-12-30
mentu:
  evidence: mem_bb2d37ea
  status: reviewed
---

# Capability Discovery Implementation

Reference implementation for the capability discovery system. Reviewed and approved.

**Review Verdict**: PASS (mem_bb2d37ea)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAPABILITY DISCOVERY FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Repo                    Bridge                  Supabase          Claude   │
│   ────                    ──────                  ────────          ──────   │
│                                                                              │
│   .mentu/manifest.yaml                                                       │
│        │                                                                     │
│        └──────────────► scanWorkspaces()                                    │
│                              │                                               │
│                              └────────► reportCapabilities()                │
│                                              │                               │
│                                              └────────► machine_capabilities│
│                                                              │               │
│                                              GET /capabilities ◄─────────────┘
│                                                              │               │
│                                                              └──► Query      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## TypeScript Types

### Manifest Schema

```typescript
// mentu-bridge/src/types/manifest.ts

export interface ManifestInput {
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface ManifestOutput {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
}

export interface Capability {
  name: string;
  description: string;
  command: string;
  inputs?: Record<string, ManifestInput>;
  outputs?: Record<string, ManifestOutput>;
}

export interface RepoManifest {
  name: string;
  description: string;
  version: string;
  capabilities: Capability[];
}

export interface DiscoveredWorkspace {
  path: string;
  name: string;
  description: string;
  version: string;
  capabilities: Capability[];
  discovered_at: string;
}

export interface MachineCapabilities {
  machine_id: string;
  machine_name: string;
  workspace_id: string;
  online: boolean;
  last_seen: string;
  workspaces: DiscoveredWorkspace[];
}
```

---

## Capability Scanner

```typescript
// mentu-bridge/src/capabilities/scanner.ts

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { RepoManifest, DiscoveredWorkspace } from '../types/manifest';

const MANIFEST_PATHS = [
  '.mentu/manifest.yaml',
  '.mentu/manifest.yml',
  '.claude/manifest.yaml',
  'CLAUDE.md'  // Fallback: parse capabilities from CLAUDE.md
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(repoPath: string): Promise<RepoManifest | null> {
  // Try each manifest path
  for (const manifestPath of MANIFEST_PATHS) {
    const fullPath = join(repoPath, manifestPath);

    if (await fileExists(fullPath)) {
      try {
        const content = await readFile(fullPath, 'utf-8');

        // Handle CLAUDE.md separately (extract capabilities section)
        if (manifestPath === 'CLAUDE.md') {
          return parseClaudeMd(content, repoPath);
        }

        const manifest = parseYaml(content) as RepoManifest;

        // Validate required fields
        if (manifest.name && manifest.capabilities) {
          return manifest;
        }
      } catch (err) {
        console.error(`Failed to parse ${fullPath}:`, err);
      }
    }
  }

  return null;
}

function parseClaudeMd(content: string, repoPath: string): RepoManifest | null {
  // Extract name from first heading
  const nameMatch = content.match(/^#\s+(.+)$/m);
  const name = nameMatch ? nameMatch[1] : repoPath.split('/').pop() || 'unknown';

  // Extract capabilities from ## Capabilities section
  const capabilitiesMatch = content.match(/##\s+Capabilities\s*\n([\s\S]*?)(?=\n##|$)/i);

  if (!capabilitiesMatch) {
    return null;
  }

  const capabilities: RepoManifest['capabilities'] = [];
  const lines = capabilitiesMatch[1].split('\n');

  for (const line of lines) {
    // Match: - `command args` - description
    const match = line.match(/^[-*]\s+`([^`]+)`\s*[-–—]?\s*(.*)$/);
    if (match) {
      const [, command, description] = match;
      const name = command.split(' ')[0];
      capabilities.push({
        name,
        description: description || `Run ${name}`,
        command
      });
    }
  }

  if (capabilities.length === 0) {
    return null;
  }

  return {
    name,
    description: `Capabilities from ${name}`,
    version: '1.0.0',
    capabilities
  };
}

export async function scanWorkspaces(
  allowedDirectories: string[]
): Promise<DiscoveredWorkspace[]> {
  const workspaces: DiscoveredWorkspace[] = [];

  for (const dir of allowedDirectories) {
    const { readdir } = await import('fs/promises');

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;

        const repoPath = join(dir, entry.name);
        const manifest = await readManifest(repoPath);

        if (manifest) {
          workspaces.push({
            path: repoPath,
            name: manifest.name,
            description: manifest.description,
            version: manifest.version,
            capabilities: manifest.capabilities,
            discovered_at: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error(`Failed to scan ${dir}:`, err);
    }
  }

  return workspaces;
}
```

---

## Capability Reporter

```typescript
// mentu-bridge/src/capabilities/reporter.ts

import { createClient } from '@supabase/supabase-js';
import { MachineCapabilities, DiscoveredWorkspace } from '../types/manifest';
import { scanWorkspaces } from './scanner';
import { config } from '../config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

let currentCapabilities: DiscoveredWorkspace[] = [];

export async function reportCapabilities(): Promise<void> {
  try {
    const workspaces = await scanWorkspaces(config.execution.allowed_directories);

    const payload: MachineCapabilities = {
      machine_id: config.machine.id,
      machine_name: config.machine.name,
      workspace_id: config.workspace.id,
      online: true,
      last_seen: new Date().toISOString(),
      workspaces
    };

    const { error } = await supabase
      .from('machine_capabilities')
      .upsert(payload, { onConflict: 'machine_id,workspace_id' });

    if (error) {
      console.error('Failed to report capabilities:', error);
    } else {
      console.log(`Reported ${workspaces.length} workspace(s) with capabilities`);
      currentCapabilities = workspaces;
    }
  } catch (err) {
    console.error('Capability scan failed:', err);
    // Don't update Supabase on scan failure - preserve last known state
  }
}

export async function reportOffline(): Promise<void> {
  await supabase
    .from('machine_capabilities')
    .update({ online: false, last_seen: new Date().toISOString() })
    .eq('machine_id', config.machine.id)
    .eq('workspace_id', config.workspace.id);
}

export function getCurrentCapabilities(): DiscoveredWorkspace[] {
  return currentCapabilities;
}

// Periodic refresh (every 5 minutes)
export function startCapabilityReporter(): void {
  // Initial report
  reportCapabilities();

  // Periodic refresh
  setInterval(reportCapabilities, 5 * 60 * 1000);

  // Report offline on exit
  process.on('SIGINT', async () => {
    await reportOffline();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await reportOffline();
    process.exit(0);
  });
}
```

---

## Bridge Integration

```typescript
// mentu-bridge/src/index.ts

import { startCapabilityReporter } from './capabilities/reporter';
import { startCommandListener } from './commands/listener';

async function main() {
  console.log('Mentu Bridge starting...');

  // Start capability discovery and reporting
  startCapabilityReporter();

  // Start command listener (existing)
  await startCommandListener();

  console.log('Mentu Bridge running');
}

main().catch(console.error);
```

---

## Proxy Capabilities Endpoint

```typescript
// mentu-proxy/src/routes/capabilities.ts

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();

app.get('/capabilities', async (c) => {
  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );

  const workspaceId = c.env.WORKSPACE_ID;

  const { data, error } = await supabase
    .from('machine_capabilities')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error) {
    return c.json({ error: 'Failed to fetch capabilities' }, 500);
  }

  // Aggregate capabilities from all machines
  const machines = data || [];
  const online = machines.filter(m => m.online);
  const offline = machines.filter(m => !m.online);

  // Flatten all capabilities with source info
  const allCapabilities = online.flatMap(m =>
    m.workspaces.flatMap(w =>
      w.capabilities.map(cap => ({
        ...cap,
        workspace: w.name,
        workspace_path: w.path,
        machine: m.machine_name,
        machine_id: m.machine_id
      }))
    )
  );

  return c.json({
    available: online.length > 0,
    machines: {
      online: online.map(m => ({
        id: m.machine_id,
        name: m.machine_name,
        last_seen: m.last_seen,
        workspaces: m.workspaces.length
      })),
      offline: offline.map(m => ({
        id: m.machine_id,
        name: m.machine_name,
        last_seen: m.last_seen
      }))
    },
    capabilities: allCapabilities,
    total: allCapabilities.length
  });
});

// Get capabilities for specific workspace
app.get('/capabilities/:workspace', async (c) => {
  const workspaceName = c.req.param('workspace');

  // Input validation
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceName)) {
    return c.json({ error: 'Invalid workspace name' }, 400);
  }

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );

  const { data } = await supabase
    .from('machine_capabilities')
    .select('*')
    .eq('workspace_id', c.env.WORKSPACE_ID)
    .eq('online', true);

  const machines = data || [];

  for (const machine of machines) {
    const workspace = machine.workspaces.find(w => w.name === workspaceName);
    if (workspace) {
      return c.json({
        ...workspace,
        machine: machine.machine_name,
        machine_id: machine.machine_id,
        online: true
      });
    }
  }

  return c.json({ error: 'Workspace not found or offline' }, 404);
});

export default app;
```

---

## Supabase Schema

```sql
-- Create machine_capabilities table

CREATE TABLE machine_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id TEXT NOT NULL,
  machine_name TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  online BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT now(),
  workspaces JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(machine_id, workspace_id)
);

-- Index for quick lookups
CREATE INDEX idx_capabilities_workspace ON machine_capabilities(workspace_id);
CREATE INDEX idx_capabilities_online ON machine_capabilities(online);

-- Auto-update updated_at
CREATE TRIGGER update_machine_capabilities_updated_at
  BEFORE UPDATE ON machine_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for capability changes
ALTER PUBLICATION supabase_realtime ADD TABLE machine_capabilities;
```

---

## Example Manifest

```yaml
# .mentu/manifest.yaml

name: mentu-ai
description: Accountability ledger for AI agent commitments
version: 1.0.0

capabilities:
  - name: capture
    description: Record an observation or piece of evidence
    command: mentu capture "{body}" --kind {kind} --actor {actor}
    inputs:
      body:
        type: string
        required: true
        description: What was observed
      kind:
        type: string
        default: observation
        description: Type of memory (observation, evidence, task)
      actor:
        type: string
        default: $MENTU_ACTOR

  - name: commit
    description: Create a commitment from a memory
    command: mentu commit "{body}" --source {source_id} --actor {actor}
    inputs:
      body:
        type: string
        required: true
      source_id:
        type: string
        required: true
        description: Memory ID that originated this commitment

  - name: claim
    description: Take responsibility for a commitment
    command: mentu claim {commitment_id} --actor {actor}
    inputs:
      commitment_id:
        type: string
        required: true

  - name: submit
    description: Submit commitment for review with evidence
    command: mentu submit {commitment_id} --summary "{summary}" --include-files
    inputs:
      commitment_id:
        type: string
        required: true
      summary:
        type: string
        required: true

  - name: status
    description: Show current commitment status
    command: mentu status --json
    outputs:
      open:
        type: array
      claimed:
        type: array
      in_review:
        type: array
      closed:
        type: array
```

---

## Review Notes

**Improvements Applied:**
- Added try/catch in `reportCapabilities()` for error recovery
- Added input validation on workspace parameter
- Error recovery preserves last known state on scan failure

**Future Considerations:**
- Add rate limiting/caching on `/capabilities` endpoint
- Add stale detection (mark offline after 15min without heartbeat)
- Add schema versioning for manifest format migrations

---

*Capability discovery enables Claude to know what's available before execution.*
