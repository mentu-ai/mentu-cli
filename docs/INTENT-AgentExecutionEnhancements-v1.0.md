
## PRD 4: AgentExecutionEnhancements-v1.0

```markdown
---
id: PRD-AgentExecutionEnhancements-v1.0
path: docs/PRD-AgentExecutionEnhancements-v1.0.md
type: prd
intent: reference

version: "1.0"
created: 2026-01-08
last_updated: 2026-01-08

tier: T2

children:
  - HANDOFF-AgentExecutionEnhancements-v1.0
dependencies:
  - RESULT-TemporalPlanning-v3.0
  - RESULT-HooksArchitecture-v1.0

mentu:
  commitment: pending
  status: pending
---

# PRD: Agent Execution Enhancements v1.0

## Mission

Adopt Claude Code's execution patterns to improve agent resilience and user experience. Implement output truncation with file references to prevent database bloat. Add skill hot-reload so workspace customizations take effect immediately. Enable mode switching in Agent Chat so users can explicitly operate as Architect, Executor, or Auditor. Make agents resilient to permission denials by trying alternatives instead of failing.

---

## Problem Statement

### Current State

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CURRENT AGENT EXECUTION                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Output Handling:                                                        │
│  - All output stored in spawn_logs                                       │
│  - Large outputs bloat database                                          │
│  - No truncation, no file reference                                      │
│                                                                          │
│  Skill Loading:                                                          │
│  - Skills loaded at Beacon startup                                       │
│  - Changes require restart                                               │
│  - No hot-reload capability                                              │
│                                                                          │
│  Mode Switching:                                                         │
│  - Agent Chat has no explicit modes                                      │
│  - Author type determined by commitment                                  │
│  - No way to "think as Architect" in conversation                        │
│                                                                          │
│  Denial Handling:                                                        │
│  - Permission denial fails the task                                      │
│  - Agent doesn't try alternatives                                        │
│  - User must intervene                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Desired State

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ENHANCED AGENT EXECUTION                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Output Handling:                                                        │
│  ┌─────────────────────────────────────────┐                            │
│  │  Output > 30KB?                          │                            │
│  │    Yes → Truncate + write full to file  │                            │
│  │    No  → Store normally                  │                            │
│  │                                          │                            │
│  │  spawn_logs shows:                       │                            │
│  │  "...truncated. Full: /tmp/mentu/xxx"   │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
│  Skill Loading:                                                          │
│  ┌─────────────────────────────────────────┐                            │
│  │  File watcher on:                        │                            │
│  │  - ~/.mentu/skills/                      │                            │
│  │  - .mentu/skills/                        │                            │
│  │                                          │                            │
│  │  On change → Reload skills immediately   │                            │
│  │  No restart needed                       │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
│  Mode Switching:                                                         │
│  ┌─────────────────────────────────────────┐                            │
│  │  /architect → Plan mode (read-only)     │                            │
│  │  /executor  → Execute mode (with claim) │                            │
│  │  /auditor   → Review mode (read + test) │                            │
│  │                                          │                            │
│  │  Mode changes tool availability          │                            │
│  │  UI shows current mode                   │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
│  Denial Handling:                                                        │
│  ┌─────────────────────────────────────────┐                            │
│  │  Permission denied?                      │                            │
│  │    → Log reason                          │                            │
│  │    → Try alternative approach            │                            │
│  │    → If no alternative, ask human        │                            │
│  │    → Don't fail immediately              │                            │
│  └─────────────────────────────────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Completion Contract

**First action**: Update `.claude/completion.json`:

```json
{
  "version": "2.0",
  "name": "Agent Execution Enhancements v1.0",
  "tier": "T2",
  "required_files": [
    "mentu-beacon/src-tauri/src/engine/output.rs",
    "mentu-beacon/src-tauri/src/engine/skills.rs",
    "mentu-web/src/components/chat/mode-switcher.tsx",
    "mentu-web/src/lib/agent/modes.ts",
    "agent-service/src/prompts/resilience.ts"
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

### Output Truncation

Large command outputs are truncated in the database while preserving full output in files:

| Output Size | Action | Storage |
|-------------|--------|---------|
| ≤ 30KB | Store as-is | spawn_logs.content |
| > 30KB | Truncate + file ref | spawn_logs.content (30KB) + file path |

### Skill Hot-Reload

Skills are YAML/Markdown files in known directories that define reusable agent behaviors:

| Directory | Scope | Priority |
|-----------|-------|----------|
| `.mentu/skills/` | Workspace | High (overrides global) |
| `~/.mentu/skills/` | Global | Low |

Changes to these files take effect immediately without restart.

### Mode Switching

Agent Chat modes change available tools and agent behavior:

| Mode | Tools | Behavior |
|------|-------|----------|
| `/architect` | Read, mentu_commit, mentu_capture, Task | Plan, don't execute |
| `/executor` | All tools (scoped to commitment) | Implement claimed work |
| `/auditor` | Read, test commands, approve/reject | Review and validate |

### Denial Resilience

When a tool is denied, the agent adapts instead of failing:

| Step | Action |
|------|--------|
| 1 | Note why denied (from hook reason) |
| 2 | Consider alternative approaches |
| 3 | Try alternative if available |
| 4 | Request human guidance if stuck |

---

## Specification

### Types

```typescript
// Output truncation
interface TruncatedOutput {
  content: string;          // Truncated content (≤30KB)
  truncated: boolean;
  full_output_path?: string; // Path to full output file
  original_size: number;
}

const MAX_OUTPUT_SIZE = 30 * 1024; // 30KB
const OUTPUT_DIR = '/tmp/mentu/outputs';

// Skill definition
interface Skill {
  name: string;
  description: string;
  author_type?: 'architect' | 'executor' | 'auditor';
  context?: 'fork' | 'inline';
  genesis_scope?: string;
  content: string;  // The skill prompt/instructions
}

// Skill file frontmatter
interface SkillFrontmatter {
  name: string;
  description: string;
  author_type?: 'architect' | 'executor' | 'auditor';
  context?: 'fork' | 'inline';
  genesis_scope?: string;
  allowed_tools?: string[];
  hooks?: HookConfig[];
}

// Agent mode
type AgentMode = 'architect' | 'executor' | 'auditor';

interface ModeConfig {
  mode: AgentMode;
  allowed_tools: string[];
  denied_tools: string[];
  system_prompt_addition: string;
  requires_commitment?: boolean;
}

// Denial response
interface DenialFeedback {
  tool: string;
  reason: string;
  suggestions: string[];
  can_retry: boolean;
}
```

### Output Truncation Flow

```typescript
async function storeOutput(
  commandId: string,
  stream: 'stdout' | 'stderr',
  content: string
): Promise<TruncatedOutput> {
  const originalSize = content.length;
  
  if (originalSize <= MAX_OUTPUT_SIZE) {
    await insertSpawnLog(commandId, stream, content);
    return { content, truncated: false, original_size: originalSize };
  }
  
  // Truncate and store full output to file
  const fullPath = `${OUTPUT_DIR}/${commandId}_${stream}.txt`;
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(fullPath, content);
  
  const truncated = content.slice(0, MAX_OUTPUT_SIZE) +
    `\n\n[Output truncated at 30KB. Full output (${originalSize} bytes): ${fullPath}]`;
  
  await insertSpawnLog(commandId, stream, truncated, {
    truncated: true,
    full_output_path: fullPath,
    original_size: originalSize
  });
  
  return {
    content: truncated,
    truncated: true,
    full_output_path: fullPath,
    original_size: originalSize
  };
}
```

### Skill Hot-Reload Flow

```rust
// In Beacon
struct SkillWatcher {
    watcher: RecommendedWatcher,
    skills: Arc<RwLock<HashMap<String, Skill>>>,
}

impl SkillWatcher {
    fn new(paths: Vec<PathBuf>) -> Result<Self> {
        let (tx, rx) = channel();
        let mut watcher = notify::recommended_watcher(tx)?;
        
        for path in &paths {
            if path.exists() {
                watcher.watch(path, RecursiveMode::Recursive)?;
            }
        }
        
        // Spawn handler thread
        let skills = Arc::new(RwLock::new(HashMap::new()));
        let skills_clone = skills.clone();
        
        thread::spawn(move || {
            for event in rx {
                match event {
                    Ok(Event { kind: Create(_) | Modify(_), paths, .. }) => {
                        for path in paths {
                            if let Some(skill) = load_skill(&path) {
                                skills_clone.write().unwrap().insert(skill.name.clone(), skill);
                                info!("Reloaded skill: {}", skill.name);
                            }
                        }
                    }
                    Ok(Event { kind: Remove(_), paths, .. }) => {
                        for path in paths {
                            if let Some(name) = extract_skill_name(&path) {
                                skills_clone.write().unwrap().remove(&name);
                                info!("Unloaded skill: {}", name);
                            }
                        }
                    }
                    _ => {}
                }
            }
        });
        
        Ok(Self { watcher, skills })
    }
}
```

### Mode Switching

```typescript
// Mode configurations
const MODES: Record<AgentMode, ModeConfig> = {
  architect: {
    mode: 'architect',
    allowed_tools: ['Read', 'mentu_commit', 'mentu_capture', 'Task'],
    denied_tools: ['Write', 'Edit', 'Bash'],
    system_prompt_addition: `
You are operating in ARCHITECT MODE.
Your role is strategic planning and intent articulation.
You can observe the codebase, articulate what should exist, and create commitments.
You CANNOT write files, edit code, or execute commands directly.
Create commitments for Executors to implement your plans.
`,
    requires_commitment: false
  },
  
  executor: {
    mode: 'executor',
    allowed_tools: ['Read', 'Write', 'Edit', 'Bash', 'mentu_capture'],
    denied_tools: [],
    system_prompt_addition: `
You are operating in EXECUTOR MODE.
Your role is implementation within the scope of your claimed commitment.
Stay focused on the commitment. Capture evidence of your work.
Do not expand scope beyond what was committed.
`,
    requires_commitment: true
  },
  
  auditor: {
    mode: 'auditor',
    allowed_tools: ['Read', 'Bash(test*)', 'Bash(lint*)', 'mentu_approve', 'mentu_reject', 'mentu_capture'],
    denied_tools: ['Write', 'Edit'],
    system_prompt_addition: `
You are operating in AUDITOR MODE.
Your role is review and validation.
You can read code, run tests, and render verdicts.
You CANNOT modify code directly.
Approve good work. Reject or request changes for problems.
`
  }
};

// Mode switching in Agent Chat
function handleModeSwitch(command: string): ModeConfig | null {
  if (command === '/architect') return MODES.architect;
  if (command === '/executor') return MODES.executor;
  if (command === '/auditor') return MODES.auditor;
  return null;
}
```

### Denial Resilience Prompt

```typescript
const RESILIENCE_PROMPT = `
## On Permission Denials

When a tool or operation is denied by genesis enforcement:

1. **Note the reason** - The denial message explains why. Read it carefully.

2. **Consider alternatives** - Think about other ways to accomplish the goal:
   - Different command that achieves same result
   - Decompose into smaller steps that are allowed
   - Use a different tool that has permission
   
3. **Try the alternative** - If you identified a valid alternative, try it.

4. **Request clarification** - If no alternative exists:
   - Explain what you're trying to accomplish
   - Explain why the denied approach seemed necessary
   - Ask the human how they'd like to proceed

5. **Never just fail** - A denial is feedback, not a dead end.

Example:
- Denied: "git push" (Executors can't push directly)
- Alternative: Create a PR for human review
- Or: Ask human to push after reviewing changes
`;
```

---

## Implementation

### Deliverables

| File | Repository | Purpose |
|------|------------|---------|
| `src/engine/output.rs` | mentu-beacon | Output truncation with file reference |
| `src/engine/skills.rs` | mentu-beacon | Skill hot-reload with file watcher |
| `src/components/chat/mode-switcher.tsx` | mentu-web | Mode selection UI component |
| `src/lib/agent/modes.ts` | mentu-web | Mode configurations and tool filtering |
| `src/prompts/resilience.ts` | agent-service | Denial resilience prompt injection |
| `src/components/output/full-output-viewer.tsx` | mentu-web | View full output from file |

### Build Order

1. **Output Truncation**: Beacon stores large outputs to files
2. **Output Viewer**: Web UI to fetch and display full output
3. **Skill Hot-Reload**: Beacon watches skill directories
4. **Mode Configs**: Define tool sets per mode
5. **Mode Switcher UI**: Component for switching modes
6. **Resilience Prompt**: Inject into agent system prompts

### Integration Points

| System | Integration | Notes |
|--------|-------------|-------|
| mentu-beacon | Output truncation, skill watching | Core execution changes |
| mentu-web | Mode switcher, output viewer | UI components |
| agent-service | Mode-aware prompts, resilience | Agent behavior |
| mentu-proxy | Serve full output files | File serving endpoint |

---

## Constraints

- Truncation threshold is 30KB (matches Claude Code)
- Output files stored in `/tmp/mentu/outputs/` (ephemeral by design)
- Output files cleaned up after 7 days
- Skill hot-reload debounced (100ms) to handle rapid saves
- Mode switch in conversation persists for session only
- Executor mode requires an active claimed commitment
- Denial resilience is prompt-based, not enforcement-based

---

## Success Criteria

### Output Truncation

- [ ] Output > 30KB truncated with file reference
- [ ] Full output accessible via file path
- [ ] UI shows truncation indicator with "View full" option
- [ ] spawn_logs.meta includes truncation metadata

### Skill Hot-Reload

- [ ] Creating skill file loads it immediately
- [ ] Editing skill file reloads it immediately
- [ ] Deleting skill file unloads it immediately
- [ ] No Beacon restart needed for skill changes

### Mode Switching

- [ ] `/architect` switches to architect mode
- [ ] `/executor` switches to executor mode (requires commitment)
- [ ] `/auditor` switches to auditor mode
- [ ] Mode shown in Agent Chat header
- [ ] Tool availability changes with mode

### Denial Resilience

- [ ] Agent receives denial reason in feedback
- [ ] Agent attempts alternative approach when denied
- [ ] Agent asks human when no alternative exists
- [ ] Task doesn't fail immediately on denial

---

## Verification Commands

```bash
# Test output truncation
# Create a command that produces large output
mentu exec --test "find / -name '*.ts' 2>/dev/null | head -10000"
# Check spawn_logs for truncation
SELECT content, meta FROM spawn_logs WHERE command_id = 'xxx';
# Verify file exists
ls /tmp/mentu/outputs/

# Test skill hot-reload
# Create a skill file
cat > ~/.mentu/skills/test-skill.md << 'EOF'
---
name: test-skill
description: A test skill for verification
author_type: executor
---
This skill does testing things.
EOF
# Verify loaded (check Beacon logs or API)
mentu skills list | grep test-skill
# Modify and verify reload
echo "Updated content" >> ~/.mentu/skills/test-skill.md
mentu skills show test-skill | grep Updated

# Test mode switching (in Agent Chat)
# Type: /architect
# Verify: Can't use Write tool
# Type: /executor
# Verify: Must claim commitment first
# Type: /auditor
# Verify: Can run tests but not edit
```

---

## Examples

### Example 1: Large Test Output

```
Agent runs: npm test (produces 100KB output)

Result in spawn_logs:
- content: First 30KB + "[Output truncated at 30KB. Full output (102400 bytes): /tmp/mentu/outputs/cmd_abc123_stdout.txt]"
- meta: { truncated: true, full_output_path: "...", original_size: 102400 }

UI shows:
┌─────────────────────────────────────────┐
│ npm test                                 │
│ PASS src/auth.test.ts                    │
│ PASS src/user.test.ts                    │
│ ...                                      │
│ [Output truncated]  [View full output]   │
└─────────────────────────────────────────┘
```

### Example 2: Skill Hot-Reload

```bash
# Edit skill while Beacon is running
vim .mentu/skills/deploy.md

# Beacon log shows:
[2026-01-08 14:32:15] INFO Detected change: .mentu/skills/deploy.md
[2026-01-08 14:32:15] INFO Reloaded skill: deploy

# Skill immediately available
/deploy  # Works with updated content
```

### Example 3: Mode Switching

```
User: /architect
System: Switched to Architect mode. You can plan and create commitments but cannot modify code directly.

User: Please update the auth flow to use JWT

Agent: I'll create a commitment for this work.
[Uses mentu_commit tool - allowed]

I've created commitment cmt_xyz to "Update auth flow to use JWT tokens".
An Executor can claim this commitment to implement the changes.

User: Actually, can you just make the change yourself?

Agent: In Architect mode, I cannot modify files directly. 
Would you like to:
1. Switch to /executor mode and claim the commitment
2. Have another agent claim and implement it
3. I can elaborate the plan further
```

### Example 4: Denial Resilience

```
User: Deploy the changes to production

Agent: I'll push the changes to trigger deployment.
[Tries: git push origin main]

Tool denied: "Executors cannot push directly. Create a PR for review."

I see direct pushing is restricted. Let me try an alternative:
[Tries: gh pr create --title "Deploy changes" --body "..."]

I've created PR #42 for the changes. The deployment will proceed 
after the PR is reviewed and merged. Would you like me to request 
a review from someone?
```

---

## References

- Claude Code 2.1.0 Changelog: Output truncation, background tasks
- `SPEC-AuthorTypes-v1.1`: Mode definitions
- `mentu-beacon/src-tauri/src/engine/executor.rs`: Current execution logic
- `agent-service/src/prompts/`: Existing prompt templates

---

*Agent Execution Enhancements: Truncate intelligently. Reload instantly. Switch modes explicitly. Adapt on denial.*
```

---