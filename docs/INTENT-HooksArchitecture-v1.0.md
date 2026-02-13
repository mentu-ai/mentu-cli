---

## PRD 2: HooksArchitecture-v1.0

```markdown
---
id: PRD-HooksArchitecture-v1.0
path: docs/PRD-HooksArchitecture-v1.0.md
type: prd
intent: reference

version: "1.0"
created: 2026-01-08
last_updated: 2026-01-08

tier: T2

children:
  - HANDOFF-HooksArchitecture-v1.0
dependencies:
  - RESULT-TemporalCompletion-v2.5
  - RESULT-TemporalPlanning-v3.0

mentu:
  commitment: pending
  status: pending
---

# PRD: Hooks Architecture v1.0

## Mission

Generalize Mentu's validation patterns into a hooks architecture that intercepts tool execution at defined lifecycle points. Adopt Claude Code's PreToolUse/PostToolUse/Stop pattern while maintaining Mentu's unique accountability layer. Add wildcard pattern matching to genesis.key for expressive permission rules. This transforms ad-hoc validators into composable middleware.

---

## Problem Statement

### Current State

```
Agent attempts tool use
        │
        ▼
┌─────────────────────────────────────────┐
│  Genesis Enforcement (hardcoded)         │
│  - Check actor permissions               │
│  - Allow or deny                         │
│  - No modification capability            │
│  - No post-execution hooks               │
└─────────────────────────────────────────┘
        │
        ▼
Tool executes (or denied)
        │
        ▼
Evidence capture (separate, unstructured)
```

**Problems:**
- Genesis enforcement is a monolithic check, not composable middleware
- No way to modify tool input before execution
- No systematic post-execution hooks for evidence capture
- Permission patterns are rigid (exact match only)
- Validators live in code, not configuration

### Desired State

```
Agent attempts tool use
        │
        ▼
┌─────────────────────────────────────────┐
│  PreToolUse Hooks (configurable)         │
│  ├─ genesis_enforcement                  │
│  ├─ resource_check                       │
│  └─ input_sanitization                   │
│                                          │
│  Each hook can:                          │
│  - allow (continue)                      │
│  - deny (stop with reason)               │
│  - modify (transform input)              │
│  - ask (pause for human)                 │
└─────────────────────────────────────────┘
        │
        ▼
Tool executes
        │
        ▼
┌─────────────────────────────────────────┐
│  PostToolUse Hooks (configurable)        │
│  ├─ evidence_capture                     │
│  ├─ ledger_annotation                    │
│  └─ format_output                        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  Stop Hooks (on completion)              │
│  ├─ approval_gate                        │
│  └─ final_validation                     │
└─────────────────────────────────────────┘
        │
        ▼
