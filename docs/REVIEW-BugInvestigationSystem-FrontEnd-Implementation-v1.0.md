## Architectural Review: Bug Investigation System

Looking at the full document set, I can now trace the complete architecture. Let me assess alignment.

---

### Current Architecture (As Documented)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BUG INVESTIGATION SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FRONT-END (Quality Gate / Problem Articulation)                            │
│  ═══════════════════════════════════════════════                            │
│                                                                              │
│  Bug Report (WarrantyOS)                                                    │
│       ↓                                                                      │
│  Bug Triager ───────────────── "Understand the bug, extract signal"         │
│       ↓                         (NOT a gatekeeper per GUIDE)                │
│  Intent Generator ─────────── "Articulate What/Why/Constraints/Acceptance" │
│       ↓                                                                      │
│  Auditor Router ───────────── "Invoke craft, create commitment, trigger"   │
│       ↓                                                                      │
│  mem_intent → craft--auditor → mem_prd + mem_handoff → cmt_xxx              │
│       ↓                                                                      │
│  POST /workflow/run                                                          │
│                                                                              │
│  BACK-END (Solution Discovery / Implementation)                             │
│  ═════════════════════════════════════════════                              │
│                                                                              │
│  Architect ────────────────── "Investigate HOW to fix (no code access)"    │
│       ↓                                                                      │
│  Auditor ──────────────────── "Validate strategy, define scope boundaries" │
│       ↓ (branch: approved/rejected)                                          │
│  Approval Gate ────────────── "MANUAL vs AUTONOMOUS per workspace"          │
│       ↓                                                                      │
│  Executor ─────────────────── "Implement within scope"                      │
│       ↓                                                                      │
│  Validators ───────────────── "Technical, Safety, Intent (parallel)"        │
│       ↓                                                                      │
│  Deploy ───────────────────── "GitHub PR, close commitment"                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Issues Identified

#### Issue 1: Naming Collision Creates Confusion

| Front-End Role | Back-End Role | Collision? |
|----------------|---------------|------------|
| Bug Triager | — | ✓ Clear |
| Intent Generator | — | ✓ Clear |
| **Auditor** Router | **Auditor** | ❌ **COLLISION** |
| — | Architect | ✓ Clear |
| — | Executor | ✓ Clear |

The front-end "Auditor Router" and back-end "Auditor" do completely different things:
- **Front-end Auditor Router**: Invokes craft, creates commitment, triggers workflow
- **Back-end Auditor**: Validates Architect's investigation, defines scope boundaries

**Recommendation**: Rename front-end "Auditor Router" → "**Commitment Router**" or "**Craft Invoker**"

---

#### Issue 2: Redundant Investigation Steps?

| Step | What It Does | Overlap? |
|------|-------------|----------|
| Intent Generator | Articulates WHAT is broken, WHY it matters | Problem Definition |
| Back-end Architect | Investigates HOW to fix it, develops strategy | Solution Discovery |
| Back-end Auditor | Validates strategy against codebase reality | Solution Validation |

**Assessment**: These are actually **distinct** functions:
- Intent Generator = **Problem Articulation** (no code access)
- Architect = **Solution Hypothesis** (no code access)
- Auditor = **Reality Check** (code access, read-only)

This is philosophically sound. The front-end doesn't know the codebase. The back-end does.

**Verdict**: ✓ Architecture is correct, but naming makes it confusing.

---

#### Issue 3: Model Assignment Contradiction

From RESULT-DualTriadOrchestration-v1.0:

> **Section "Key Design Decisions":**
> "Model Assignment: Sonnet → Haiku → Sonnet"
> "Auditor: Haiku is fast for validation"

> **Section "Critical Updates Applied (v2)":**
> "Auditor Model Correction: Changed from Haiku 4.5 to Sonnet 4.5"

These contradict each other. The "Key Design Decisions" wasn't updated after v2 corrections.

**Actual State** (from workflow YAML I reviewed earlier):
```yaml
auditor:
  model: claude-haiku-4-5  # WRONG - should be Sonnet
```

