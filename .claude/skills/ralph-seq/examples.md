# Ralph Sequences Examples

Real sequences from the Crawlio project showing different patterns.

---

## Example 1: Settings Wiring (4 impl + 4 review = 8 steps)

Straight impl+review pairs, single auth profile, all in project root.

### Sequence JSON

`.ralph/sequences/crawlio-settings-wiring.json`:
```json
{
  "name": "crawlio-settings-wiring",
  "description": "Settings validation -> review -> Advanced surface -> review -> Lifecycle lock -> review -> Tests -> review",
  "steps": [
    {
      "label": "settings-validation",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-validation.md"]
    },
    {
      "label": "settings-validation-review",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-validation-review.md"]
    },
    {
      "label": "settings-surface",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-surface.md"]
    },
    {
      "label": "settings-surface-review",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-surface-review.md"]
    },
    {
      "label": "settings-lifecycle",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-lifecycle.md"]
    },
    {
      "label": "settings-lifecycle-review",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-lifecycle-review.md"]
    },
    {
      "label": "settings-tests",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-tests.md"]
    },
    {
      "label": "settings-tests-review",
      "auth": "rashid",
      "args": ["-P", ".ralph/PROMPT-settings-tests-review.md"]
    }
  ]
}
```

### Naming Convention

PROMPT files follow: `PROMPT-{sequence-prefix}-{phase-label}.md`
- `PROMPT-settings-validation.md` (impl)
- `PROMPT-settings-validation-review.md` (review)

---

## Example 2: Supremacy Plan (6 impl + 6 review = 12 steps)

Larger sequence with `work` auth for org billing.

### Sequence JSON

`.ralph/sequences/crawlio-supremacy.json`:
```json
{
  "name": "crawlio-supremacy",
  "description": "Connection hardening -> review -> State persistence -> review -> Parser hardening -> review -> Download hardening -> review -> Export & polish -> review -> Resilience hardening -> final review",
  "steps": [
    { "label": "connection-hardening", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-connection.md"] },
    { "label": "connection-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-connection-review.md"] },
    { "label": "state-persistence", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-state.md"] },
    { "label": "state-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-state-review.md"] },
    { "label": "parser-hardening", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-parser.md"] },
    { "label": "parser-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-parser-review.md"] },
    { "label": "download-hardening", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-download.md"] },
    { "label": "download-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-download-review.md"] },
    { "label": "export-polish", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-export.md"] },
    { "label": "export-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-export-review.md"] },
    { "label": "resilience-hardening", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-resilience.md"] },
    { "label": "final-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-supremacy-final-review.md"] }
  ]
}
```

---

## Example 3: Hardening Pipeline (worktree steps)

Steps run in a git worktree, not the main project root. Uses `"dir"` field.

### Sequence JSON

`.ralph/sequences/crawlio-hardening.json`:
```json
{
  "name": "crawlio-hardening",
  "description": "SiteOne review -> HTTrack hardening -> HTTrack review -> ...",
  "steps": [
    {
      "label": "siteone-code-review",
      "dir": ".worktrees/chirpy-lily",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-siteone-review.md"]
    },
    {
      "label": "httrack-hardening",
      "dir": ".worktrees/chirpy-lily",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-httrack.md"]
    },
    {
      "label": "httrack-code-review",
      "dir": ".worktrees/chirpy-lily",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-httrack-review.md"]
    }
  ]
}
```

**Key:** The `dir` field means ralph runs `cd .worktrees/chirpy-lily` before executing. The PROMPT path is relative to that directory.

---

## Example 4: Localization Parity (4 impl + 4 review)

Clean impl+review pattern with descriptive labels.

### Sequence JSON

`.ralph/sequences/crawlio-localization-parity.json`:
```json
{
  "name": "crawlio-localization-parity",
  "description": "Localizer URL resolution -> review -> Cross-domain assets -> review -> Query param stripping -> review -> Deploy hardening + ATS -> review",
  "steps": [
    { "label": "localizer-resolution", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-localizer.md"] },
    { "label": "localizer-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-localizer-review.md"] },
    { "label": "cross-domain-assets", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-crossdomain.md"] },
    { "label": "crossdomain-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-crossdomain-review.md"] },
    { "label": "query-stripping", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-querystrip.md"] },
    { "label": "querystrip-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-querystrip-review.md"] },
    { "label": "deploy-hardening", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-deploy.md"] },
    { "label": "deploy-review", "auth": "work", "args": ["-P", ".ralph/PROMPT-parity-deploy-review.md"] }
  ]
}
```

