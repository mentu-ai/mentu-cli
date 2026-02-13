---
title: "Prompts Reference"
description: "Reference for the 3 built-in prompts in @mentu/mcp: triage, fix, and batch workflows."
---

MCP prompts are pre-built workflows that your AI agent can invoke to perform multi-step operations. Unlike tools (which are single actions), prompts orchestrate a sequence of tool calls with structured reasoning.

The `@mentu/mcp` server provides 3 prompts.

## mentu_triage

**5-gate garbage filter for incoming memories.**

The triage prompt reviews a batch of undismissed memories and runs each one through a 5-gate quality filter before making a decision.

### Arguments

| Name | Type | Required | Description |
|---|---|---|---|
| `project_name` | `string` | No | Name of the project to scope triage to. When provided, the Project Match gate uses this for relevance filtering |
| `batch_size` | `number` | No | Maximum number of memories to review in this session |

### What it does step by step

1. **Fetch memories** -- Calls `mentu_list_memories` to retrieve undismissed memories, limited by `batch_size`.

2. **Run each memory through the 5-gate filter:**

   **Gate 1: Body Coherence** -- Is the memory body well-formed and understandable? Rejects gibberish, empty bodies, or content that does not describe a concrete observation, bug, or idea.

   **Gate 2: Test Detection** -- Does the memory describe something testable or verifiable? Memories that are vague feelings or opinions without actionable substance are flagged.

   **Gate 3: Project Match** -- Is the memory relevant to the current project? When `project_name` is provided, memories about unrelated systems or domains are filtered out.

   **Gate 4: Duplicate Collapse** -- Has this memory already been captured? The prompt checks for existing memories and commitments with overlapping content and collapses duplicates.

   **Gate 5: Actionability** -- Can someone actually act on this? Memories that pass the first four gates but describe something that cannot be fixed, built, or investigated are deferred.

3. **Make decisions** -- For each memory, the prompt decides:
   - **commit** -- create a new commitment for this memory
   - **dismiss** -- reject with a reason (failed one or more gates)
   - **defer** -- valid but not actionable right now
   - **merge** -- combine with an existing memory or commitment

4. **Record the session** -- Calls `mentu_triage` tool with all reviewed memory IDs, a summary, and the decision for each.

### When to use it

- At the start of a work session, to process accumulated memories
- After a code review or audit that generated many `mentu_capture` calls
- When the `undismissed` count in `mentu://status` is growing

### Example invocation

```json
{
  "method": "prompts/get",
  "params": {
    "name": "mentu_triage",
    "arguments": {
      "project_name": "vendora",
      "batch_size": "20"
    }
  }
}
```

---

## mentu_fix

**End-to-end bug fix workflow from memory to closed commitment.**

The fix prompt takes a single memory and drives it through the entire lifecycle: understand the problem, create a commitment, implement the fix, validate it, and submit the evidence.

### Arguments

| Name | Type | Required | Description |
|---|---|---|---|
| `memory_id` | `string` | Yes | The memory ID to fix |

### What it does step by step

The prompt executes an 8-phase workflow:

1. **Investigate** -- Read the memory via `mentu://memories/{id}`, examine its annotations, refs, and metadata. Understand the full context of the problem.

2. **Plan** -- Analyze the codebase to determine what files need to change and what the fix strategy is. Identify risks and edge cases.

3. **Commit** -- Call `mentu_commit` to create a commitment describing the planned fix. Tags and metadata from the memory are carried forward.

4. **Claim** -- Call `mentu_claim` to take ownership of the commitment.

5. **Implement** -- Make the actual code changes. The agent edits files, adds tests, and updates related code as needed.

6. **Validate** -- Run the build and test suite. Collect evidence of pass/fail status, test counts, and any relevant output.

7. **Submit** -- Call `mentu_submit` with all collected evidence (build results, test results, diff summary). Include a human-readable summary of what was changed and why.

8. **Close loop** -- If validation passes and all checks are green, the commitment is ready for approval. If validation fails, the prompt annotates the commitment with the failure details and stops.

### When to use it

- When triage has identified a memory worth fixing and you want the agent to handle the full lifecycle
- For bug fixes that have clear reproduction steps and a known scope
- When you want a fully evidence-bound fix with an audit trail

### Example invocation

```json
{
  "method": "prompts/get",
  "params": {
    "name": "mentu_fix",
    "arguments": {
      "memory_id": "m_a1b2c3d4"
    }
  }
}
```

---

## mentu_batch

**Batch fix wave that processes multiple memories in sequence.**

The batch prompt runs a wave of fixes, processing multiple memories through the fix lifecycle one at a time with circuit-breaker logic to stop on repeated failures.

### Arguments

| Name | Type | Required | Description |
|---|---|---|---|
| `batch_size` | `number` | No | Maximum number of memories to process in this wave |
| `dry_run` | `boolean` | No | When `true`, plan all fixes but do not implement them. Useful for previewing what a wave would do |

### What it does step by step

The batch prompt implements a wave pipeline:

1. **Select candidates** -- Fetch undismissed memories (limited by `batch_size`), prioritized by severity and kind. Bug-type memories are processed before ideas or observations.

2. **Pre-flight check** -- Read `mentu://status` to understand current pipeline state. If there are already too many claimed commitments in progress, the wave may reduce its batch size to avoid overloading the pipeline.

3. **Process sequentially** -- For each candidate memory:
   - Run the equivalent of the `mentu_fix` workflow (investigate, plan, commit, claim, implement, validate, submit)
   - Record evidence at each step
   - If `dry_run` is `true`, stop after the plan phase and record what would have been done

4. **Circuit breaker** -- If two consecutive fixes fail validation (build or test failures), the wave stops. This prevents cascading failures where one broken fix contaminates subsequent ones. The remaining memories are left for the next wave.

5. **Wave summary** -- After all items are processed (or the circuit breaker trips), the prompt produces a summary: how many were fixed, how many failed, how many remain, and what evidence was collected.

6. **Record triage** -- Any memories that were processed are recorded in a triage session with their outcomes.

### When to use it

- For processing a backlog of bug memories after an audit
- During dedicated fix sprints where you want the agent to work through multiple items
- With `dry_run: true` to preview the scope of work before committing to it

### Example invocation

```json
{
  "method": "prompts/get",
  "params": {
    "name": "mentu_batch",
    "arguments": {
      "batch_size": "5",
      "dry_run": "false"
    }
  }
}
```

### Example dry run

```json
{
  "method": "prompts/get",
  "params": {
    "name": "mentu_batch",
    "arguments": {
      "batch_size": "10",
      "dry_run": "true"
    }
  }
}
```

A dry run produces plans for each memory without making code changes. This is useful for estimating effort and reviewing the agent's understanding of each issue before letting it execute.