**Recommendation**: Fix the workflow YAML and update the RESULT document to be consistent:
```yaml
auditor:
  model: claude-sonnet-4-5  # Gatekeeper needs strong reasoning
```

---

#### Issue 4: Memory Proliferation

Tracing through a single bug fix:

| Memory | Created By | Purpose |
|--------|------------|---------|
| `mem_bug` | Webhook | Raw bug report |
| `mem_bug_triage` | Bug Triager | Signal extraction |
| `mem_intent` | Intent Generator | Problem articulation |
| `mem_prd` | craft--auditor | PRD document |
| `mem_handoff` | craft--auditor | HANDOFF document |
| `mem_architect` | Back-end Architect | Investigation strategy |
| `mem_auditor` | Back-end Auditor | Feasibility assessment |
| `mem_executor` | Back-end Executor | Implementation results |

**Total: 8 memories per bug fix**

**Assessment**: This is a lot, but each serves a distinct purpose:
- Front-end memories (5): Problem → Intent → Specification
- Back-end memories (3): Strategy → Validation → Implementation

**Concern**: The front-end produces a PRD/HANDOFF, but the back-end Architect then "investigates" again. Is the PRD being used?

Looking at the workflow definition:
```yaml
architect:
  body: |
    Analyze the bug report ({{parameters.bug_memory_id}}) and develop investigation approach.
```

The Architect reads `bug_memory_id`, not `mem_prd` or `mem_intent`!

**This is a problem.** The front-end work (PRD/HANDOFF) isn't being used by the back-end.

---

#### Issue 5: Front-End Output Not Consumed by Back-End

**Front-end produces:**
- `mem_intent` (What/Why/Constraints/Acceptance)
- `mem_prd` (PRD document)
- `mem_handoff` (HANDOFF document)

**Back-end consumes:**
- `parameters.bug_memory_id` (raw bug!)

The Architect is re-investigating the raw bug, ignoring the Intent/PRD/HANDOFF!

**This defeats the purpose of the front-end.**

**Fix**: The workflow should consume front-end output:

```yaml
architect:
  body: |
    INTENT document (from front-end):
    {{parameters.intent_memory_id}}
    
    PRD specification:
    {{parameters.prd_memory_id}}
    
    Develop implementation strategy within these boundaries.
```

And the workflow trigger should pass these:
```typescript
POST /workflow/run {
  workflow_id: "bug-investigation-dual-triad",
  parameters: {
    bug_memory_id: bugMemoryId,
    intent_memory_id: intentMemoryId,  // ADD THIS
    prd_memory_id: prdMemoryId,        // ADD THIS
    handoff_memory_id: handoffMemoryId, // ADD THIS
    workspace_id: workspace.id,
    workspace_path: workspace.path
  }
}
```

---

#### Issue 6: What Does craft--auditor Actually Do?

The HANDOFF references:
```bash
/craft --auditor <intentMemoryId>
```

But I don't see `craft--auditor.md` defined anywhere. What should it produce?

**Expected behavior:**
1. Read `mem_intent`
2. Generate PRD document with:
   - Title, scope, acceptance criteria (from intent)
   - Technical approach (inferred from codebase review)
   - Constraints (from intent)
3. Generate HANDOFF document with:
   - Build order
   - Success criteria
   - Verification commands

**If craft--auditor doesn't exist**, the Auditor Router can't work.

**Recommendation**: Create `mentu-ai/.claude/commands/craft--auditor.md` or clarify that it's part of the existing craft system.

---

#### Issue 7: Triager Philosophy Mismatch

From PROMPT-BugTriager-v1.0:
> "Your job is not to reject bugs—it's to understand them."
> "No lengthy validation. No gatekeeping. Trust the source."

But the PRD-BugInvestigationSystem-FrontEnd says:
> "90% of invalid bugs rejected before Architect sees them"

These contradict each other. Is the Triager rejecting or not?

**Resolution**: Looking at the GUIDE:
> "The front-end is not a gatekeeper. It's a translator."

The Triager should:
- **Never reject** valid WarrantyOS bugs
- **Extract signal** for clarity
- **Always proceed** to Intent Generator

