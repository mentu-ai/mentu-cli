Create a complete document chain (PRD -> HANDOFF -> Ralph PROMPT) for a feature, commit to Mentu, then generate a Ralph-loop-ready prompt that tracks the commitment lifecycle.

---

## Workspace Context

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

## Agent Identity

| Dimension | Source | Fallback |
|-----------|--------|----------|
| Actor | `.mentu/manifest.yaml` | `{{ACTOR}}` |
| Author Type | HANDOFF `author_type` field | executor |
| Context | Working directory | {{PROJECT_NAME}} |

---

## How It Works

```
+-------------------------------------------------------------------------+
|  PLANNING PHASE (This command -- /craft-ralph -- creates these)          |
|  ------------------------------------------------------------            |
|  1. docs/PRD-{Name}.md            Requirements & spec                    |
|  2. docs/HANDOFF-{Name}.md        Staged steps + mentu front matter      |
|  3. mentu commit                   Creates cmt_XXXXXXXX                  |
|  4. .mentu/feature_lists/cmt_*.json  Execution contract                  |
|  5. .ralph/PROMPT.md               Ralph-loop prompt (with cmt_ID)       |
|                                                                          |
|  EXECUTION PHASE (Ralph loop runs the prompt)                            |
|  --------------------------------------------                            |
|  ./ralph.sh --prompt .ralph/PROMPT.md --max-iterations N                 |
|                                                                          |
|  Iteration 1:  mentu claim -> read HANDOFF -> start Step 1              |
|  Iterations:   check git log -> pick next step -> build -> verify        |
|                -> commit -> mentu capture progress                       |
|  Final iter:   create RESULT doc -> mentu capture evidence -> mentu      |
|                submit -> <promise>{{COMPLETION_PROMISE}}</promise>        |
+-------------------------------------------------------------------------+
```

---

## Ledger-First Rule

```
+-----------------------------------------------------------------------+
|  YAML front matter `mentu:` fields are WRITE-ONCE, then READ-ONLY.    |
|  State changes happen through CLI commands, NOT document edits.        |
+-----------------------------------------------------------------------+
```

---

## Instructions

Create a full documentation chain for the feature: **$ARGUMENTS**

**STATE THE TARGET**: "Creating documents in docs/"

---

### Phase 1: PRD (Requirements)

1. **Read template** if available in `docs/templates/TEMPLATE-PRD.md`

2. **Create document** at:
   `docs/PRD-$ARGUMENTS.md`

3. **Keep mentu YAML** in front matter:
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

### Phase 2: HANDOFF (Staged Build Instructions)

1. **Read template** if available in `docs/templates/TEMPLATE-Handoff.md`

2. **Create document** at:
   `docs/HANDOFF-$ARGUMENTS.md`

3. **Keep mentu YAML** + add execution mode:
   ```yaml
   mentu:
     commitment: pending
     status: pending
   execution: ralph-loop
   author_type: executor
   ```

4. **Structure the Build Order as numbered steps** for the Ralph loop.
   Each step MUST follow this pattern:

   ```markdown
   ### Step N: {Step Name}

   {What this step accomplishes.}

   **Files to create/modify:**
   - `{path/to/file.ts}` - {purpose}

   **Code/implementation details:**
   {Detailed instructions, code snippets if needed}

   **Verification:**
   ```bash
   {{BUILD_CMD}}   # Must pass clean
   ```

   **Commit:** `[{Name} Step N] {Brief description}`
   ```

5. Steps should be:
   - **Ordered by dependency** (foundations first, integrations last)
   - **Self-contained** (each step produces a working build)
   - **Verifiable** (each step has a build/test check)
   - **5-15 steps** for a typical feature (T2)

6. **Strip** the Visual Verification and Mentu Protocol detail sections (the Ralph prompt handles mentu operations instead).

7. **Keep** a simplified Verification Checklist at the end:
   ```markdown
   ## Final Checklist
   - [ ] `{{BUILD_CMD}}` passes
   - [ ] All steps committed with `[{Name} Step N]` format
   - [ ] RESULT document created
   - [ ] Mentu commitment submitted
   - [ ] {Feature-specific checks}
   ```

8. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created HANDOFF-{name}: {summary}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

---

### Phase 3: Commit to Mentu

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