Commitment complete with evidence
```

---

## Completion Contract

**First action**: Update `.claude/completion.json`:

```json
{
  "version": "2.0",
  "name": "Hooks Architecture v1.0",
  "tier": "T2",
  "required_files": [
    "mentu-ai/src/hooks/types.ts",
    "mentu-ai/src/hooks/parser.ts",
    "mentu-ai/src/hooks/matcher.ts",
    "mentu-beacon/src-tauri/src/engine/hooks.rs",
    "mentu-beacon/src-tauri/src/engine/genesis.rs"
  ],
  "checks": {
    "tsc": true,
    "build": true,
    "test": false
  },
  "mentu": {
    "enabled": true,
    "commitments": {
      "mode": "dynamic",
      "min_count": 1,
      "require_closed": true,
      "require_evidence": true
    }
  },
  "max_iterations": 50
}
```

---

## Core Concepts

### Hook Events

| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before tool executes | Permission check, input validation, input modification |
| `PostToolUse` | After tool completes | Evidence capture, output annotation, notifications |
| `Stop` | When agent finishes turn | Approval gates, final validation, quality checks |

### Hook Decisions

| Decision | Effect | Feedback |
|----------|--------|----------|
| `allow` | Continue execution | None (silent) |
| `deny` | Block with reason | Reason shown to agent, can try alternative |
| `modify` | Transform input/output | Modified value used |
| `ask` | Pause for human input | Prompt shown, human decides |

### Permission Wildcards

Glob-style pattern matching for genesis permissions:

| Pattern | Matches |
|---------|---------|
| `Bash(git *)` | Any git command |
| `Bash(* install)` | Any install command |
| `Bash(npm run *)` | Any npm script |
| `Write(src/*)` | Any file in src directory |
| `Write(*.ts)` | Any TypeScript file |
| `Bash(* --dry-run)` | Any command with dry-run flag |

---

## Specification

### Types

```typescript
// Hook event types
type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop';

// Hook configuration in genesis.key
interface HookConfig {
  matcher?: string;  // Tool pattern with wildcards
  type: HookType;
  config?: Record<string, unknown>;
}

type HookType = 
  | 'genesis_enforcement'   // Check genesis permissions
  | 'evidence_capture'      // Write to ledger
  | 'approval_gate'         // Require human approval
  | 'deny'                  // Block with reason
  | 'command'               // Run shell command
  | 'modify';               // Transform input/output

// Hook input (passed to hook execution)
interface HookInput {
  hook_event_name: HookEvent;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output?: Record<string, unknown>;  // PostToolUse only
  session_id: string;
  commitment_id?: string;
  actor: string;
}

// Hook output (returned from hook)
interface HookOutput {
  decision: 'allow' | 'deny' | 'ask';
  reason?: string;
  modified_input?: Record<string, unknown>;
  evidence?: {
    kind: string;
    data: Record<string, unknown>;
  };
}

// Permission pattern with wildcards
interface PermissionPattern {
  tool: string;        // Tool name
  pattern?: string;    // Argument pattern with wildcards
}

// Genesis hooks configuration
interface GenesisHooks {
  pre_tool_use?: HookConfig[];
  post_tool_use?: HookConfig[];
  stop?: HookConfig[];
}

// Extended genesis.key structure
interface GenesisKey {
  // ... existing fields ...
  hooks?: GenesisHooks;
  permissions?: {
    actors?: {
      [actor: string]: {
        allow?: string[];   // Patterns with wildcards
        deny?: string[];    // Patterns with wildcards
      };
    };
  };
}
```

### Genesis.key Schema Extension

```yaml
# .mentu/genesis.key
version: "2.0"

hooks:
  pre_tool_use:
    - matcher: "*"
      type: genesis_enforcement
      
    - matcher: "Bash(rm -rf *)"
      type: deny
      config:
        reason: "Recursive force delete is prohibited"
        
    - matcher: "Write(.env*)"
      type: deny
      config:
        reason: "Environment files are protected"
        
  post_tool_use:
    - matcher: "Write|Edit"
      type: evidence_capture
      config:
        ledger: true
        kind: file_change
        
    - matcher: "Bash"
      type: evidence_capture
      config:
        ledger: true
        kind: command_execution
        
  stop:
    - type: approval_gate
      config:
        condition: "commitment.requires_review == true"
        approvers: ["human:rashid"]

permissions:
  actors:
    agent:executor:
      allow:
        - "Bash(git *)"
        - "Bash(npm *)"
        - "Bash(pnpm *)"
        - "Bash(mentu *)"
        - "Write(src/*)"
        - "Write(tests/*)"
        - "Edit(src/*)"
        - "Edit(tests/*)"
        - "Read(*)"
      deny:
        - "Bash(rm -rf *)"
        - "Bash(* --force)"
        - "Bash(git push *)"
        - "Write(.env*)"
        - "Write(*.key)"
        - "Write(.mentu/genesis.key)"
        
    agent:architect:
      allow:
        - "Read(*)"
        - "mentu_commit(*)"
        - "mentu_capture(*)"
        - "Task(executor)"
        - "Task(auditor)"
      deny:
        - "Write(*)"
        - "Edit(*)"
        - "Bash(*)"
        
    agent:auditor:
      allow:
        - "Read(*)"
        - "Bash(npm test *)"
        - "Bash(pnpm test *)"
        - "Bash(lint *)"
        - "mentu_approve(*)"
        - "mentu_reject(*)"
      deny:
        - "Write(*)"
        - "Edit(*)"
```

### Pattern Matching Algorithm

```typescript
function matchPattern(pattern: string, input: string): boolean {
  // Parse pattern: "Tool(argument_pattern)"
  const match = pattern.match(/^(\w+)(?:\((.+)\))?$/);
  if (!match) return false;
  
  const [, toolPattern, argPattern] = match;
  
  // Match tool name
  if (!globMatch(toolPattern, getToolName(input))) {
    return false;
  }
  
  // If no argument pattern, tool match is sufficient
  if (!argPattern) return true;
  
  // Match argument pattern
  return globMatch(argPattern, getToolArgs(input));
}

function globMatch(pattern: string, text: string): boolean {
  // Convert glob to regex
  // * matches any sequence of characters
  // ? matches single character (future)
  const regex = new RegExp(
    '^' + 
    pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars
      .replace(/\*/g, '.*')                   // * -> .*
    + '$'
  );
  return regex.test(text);
}
```

### Hook Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HOOK EXECUTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Tool Request: Bash("git commit -m 'fix'")                              │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │  1. Load hooks from genesis.key          │                            │
│  │  2. Filter PreToolUse hooks              │                            │
│  │  3. Match against tool pattern           │                            │
│  └─────────────────────────────────────────┘                            │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │  Execute PreToolUse hooks in order       │                            │
│  │                                          │                            │
│  │  Hook 1: genesis_enforcement             │                            │
│  │    matcher: "*"                          │                            │
│  │    → Check permissions for agent:executor│                            │
│  │    → "Bash(git *)" matches allow list   │                            │
│  │    → Result: allow                       │                            │
│  │                                          │                            │
│  │  Hook 2: deny                            │                            │
│  │    matcher: "Bash(rm -rf *)"            │                            │
│  │    → Does not match, skip                │                            │
│  └─────────────────────────────────────────┘                            │
│       │                                                                  │
│       ▼                                                                  │
│  All PreToolUse hooks passed → Execute tool                             │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────────────────────────┐                            │
│  │  Execute PostToolUse hooks               │                            │
│  │                                          │                            │
│  │  Hook 1: evidence_capture                │                            │
│  │    matcher: "Bash"                       │                            │
│  │    → Matches                             │                            │
│  │    → Capture to ledger                   │                            │
│  │    → Result: captured                    │                            │
│  └─────────────────────────────────────────┘                            │
│       │                                                                  │
│       ▼                                                                  │
│  Tool execution complete with evidence                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Deliverables

| File | Repository | Purpose |
|------|------------|---------|
| `src/hooks/types.ts` | mentu-ai | Hook type definitions |
| `src/hooks/parser.ts` | mentu-ai | Parse hooks from genesis.key |
| `src/hooks/matcher.ts` | mentu-ai | Wildcard pattern matching |
| `src/engine/hooks.rs` | mentu-beacon | Hook execution engine |
| `src/engine/genesis.rs` | mentu-beacon | Updated genesis parser with hooks/wildcards |

### Build Order

1. **Types**: Define hook interfaces in mentu-ai
2. **Parser**: Parse hooks section from genesis.key YAML
3. **Matcher**: Implement glob-style pattern matching
4. **Rust Engine**: Port to Beacon for runtime execution
5. **Genesis Update**: Extend genesis parser for new schema

### Integration Points

| System | Integration | Notes |
|--------|-------------|-------|
| mentu-ai | Hook config parsing | Used by CLI for validation |
| mentu-beacon | Hook execution | Runtime enforcement |
| agent-service | Hook input/output | Agents receive hook decisions |
| mentu-web | Hook visualization | Show which hooks fired |

---

## Constraints

- Hooks configuration MUST be in genesis.key (single source of truth)
- PreToolUse hooks execute synchronously, in order
- If any PreToolUse hook returns `deny`, execution stops immediately
- PostToolUse hooks execute even if tool failed (for error capture)
- Stop hooks only fire when agent completes a turn
- Wildcard matching uses glob syntax, not regex
- Hook execution must complete in <50ms per hook

---

## Success Criteria

### Functional

- [ ] Genesis.key accepts `hooks` section with pre_tool_use, post_tool_use, stop arrays
- [ ] Wildcard patterns like `Bash(git *)` match correctly
- [ ] PreToolUse `deny` hook blocks tool execution with reason
- [ ] PostToolUse `evidence_capture` writes to ledger
- [ ] Permission patterns with wildcards work in allow/deny lists
- [ ] Multiple hooks execute in defined order

### Quality

- [ ] `npm run build` succeeds in mentu-ai
- [ ] `cargo build` succeeds in mentu-beacon
- [ ] Pattern matching handles edge cases (empty, special chars)
- [ ] Invalid hook config produces clear error message

### Integration

- [ ] Existing genesis.key files without hooks section continue working
- [ ] Hook decisions propagate to agent feedback
- [ ] Evidence captured to ledger has hook metadata

---

## Verification Commands

```bash
# Verify genesis parsing with hooks
cat > /tmp/test-genesis.key << 'EOF'
version: "2.0"
hooks:
  pre_tool_use:
    - matcher: "Bash(rm *)"
      type: deny
      config:
        reason: "Delete commands blocked"