The PRD's "90% rejection rate" metric is wrong if we're trusting the source.

**Fix**: Remove rejection metrics from PRD. The Triager's job is signal extraction, not gatekeeping.

---

### Summary: What's Wrong

| Issue | Severity | Fix |
|-------|----------|-----|
| Naming collision (Auditor Router vs Auditor) | Medium | Rename front-end role |
| Model assignment (Auditor = Haiku) | **High** | Change to Sonnet |
| Front-end output ignored by back-end | **High** | Pass intent/prd/handoff to workflow |
| craft--auditor undefined | **High** | Create or clarify |
| Triager rejection metrics contradict philosophy | Low | Update PRD metrics |
| 8 memories per bug | Low | Acceptable for traceability |

---

### Corrected Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CORRECTED BUG INVESTIGATION SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FRONT-END (Problem Articulation)                                           │
│  ─────────────────────────────────                                          │
│  Bug Report                                                                  │
│       ↓                                                                      │
│  Signal Extractor (was: Bug Triager)                                        │
│       ↓                                                                      │
│  Intent Writer (was: Intent Generator)                                      │
│       ↓                                                                      │
│  Commitment Router (was: Auditor Router)  ← RENAMED                         │
│       ↓                                                                      │
│  craft--auditor → mem_prd + mem_handoff                                     │
│       ↓                                                                      │
│  POST /workflow/run {                                                        │
│    bug_memory_id,                                                            │
│    intent_memory_id,   ← ADD                                                │
│    prd_memory_id,      ← ADD                                                │
│    handoff_memory_id,  ← ADD                                                │
│    workspace_id,                                                             │
│    workspace_path                                                            │
│  }                                                                           │
│                                                                              │
│  BACK-END (Solution Implementation)                                         │
│  ──────────────────────────────────                                         │
│  Architect (Sonnet) ─── "Develop implementation strategy from PRD"          │
│       ↓                 INPUT: mem_prd, mem_handoff (not raw bug!)          │
│  Auditor (Sonnet) ───── "Validate strategy, refine scope"  ← SONNET         │
│       ↓                                                                      │
│  Executor (Sonnet) ──── "Implement per HANDOFF"                             │
│       ↓                                                                      │
│  Validators → Deploy                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Critical Fixes Required

**Fix 1: Update workflow YAML**
```yaml
# Change Auditor model
auditor:
  model: claude-sonnet-4-5  # NOT haiku

# Change Architect input to use front-end output
architect:
  body: |
    INTENT (from front-end):
    {{steps.load_intent.output}}
    
    PRD specification:
    {{steps.load_prd.output}}
    
    Develop implementation strategy...
```

**Fix 2: Add parameters to workflow trigger**
```typescript
// In auditor-router.ts
await fetch("/workflow/run", {
  body: JSON.stringify({
    workflow_id: "bug-investigation-dual-triad",
    parameters: {
      bug_memory_id: bugMemoryId,
      intent_memory_id: intentMemoryId,  // ADD
      prd_memory_id: prdMemoryId,        // ADD  
      handoff_memory_id: handoffMemoryId, // ADD
      workspace_id: workspace.id,
      workspace_path: workspace.path
    }
  })
});
```

**Fix 3: Create craft--auditor.md** (or clarify it exists)

**Fix 4: Rename front-end roles**
- Bug Triager → Signal Extractor
- Intent Generator → Intent Writer  
- Auditor Router → Commitment Router

---

### Verdict

**The architecture is fundamentally sound** but has integration gaps:

1. ✓ Front-end/back-end separation makes sense (problem vs solution)
2. ✓ Memory lineage is thorough
3. ✓ Workflow structure is correct
4. ✗ Front-end output not consumed by back-end (critical bug)
5. ✗ Auditor model wrong (Haiku → Sonnet)
6. ✗ Naming collision creates confusion
7. ✗ craft--auditor undefined

**Recommendation**: Fix the 4 critical issues before deployment. The system will produce redundant work otherwise (front-end PRD ignored, back-end re-investigates from scratch).