3. **Claim the commitment** (so Ralph PROMPT claim is idempotent):
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"claim","commitment":"cmt_XXXXXXXX"}'
   ```

4. **Track active commitment** for hook coordination:
   ```bash
   echo "cmt_XXXXXXXX" > .mentu/active_commitment
   ```

5. **ONE-TIME UPDATE** -- update PRD and HANDOFF with commitment ID:
   ```yaml
   mentu:
     commitment: cmt_XXXXXXXX  # Write ONCE
     status: pending           # NEVER change manually
   ```

6. **This is the LAST time you edit `mentu:` fields in those documents.**

---

### Phase 3.5: Create feature_list.json

1. Create at commitment-scoped path:
   ```bash
   mkdir -p .mentu/feature_lists
   ```

   **Path**: `.mentu/feature_lists/cmt_XXXXXXXX.json`

   ```json
   {
     "$schema": "feature-list-v1",
     "instruction_id": "HANDOFF-{Name}",
     "created": "{ISO-timestamp}",
     "status": "in_progress",
     "tier": "{tier}",
     "mentu": {
       "commitment": "cmt_XXXXXXXX",
       "source": "mem_XXXXXXXX"
     },
     "features": [
       // One per HANDOFF step + verification item
     ],
     "checks": {
       "tsc": true,
       "build": true,
       "test": false
     }
   }
   ```

2. Derive features from HANDOFF steps (F001, F002, ...).

3. **Capture evidence**:
   ```bash
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"Created feature_list.json for {Name}","kind":"document","meta":{"author_type":"auditor"}}'
   ```

---

### Phase 4.5: Initialize Ralph Memory

After creating the commitment and feature_list, initialize the memory file for the Ralph loop:

1. **Create/overwrite** `.ralph/memories.md` with feature context:

   ```markdown
   # Ralph Memory Context

   ## Feature

   - **Commitment**: cmt_XXXXXXXX
   - **Feature**: $ARGUMENTS
   - **HANDOFF**: docs/HANDOFF-$ARGUMENTS.md

   ## Progress

   <!-- Updated during execution -- one checkbox per HANDOFF step -->
   - [ ] Step 1: {step name from HANDOFF}
   - [ ] Step 2: {step name from HANDOFF}
   ...
   - [ ] Step N: {step name from HANDOFF}
   - [ ] Review pass
   - [ ] RESULT document
   - [ ] Mentu submit

   ## Implementation Notes

   <!-- Lessons learned, decisions made, errors fixed during execution -->

   ## Evidence Trail

   <!-- Auto-populated by mentu_evidence_to_memory.py hook -->
   ```

2. Derive the progress checkboxes from the HANDOFF steps (one per step + review + result + submit).

3. This file is injected into every Ralph iteration via `inject_memory_context()` in `ralph.sh`.

---

### Phase 5: Generate Ralph PROMPT

**This is the key deliverable.** Generate `.ralph/PROMPT.md` with the Mentu commitment ID baked in.

The prompt MUST follow this structure -- note the three lifecycle phases (claim, work, close):

````markdown
Read the spec documents before writing any code:
- `docs/HANDOFF-$ARGUMENTS.md` -- staged build steps, file structure, verification
- `docs/PRD-$ARGUMENTS.md` -- requirements and success criteria

## Your job

{One paragraph: what to build and the single measurable outcome.}

**Mentu commitment**: `cmt_XXXXXXXX`

## How to work each iteration

1. **Check progress:** Run `git log --oneline -15` and check what exists to determine which step you completed last. Look for commit messages that reference `[{Name} Step X]`.
2. **First iteration only -- claim the commitment** (skip if already claimed):
   ```bash
   MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
   MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"claim","commitment":"cmt_XXXXXXXX"}'
   ```
3. **Pick the next uncompleted step.** Do NOT skip ahead. Do NOT repeat completed work.
4. **Read the HANDOFF** (`docs/HANDOFF-$ARGUMENTS.md`) for details on the step you're building.
5. **Build the step.** Write all code following the HANDOFF exactly.
6. **Verify the build** after each step: `{{BUILD_CMD}}`. Fix ALL errors before committing.
7. **Commit** with message format: `[{Name} Step X] Brief description`
8. **Capture progress to Mentu** after each step:
   ```bash
   MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
   MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
   curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
     -H "X-Proxy-Token: $MENTU_TOKEN" \
     -H "X-Workspace-Id: $MENTU_WS" \
     -H "Content-Type: application/json" \
     -d '{"op":"capture","body":"[{Name} Step X] {description}","kind":"execution-progress","meta":{"author_type":"executor"}}'
   ```
9. **Move to the next step** if time permits. Do as many steps as you can per iteration.

---

{Steps copied verbatim from the HANDOFF, each with full detail}

---

## After ALL steps are complete

Once every step is committed and `{{BUILD_CMD}}` passes clean:

### 1. Create RESULT document

Create `docs/RESULT-$ARGUMENTS.md` with:
- Summary of what was built
- Files created and modified
- Build/test results
- YAML front matter:
  ```yaml
  mentu:
    commitment: cmt_XXXXXXXX
    evidence: pending
    status: pending
  ```

### 2. Capture RESULT as evidence

```bash
MENTU_TOKEN=$(grep '^{{TOKEN_ENV_VAR}}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{{WS_ENV_VAR}}=' .env | cut -d'"' -f2)
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"capture","body":"Created RESULT-$ARGUMENTS: {one-line summary}","kind":"result-document","meta":{"author_type":"executor"}}'
```

### 3. Submit the commitment

```bash
COMMIT_SHA=$(git rev-parse HEAD)
curl -s -X POST "https://mentu-proxy.affihub.workers.dev/ops" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS" \
  -H "Content-Type: application/json" \
  -d '{"op":"submit","commitment":"cmt_XXXXXXXX","evidence":["'"$COMMIT_SHA"'"],"summary":"{Summary of what was done}","tier":"tier_1"}'