---

## Example 5: Compact Hardening Pipeline with Inline Review (20 steps)

Uses `ralph-reviewer` as a background sub-agent at the end of each impl step. No separate review steps — halves the sequence from 40 to 20 steps with the same review coverage.

### Sequence JSON

`.ralph/sequences/crawlio-re-hardening.json`:
```json
{
  "name": "crawlio-re-hardening",
  "description": "H-8 JS localizer -> H-9 relative paths -> H-10 backoff -> H-11 ZIP cache -> ... (20 phases, inline review)",
  "steps": [
    {
      "label": "ah-8-js-localizer",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-ah-8-js-localizer.md"]
    },
    {
      "label": "ah-9-relative-paths",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-ah-9-relative-paths.md"]
    },
    {
      "label": "ah-10-backoff",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-ah-10-backoff.md"]
    },
    {
      "label": "ah-11-zip-cache",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-ah-11-zip-cache.md"]
    }
  ]
}
```

### PROMPT Pattern (Inline Background Review)

Each implementation PROMPT ends with a review spawn instead of needing a separate review step:

`.ralph/PROMPT-ah-8-js-localizer.md`:
```markdown
# PROMPT -- RE Hardening: JS Localizer (H-8)

## Objective
Implement JavaScript URL localizer based on HTTrack RE findings.

## Reference Materials (READ FIRST)
- docs/handoffs/HANDOFF-REHardening.md -- H-8 spec
- .ralph/sequences/step-results/ah-7-*.md -- Context from H-7 (if available)
- CLAUDE.md

## Phase Tracking
Read `docs/handoffs/current-phase.txt` at iteration start.

## Execution Protocol
### Step A: Ghidra Pre-Bake
### Step B: Read Existing Code
### Step C: Check If Already Implemented
### Step D: Implement Code Changes
### Step E: Build & Test

    swift build 2>&1
    swift test 2>&1

### Step F: Commit & Advance

    git add -A && git commit -m "[H-8] JS URL localizer from HTTrack RE"

## Post-Implementation Review

After committing, spawn a `ralph-reviewer` background agent to verify this step:

Use the Task tool:
- subagent_type: "Ralph Reviewer"
- prompt: "Review ah-8 changes against .ralph/findings/ah-8-findings.md and docs/handoffs/HANDOFF-REHardening.md H-8 spec"
- run_in_background: true
- isolation: "worktree"

The reviewer runs on haiku (10-20x cheaper) in an isolated worktree and won't block the sequence.

## Completion
Output: LOOP_COMPLETE
```

### Key Differences from Paired Review Pattern

| Aspect | Paired (Example 1-4) | Compact (Example 5) |
|--------|----------------------|---------------------|
| Steps per phase | 2 (impl + review) | 1 (impl with inline review) |
| Review model | Opus (same as impl) | Haiku (10-20x cheaper) |
| Review blocking | Yes (next step waits) | No (background task) |
| Total steps for 20 phases | 40 | 20 |
| Review depth | Full Opus reasoning | Automated checklist |
| Best for | Complex/critical phases | Routine hardening passes |

### Step Results Chain

Each step reads the previous step's captured output:
```markdown
## Context from Previous Steps
Read `.ralph/sequences/step-results/ah-7-*.md` for findings from H-7.
```

The Stop hook (`.claude/hooks/ralph_post_step.sh`) auto-captures the final agent output after each step completes.

---

## Log Output Example

What a successful run looks like:

```
=== SEQUENCE: crawlio-settings-wiring ===
=== STARTED: 2026-02-20T21:29:03 ===

--- step 1/8: settings-validation ---
dir: .
auth: rashid
args: -P .ralph/PROMPT-settings-validation.md
started: 2026-02-20T21:29:03
ended: 2026-02-20T21:42:17
exit_code: 0
duration: 794s
status: OK

--- step 2/8: settings-validation-review ---
dir: .
auth: rashid
args: -P .ralph/PROMPT-settings-validation-review.md
started: 2026-02-20T21:42:17
ended: 2026-02-20T21:48:33
exit_code: 0
duration: 376s
status: OK

...

=== FINISHED: 2026-02-20T23:15:42 ===
=== RESULT: 8 steps run (8 ok, 0 warned) ===
```

---

