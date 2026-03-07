Create a complete document chain (PRD -> HANDOFF -> PROMPT -> RESULT) for a feature using the mentu-craft skill.

---

## Workspace Context (EXPLICIT)

```
MENTU_PROXY_URL:    https://mentu-proxy.affihub.workers.dev
MENTU_WORKSPACE_ID: {{WORKSPACE_ID}}
```

Read credentials from `.env`:
```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
```

---

## Agent Identity Model

```
+-----------------------------------------------------------------------+
|  THE FOUR DIMENSIONS OF AGENT IDENTITY                                 |
|                                                                        |
|  ACTOR (WHO)           From .mentu/manifest.yaml                       |
|  -----------           Example: {{ACTOR}} (for this repo)              |
|                                                                        |
|  AUTHOR TYPE (ROLE)    From HANDOFF's author_type field                |
|  -----------------     Example: executor, auditor, architect           |
|                                                                        |
|  CONTEXT (WHERE)       From working directory                          |
|  ---------------       Example: {{PROJECT_NAME}}                       |
|                                                                        |
|  PROVENANCE (FROM)     From --provenance-* flags                       |
|  ----------------      Example: linked to cmt_xxx, mem_xxx             |
|                                                                        |
|  Actor is auto-resolved from manifest. Author type comes from HANDOFF. |
+-----------------------------------------------------------------------+
```

### Identity Resolution

| Dimension | Source | Fallback |
|-----------|--------|----------|
| Actor | `.mentu/manifest.yaml` | `{{ACTOR}}` |
| Author Type | HANDOFF `author_type` field | executor |
| Context | Working directory, config | Current repo |
| Provenance | Explicit flags | None |

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

### The Pattern

| Phase | Action | Document `mentu:` field |
|-------|--------|------------------------|
| CREATE | Write document | `commitment: pending`, `status: pending` |
| COMMIT | Run `mentu commit` | Update `commitment: cmt_xxx` (ONE TIME) |
| AFTER | Any CLI operation | **NEVER TOUCH** - query ledger instead |

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
     commitment: pending  # Will update ONCE after commit
     status: pending      # FROZEN - never change manually
   ```

4. **Capture evidence**:
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
   - State: "Creating HANDOFF at: {FULL_PATH}"

3. **Include Completion Contract with required_files, checks**

4. **Set `author_type: executor` in front matter** for the executing agent

5. **Set initial YAML**:
   ```yaml
   mentu:
     commitment: pending
     status: pending
   ```

6. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created HANDOFF-{name}: {summary}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

---

### Phase 3: PROMPT (Agent Launch Command)

1. **Read template** if available in `docs/templates/TEMPLATE-Prompt.md`

2. **Create document** at explicit path:
   - State: "Creating PROMPT at: {FULL_PATH}"

3. **The launch command MUST include explicit HANDOFF path**:

   ```bash
   claude \
     --dangerously-skip-permissions \
     --max-turns 100 \
     "Read docs/HANDOFF-$ARGUMENTS.md and execute."
   ```

4. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created PROMPT-{name}: {summary}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

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
     -d '{"op":"commit","body":"Implement $ARGUMENTS as specified in HANDOFF","source":"mem_XXXXXXXX","actor":"{{ACTOR}}"}'
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

   **Path**: `.mentu/feature_lists/cmt_XXXXXXXX.json`

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
     "features": [
       // Derived from HANDOFF deliverables/verification checklist
     ],
     "checks": {
       "tsc": true,
       "build": true,
       "test": false
     }
   }
   ```

2. **Derive features from HANDOFF**:
   - Each deliverable file -> one feature
   - Each verification checklist item -> one feature
   - Use incrementing IDs: F001, F002, ...

3. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created feature_list.json for {Name}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

---

## Executing Agent Requirements

The HANDOFF template includes a **"Completion Phase (REQUIRED)"** section.

### What Agents Must Do

1. **Create RESULT document** at explicit path
2. **Capture as evidence**: via curl to mentu proxy
3. **ONE-TIME update** evidence ID
4. **Submit**: via curl to mentu proxy

### What Agents Must NEVER Do

```
X  Edit mentu.status in YAML
X  Edit mentu.evidence after initial write
X  Edit mentu.commitment after initial write
X  Trust document YAML for current state
X  Use relative paths
```

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