```

### 4. Final verification

```bash
{{BUILD_CMD}}
```

If everything passes, output: <promise>{{COMPLETION_PROMISE}}</promise>

---

## Critical rules

- Run `{{BUILD_CMD}}` after EVERY step -- fix all errors before committing
- One commit per step with `[{Name} Step X] Brief description` format
- All Mentu ops via curl -- NEVER use mentu CLI
- `mentu:` YAML fields are write-once, then frozen

## Completion signal

When ALL steps are complete, RESULT document created, AND mentu commitment submitted:

Output: <promise>{{COMPLETION_PROMISE}}</promise>
````

**Key rules for generating the Ralph prompt:**
- **Bake the commitment ID** (`cmt_XXXXXXXX`) directly into the prompt text -- the Ralph agent needs it without running mentu commands to discover it
- Copy the steps verbatim from the HANDOFF (agent needs them inline)
- Include the RESULT template path and creation instructions
- Include all project-specific constraints
- The mentu claim happens on first iteration only
- Progress captures happen after each step commit
- RESULT + submit + `<promise>{{COMPLETION_PROMISE}}</promise>` happen after the last step
- Reference HANDOFF and PRD as supplementary reading at the top

State: "Created Ralph prompt at: .ralph/PROMPT.md"

---

## Output Format

After creating all documents and committing to Mentu, provide:

### 1. Summary Table

| Document | Path | Evidence ID |
|----------|------|-------------|
| PRD | `docs/PRD-$ARGUMENTS.md` | mem_xxx |
| HANDOFF | `docs/HANDOFF-$ARGUMENTS.md` | mem_yyy |
| feature_list | `.mentu/feature_lists/cmt_XXXXXXXX.json` | mem_zzz |
| Ralph Prompt | `.ralph/PROMPT.md` | -- |

### 2. Launch Command

```bash
./scripts/ralph-work.sh --max-iterations {N}
```

Or with the global shell function:
```bash
ralph-work --max-iterations {N}
```

Where `{N}` = number of steps + 6 buffer (for review pass, RESULT creation, mentu submit, and retries).

### 3. Mentu State

- **Commitment**: cmt_XXXXXXXX
- **Source**: mem_YYYYYYYY
- **Status**: open

### 4. Step Count

- **Build steps**: {N}
- **+ RESULT & submit**: 1-2 extra iterations
- **+ Buffer**: 5 iterations
- **Recommended --max-iterations**: {N + 8}

---

## Arguments

Provide the feature name in PascalCase with optional version (e.g., `UserAuth-v1.0`, `DataExport`, `MultiTenant`).

---

*Ralph loops the work. Mentu tracks the commitment. Git proves the progress.*