## Example 6: Protocol-Aware Sequence (Structural Enforcement)

A sequence where steps declare required architectural protocols. Protocols activate Claude Code hooks that structurally block violations. From the Subtrace Grand Unification project.

**Key pattern:** Features requiring Ghidra RE use the **recon → impl → review triplet**. Features using only standard application logic omit protocol tags entirely (bypass by omission).

### Sequence JSON

`.ralph/sequences/grand-unification.json` (abbreviated — showing the structural patterns):
```json
{
  "name": "grand-unification",
  "description": "Integration recon -> VirtioFS bridge -> ANE socket -> Air-gapped embedder -> OCR unification -> E2E smoke",
  "steps": [
    {
      "label": "gu0-integration-recon",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu0-integration-recon.md"],
      "protocols": ["context-isolation"]
    },
    {
      "label": "gu0-review",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu0-review.md"]
    },

    // --- RECON → IMPL → REVIEW TRIPLET (GU1) ---
    {
      "label": "gu1-recon",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu1-recon.md"],
      "protocols": ["ghidra-gate", "context-isolation"],
      "circuit_breaker": false
    },
    {
      "label": "gu1-virtiofs-bridge",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu1-virtiofs-bridge.md"],
      "protocols": ["ghidra-gate", "context-isolation"],
      "recon_artifact": "docs/ghidra-analysis/gu1-virtiofs-recon.md",
      "auto_review": true
    },
    {
      "label": "gu1-review",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu1-review.md"]
    },

    // --- RECON → IMPL → REVIEW TRIPLET (GU2) ---
    {
      "label": "gu2-recon",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu2-recon.md"],
      "protocols": ["ghidra-gate", "context-isolation"],
      "circuit_breaker": false
    },
    {
      "label": "gu2-ane-socket",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu2-ane-socket.md"],
      "protocols": ["ghidra-gate", "context-isolation"],
      "recon_artifact": "docs/ghidra-analysis/gu2-ane-recon.md",
      "auto_review": true
    },
    {
      "label": "gu2-review",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu2-review.md"]
    },

    // --- NO PROTOCOLS (application logic only) ---
    {
      "label": "gu3-air-gapped-embedder",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu3-air-gapped-embedder.md"],
      "auto_review": true
    },
    {
      "label": "gu3-review",
      "auth": "work",
      "args": ["-P", ".ralph/PROMPT-gu3-review.md"]
    }
  ]
}
```

### Protocol Bypass by Omission

There is **no `--skip-ghidra` flag or runtime bypass**. Steps that don't need RE simply omit the protocol tag from their `protocols` array. The bypass is a sequence design decision, not a runtime escape hatch.

| Step | Protocols | Why | Pattern |
|------|-----------|-----|---------|
| `gu0-integration-recon` | context-isolation | Synthesizes 15 reference docs — needs context protection | Synthesizer |
| `gu1-recon` | ghidra-gate, context-isolation | Runs Ghidra decompilation — label contains "recon" so tools allowed | Recon (triplet step 1) |
| `gu1-virtiofs-bridge` | ghidra-gate, context-isolation | Reads recon artifact — Ghidra tools BLOCKED, source writes allowed | Impl (triplet step 2) |
| `gu1-review` | (none) | Review step — reads committed code, no enforcement | Review (triplet step 3) |
| `gu3-air-gapped-embedder` | (none) | Standard application logic — no binary RE needed | Bypass by omission |

### PROMPT Pattern: Context Isolation (Synthesizer)

When a step has `"context-isolation"`, the PROMPT uses the Synthesizer Pattern — sub-agents process raw data, main agent reads only summaries:

```markdown
# PROMPT -- Grand Unification: Integration Recon (Phase 0)

## Objective
Synthesize 15 reference materials into a unified integration map.

## Execution Protocol

### Step A: Synthesize Reference Materials

For EACH reference document, spawn a synthesizer sub-agent:

Use the Agent tool with subagent_type="general-purpose":
- description: "Synthesize <doc-name>"
- prompt: "Read <path>. Write a compressed summary to .claude/summaries/<name>.md.
  Include: key APIs, data flow patterns, constraints, open questions.
  Respond with ONLY: 'Summary written to <path>' and a 1-sentence description."

**Parallelize** all independent synthesizer spawns.

### Step B: Read Summaries and Build Integration Map

Read each .claude/summaries/*.md file. Cross-reference findings to build the
unified integration map at docs/integration-map.md.

## Completion
Output: LOOP_COMPLETE
```