permissions:
  actors:
    agent:executor:
      allow:
        - "Bash(git *)"
      deny:
        - "Bash(rm -rf *)"
EOF

mentu genesis validate /tmp/test-genesis.key

# Verify pattern matching
mentu hooks test-pattern "Bash(git *)" "Bash" "git commit -m test"
# Expected: match

mentu hooks test-pattern "Bash(rm -rf *)" "Bash" "rm -rf /"
# Expected: match

mentu hooks test-pattern "Write(src/*)" "Write" "src/components/Button.tsx"
# Expected: match

# Verify hook execution (with Beacon running)
mentu hooks simulate --tool Bash --args "git status" --actor agent:executor
# Expected: PreToolUse hooks evaluated, allow/deny result shown
```

---

## Examples

### Example 1: Deny Dangerous Commands

```yaml
hooks:
  pre_tool_use:
    - matcher: "Bash(rm -rf *)"
      type: deny
      config:
        reason: "Recursive force delete is never allowed"
```

Agent tries `rm -rf /tmp/stuff`:
- Hook matches pattern
- Returns deny with reason
- Agent receives: "Tool denied: Recursive force delete is never allowed"
- Agent can try alternative (e.g., `rm -r /tmp/stuff` without force)

### Example 2: Evidence Capture

```yaml
hooks:
  post_tool_use:
    - matcher: "Write|Edit"
      type: evidence_capture
      config:
        ledger: true
        kind: file_change
```

Agent writes file:
- Tool executes successfully
- PostToolUse hook fires
- Ledger entry created with file path, content diff, actor

### Example 3: Author Type Permissions

```yaml
permissions:
  actors:
    agent:architect:
      allow:
        - "Read(*)"
        - "mentu_commit(*)"
      deny:
        - "Write(*)"
        - "Bash(*)"
```

Architect agent tries `Write(src/index.ts)`:
- Genesis enforcement checks actor permissions
- `Write(*)` in deny list matches
- Returns deny: "Architects cannot write files. Create a commitment for an Executor."

---

## References

- Claude Code Hooks Documentation: https://docs.claude.com/en/docs/claude-code/hooks
- `SPEC-AuthorTypes-v1.1`: Author type definitions
- `Genesis-Enforcement-Semantics`: Current enforcement logic
- `mentu-beacon/src-tauri/src/engine/genesis.rs`: Existing genesis parser

---

*Hooks Architecture: Validators become middleware. Permissions become patterns. Enforcement becomes configurable.*
```

---
