---
name: craft
description: Create PRD -> HANDOFF -> PROMPT -> RESULT document chain for a feature with Mentu commitment tracking.
---

Create a complete document chain (PRD -> HANDOFF -> PROMPT -> RESULT) for a feature, commit to Mentu, and generate a launch-ready prompt.

---

## Configuration

Read runtime config from `.mentu/manifest.yaml`:
- `actor` — agent identity
- `workspace` — Mentu workspace ID
- `build_cmd` — build command
- `test_cmd` — test command
- `token_env_var` — env var name for API token
- `workspace_env_var` — env var name for workspace ID
- `dev_port` — dev server port

Read credentials from `.env` using the env var names from manifest:
```bash
TOKEN_VAR=$(grep '^token_env_var' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
WS_VAR=$(grep '^workspace_env_var' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
MENTU_TOKEN=$(grep "^${TOKEN_VAR}=" .env | cut -d'"' -f2)
MENTU_WS=$(grep "^${WS_VAR}=" .env | cut -d'"' -f2)
ACTOR=$(grep '^actor' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
BUILD_CMD=$(grep '^build_cmd' .mentu/manifest.yaml | awk '{print $2}' | tr -d '"')
```

---

## Agent Identity

| Dimension | Source | Fallback |
|-----------|--------|----------|
| Actor | `.mentu/manifest.yaml` → `actor` | `agent:claude-code` |
| Author Type | HANDOFF `author_type` field | executor |
| Context | Working directory | Current repo |

---

## Document Lifecycle

```
+-----------------------------------------------------------------------+
|  PLANNING PHASE (This command creates these)                           |
|  -------------------------------------------                           |
|  PRD -> HANDOFF -> PROMPT -> Commitment Created                        |
|                                                                        |
|  EXECUTION PHASE (Agent reads HANDOFF and follows it)                  |
|  ----------------------------------------------------                  |
|  Claim -> Work -> Validate -> Create RESULT -> Capture Evidence -> Submit |
|                                                                        |
|  RESULT creation is embedded in HANDOFF template, not separate.        |
|  The agent sees "Completion Phase (REQUIRED)" in their HANDOFF.        |
+-----------------------------------------------------------------------+
```

---

## SACRED RULE: Ledger-First Pattern

```
+-----------------------------------------------------------------------+
|  THE LEDGER IS THE ONLY SOURCE OF TRUTH                                |
|                                                                        |
|  YAML front matter `mentu:` fields are WRITE-ONCE, then READ-ONLY.    |
|  NEVER manually edit the mentu: block after initial creation.          |
|  State changes happen through CLI commands, NOT document edits.        |
+-----------------------------------------------------------------------+
```

---

## Instructions

Create a full documentation chain for the feature: **$ARGUMENTS**

**STATE THE TARGET EXPLICITLY**: "Creating documents in docs/"

---

### Phase 1: PRD (Requirements)

1. **Read template** if available in `docs/templates/TEMPLATE-PRD.md`

2. **Create document** at explicit path:
   `docs/PRD-$ARGUMENTS.md`
   - State: "Creating PRD at: {FULL_PATH}"

3. **Set initial YAML**:
   ```yaml
   mentu:
     commitment: pending
     status: pending
   ```

4. Fill in all PRD sections: Mission, Problem Statement, Specification, Implementation, Success Criteria, Verification Commands.

5. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created PRD-{name}: {summary}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

---

### Phase 2: HANDOFF (Build Instructions)

1. **Read template** if available in `docs/templates/TEMPLATE-Handoff.md`

2. **Create document** at explicit path:
   `docs/HANDOFF-$ARGUMENTS.md`
   - State: "Creating HANDOFF at: {FULL_PATH}"

3. **Include Completion Contract with required_files, checks**

4. **Set `author_type: executor` in front matter** for the executing agent

5. **Set initial YAML**:
   ```yaml
   mentu:
     commitment: pending
     status: pending
   ```

6. **Capture evidence** via curl to proxy API.

---

### Phase 3: PROMPT (Agent Launch Command)

1. **Read template** if available in `docs/templates/TEMPLATE-Prompt.md`

2. **Create document** at explicit path:
   `docs/PROMPT-$ARGUMENTS.md`
   - State: "Creating PROMPT at: {FULL_PATH}"

3. **The launch command MUST include explicit HANDOFF path**:

   ```bash
   claude \
     --dangerously-skip-permissions \
     --max-turns 100 \
     "Read docs/HANDOFF-$ARGUMENTS.md and execute."
   ```

4. **Capture evidence** via curl to proxy API.

---

### Phase 4: Commit to Mentu

1. **Capture specification**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Feature specification complete for $ARGUMENTS","kind":"specification","meta":{"author_type":"auditor"}}'
   ```

2. **Create commitment**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"commit","body":"Implement $ARGUMENTS as specified in HANDOFF","source":"mem_XXXXXXXX","actor":"'"$ACTOR"'"}'
   ```

3. **ONE-TIME UPDATE** - Update all three documents with commitment ID:
   ```yaml
   mentu:
     commitment: cmt_XXXXXXXX  # Write ONCE
     status: pending           # NEVER change manually
   ```

4. **This is the LAST time you edit `mentu:` fields.**

---

### Phase 4.5: Create feature_list.json

After committing to Mentu, create the execution contract:

1. **Create feature_list.json** at the commitment-scoped path:

   ```bash
   mkdir -p .mentu/feature_lists
   # Write to: .mentu/feature_lists/{cmt_id}.json
   ```

   ```json
   {
     "$schema": "feature-list-v1",
     "instruction_id": "HANDOFF-{Name}-v{X.Y}",
     "created": "{ISO-timestamp}",
     "status": "in_progress",
     "tier": "{tier}",
     "mentu": {
       "commitment": "cmt_XXXXXXXX",
       "source": "mem_XXXXXXXX"
     },
     "features": [],
     "checks": {
       "tsc": true,
       "build": true,
       "test": false
     }
   }
   ```

2. **Derive features from HANDOFF** deliverables/verification checklist (F001, F002, ...).

3. **Capture evidence** via curl to proxy API.

---

## Output Format

After creating planning documents (Phases 1-4), provide:

### 1. Summary Table

| Document | Path | Evidence ID |
|----------|------|-------------|
| PRD | `docs/PRD-{name}.md` | mem_xxx |
| HANDOFF | `docs/HANDOFF-{name}.md` | mem_yyy |
| PROMPT | `docs/PROMPT-{name}.md` | mem_zzz |

### 2. Launch Command

```bash
claude \
  --dangerously-skip-permissions \
  --max-turns 100 \
  "Read docs/HANDOFF-$ARGUMENTS.md and execute."
```

### 3. Mentu State

- **Commitment**: cmt_XXXXXXXX
- **Source**: mem_YYYYYYYY
- **Status**: open

### 4. Completion Reminder

The executing agent MUST create RESULT-$ARGUMENTS.md at:
`docs/RESULT-$ARGUMENTS.md`

### 5. Ledger-First Reminder

`mentu:` fields are frozen after creation. Query state via CLI only.

---

## Arguments

Provide the feature name in PascalCase with version (e.g., `UserAuth-v1.0`, `DataExport-v2.0`).

---

*Explicit paths. Transparent context. Ledger-first truth.*