### PROMPT Pattern: Recon Step (Triplet Step 1)

The recon step's label **MUST contain "recon"** — this is how the hook knows to allow Ghidra tools. The recon step writes the artifact that the impl step will read.

```markdown
# PROMPT -- GU1 Recon: VirtioFS / VZ.framework RE

## Objective
Produce a Ghidra recon artifact at `docs/ghidra-analysis/gu1-virtiofs-recon.md`.
Do NOT write any application code — this is a pure RE step.

## Execution Protocol

### Step A: Load Ghidra/Spectre Tools
Use `ToolSearch` to discover and load RE tools (search `+ghidra` or `+spectre`).

### Step B: Decompile Target Functions
1. decompile_function(name="_VZVirtioFileSystemDeviceConfiguration_init")
2. decompile_function(name="_VZSharedDirectory_init")
3. decompile_function(name="_VZVirtualMachine_startWithOptions")

**Parallelize** all independent decompile calls.

### Step C: Write Recon Artifact
Write findings to `docs/ghidra-analysis/gu1-virtiofs-recon.md` with:
- Function names, addresses, and program
- Struct layouts and field offsets
- Initialization sequences and error paths
Every claim must have a Ghidra address reference. No placeholders.

### Step D: Commit
git add docs/ghidra-analysis/gu1-virtiofs-recon.md
git commit -m "[GU1-Recon] VirtioFS / VZ.framework Ghidra analysis"

## Completion
Output: LOOP_COMPLETE
```

### PROMPT Pattern: Implementation Step (Triplet Step 2)

The impl step **MUST NOT call Ghidra tools** — the hook blocks them (label doesn't contain "recon"). It reads the recon artifact instead. The hook also blocks source writes if the artifact doesn't exist on disk.

```markdown
# PROMPT -- Grand Unification: VirtioFS Bridge (Phase 1)

## Objective
Implement VirtioFS bridge based on Ghidra-verified VZ.framework patterns.

## Reference Materials (READ FIRST)
- docs/ghidra-analysis/gu1-virtiofs-recon.md — RE evidence (MUST exist)
- CLAUDE.md — project conventions

## Execution Protocol

### Step A: Read Recon Artifact (MANDATORY)
Read `docs/ghidra-analysis/gu1-virtiofs-recon.md`. This contains the decompiled
function signatures, struct layouts, and initialization sequences from Ghidra.

DO NOT attempt to use Ghidra tools — they are blocked in this step.
All RE evidence must come from the recon artifact.

### Step B: Read Existing Code
### Step C: Check If Already Implemented
### Step D: Implement Based on RE Evidence
{Implementation grounded in recon artifact, not speculation}

### Step E: Build & Test
### Step F: Commit & Advance

## Completion
Output: LOOP_COMPLETE
```

**Critical difference from pre-enforcement PROMPTs:** The old pattern had "Ghidra Pre-Bake" inside implementation steps. Under enforcement, this is structurally impossible — Ghidra tools are blocked in non-recon steps. The recon must happen in a dedicated prior step.

---

## Quick-Start Checklist

When creating a new sequence:

- [ ] Create `.ralph/sequences/<name>.json`
- [ ] Create one `.ralph/PROMPT-<label>.md` per step
- [ ] Each PROMPT references the HANDOFF doc
- [ ] Each PROMPT ends with `Output: LOOP_COMPLETE`
- [ ] `ralph.yml` has `completion_keyword: "LOOP_COMPLETE"`
- [ ] `ralph.yml` has `max_iterations` set appropriately
- [ ] Auth profile token exists at `~/.claude/<profile>-token`

**If using `ghidra-gate` protocol:**
- [ ] Every ghidra-gate impl step is preceded by a recon step whose label contains `recon`
- [ ] Recon step's PROMPT writes to the path that the impl step's `recon_artifact` points to
- [ ] `recon_artifact` paths are relative to project root (not absolute cross-repo paths)
- [ ] Recon steps have `circuit_breaker: false`
- [ ] Impl steps have `auto_review: true` if quality gating is desired
- [ ] Review steps have NO `auto_review`
- [ ] Steps without RE needs have NO `ghidra-gate` in protocols

**Launch:**
- [ ] Verify: `ralph-seq list` shows the sequence
- [ ] Launch: `ralph-seq <name>`
