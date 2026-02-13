# Proposed Updates to Workspaces CLAUDE.md

**Author**: agent:claude-meta-layer
**Date**: 2026-01-01
**Status**: DRAFT - Requires human review

---

## Summary

This document proposes additions to `/Users/rashid/Desktop/Workspaces/CLAUDE.md` to reflect the meta-layer initialization and provide agents with manifest-aware instructions.

---

## Proposed Additions

### Add to "Repositories Under Governance" Table

Update the table to reflect .mentu status after deployment:

```markdown
| Repository | Purpose | Has .mentu |
|------------|---------|------------|
| `mentu-ai` | Core ledger, CLI, temporal primitives | ✅ |
| `mentu-bridge` | Mac daemon for 24/7 execution | ✅ (v1.0.0) |
| `mentu-proxy` | Cloudflare Worker gateway | ✅ (v1.0.0) |
| `mentu-web` | Next.js dashboard | ✅ (v0.1.0) |
| `claude-code` | Claude Code extensions and tools | ✅ (v1.0.0) |
| `projects` | Active project workspaces | ❌ |
| `archive` | Historical/deprecated code | ❌ |
```

---

### Add New Section: "Manifest Discovery Protocol"

Insert after "Rule 3: Read Context Before Acting":

```markdown
---

## Manifest Discovery Protocol

When an agent enters a repository:

### Step 1: Check for Manifest

```bash
cat <repo>/.mentu/manifest.yaml 2>/dev/null
```

### Step 2: Parse Identity

If manifest exists, extract:
- `name`: Repository identifier
- `description`: What it does
- `version`: Current version
- `capabilities`: What operations are available
- `dependencies`: Other repos it connects to
- `mentu.actor`: Default actor identity

### Step 3: Understand Context

Before performing operations, the agent now knows:
- Repository purpose without reading source code
- Available capabilities and how to invoke them
- Which other repos this depends on
- Correct actor identity for Mentu operations

### Example

```yaml
# From mentu-bridge/.mentu/manifest.yaml
name: mentu-bridge
description: Terminal bridge daemon for Mentu
capabilities:
  - name: execute-command
    description: Execute an agent command locally
  - name: capture-memory
    description: Capture a Mentu memory
dependencies:
  - name: mentu-ai
    relationship: api-client
```

Agent now understands: "This is the bridge daemon. I can execute commands and capture memories. It talks to mentu-ai."

---
```

---

### Add New Section: "Capability Invocation"

Insert after "Manifest Discovery Protocol":

```markdown
---

## Capability Invocation

### Direct Command Invocation

When a manifest capability has a `command` field, invoke directly:

```bash
# From manifest:
#   - name: capture-memory
#     command: tools/capture-memory.sh

cd claude-code
tools/capture-memory.sh "Task complete"
```

### HTTP Endpoint Invocation

When capability is an HTTP endpoint:

```bash
# From manifest:
#   - name: route-ops
#     command: POST /ops

curl -X POST https://mentu-proxy.affihub.workers.dev/ops \
  -H "X-Proxy-Token: $TOKEN" \
  -d '{"op": "capture", "body": "...", "kind": "task"}'
```

### Internal Capabilities

Capabilities marked `(internal)` are triggered by the system, not directly invoked:

```yaml
- name: poll-commitments
  command: (internal) - scheduler polling loop
```

These document behavior but aren't directly callable.

---
```

---

### Update "Quick Reference" Table

Add new commands:

```markdown
| Action | Command |
|--------|---------|
| Check ecosystem status | `ls -la */.mentu 2>/dev/null` |
| Read repo identity | `cat <repo>/.mentu/manifest.yaml` |
| See all commitments | `cd mentu-ai && mentu status --all` |
| Craft a PRD | `/craft <FeatureName>` |
| **List all capabilities** | `grep -h "^  - name:" */.mentu/manifest.yaml` |
| **Check repo version** | `grep "^version:" <repo>/.mentu/manifest.yaml` |
| **Find capability** | `grep -l "name: <capability>" */.mentu/manifest.yaml` |
```

---

## Deployment Instructions

After human review and approval:

1. **Deploy manifests to repositories**:
   ```bash
   # For each repo:
   mkdir -p <repo>/.mentu
   cp mentu-ai/docs/drafts/manifest-<repo>.yaml <repo>/.mentu/manifest.yaml
   ```

2. **Update CLAUDE.md**:
   Apply the proposed additions above to `/Users/rashid/Desktop/Workspaces/CLAUDE.md`

3. **Commit changes**:
   ```bash
   cd /Users/rashid/Desktop/Workspaces
   git add -A
   git commit -m "feat: add meta-layer manifests to ecosystem repos"
   ```

---

## Verification

After deployment:

```bash
# Verify all manifests exist
for repo in mentu-bridge mentu-proxy mentu-web claude-code; do
  echo "=== $repo ==="
  cat $repo/.mentu/manifest.yaml | head -5
done

# Verify mentu-ai unchanged
ls -la mentu-ai/.mentu/
# Should show original files: ledger.jsonl, manifest.yaml, genesis.key, etc.
```

---

*This proposal completes the Workspace Meta-Layer v1.0 specification.*
