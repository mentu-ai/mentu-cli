Layer 2 intelligent workspace customization. Reads your project's CLAUDE.md and .env to auto-detect stack, build commands, conventions, and domains -- then customizes all Mentu workspace files for your specific project.

**Usage:** `/mentu-workspace-init`

---

## Instructions

This command runs AFTER `mentu workspace-init` has scaffolded the template files. It reads your project context and customizes the templates for your specific codebase.

### Phase 1: Detect Project Context

Read these files to build a project profile:

1. **CLAUDE.md** (or README.md if no CLAUDE.md):
   - Tech stack (React, Next.js, Vue, Node, Python, Rust, etc.)
   - Build command (`npm run build`, `cargo build`, `make`, etc.)
   - Test command (`npm test`, `cargo test`, `pytest`, etc.)
   - Path aliases (`@/` -> `src/`, `~/` -> root, etc.)
   - Roles / auth model (admin, user, multi-tenant, etc.)
   - Coding conventions (language style, import rules, etc.)
   - Dev server port

2. **.env** (or `.env.example`, `.env.local`):
   - `MENTU_API_TOKEN` or `VITE_MENTU_API_TOKEN` or similar -> token env var name
   - `MENTU_WORKSPACE_ID` or `VITE_MENTU_WORKSPACE_ID` or similar -> workspace env var name
   - Dev port if specified

3. **package.json** / **Cargo.toml** / **pyproject.toml**:
   - Project name
   - Build/test scripts
   - Framework detection

4. **mentu-manifest.yaml** (created by workspace-init):
   - Pre-filled values to use as baseline

Present detected context:
```
## Detected Project Profile

- **Project**: {name}
- **Stack**: {framework} + {language} + {db}
- **Build**: {build_cmd}
- **Test**: {test_cmd}
- **Path alias**: {alias} -> {target}
- **Roles**: {role list}
- **Dev port**: {port}
- **Token env var**: {var name}
- **Workspace env var**: {var name}
- **Domains**: {detected domains}
```

### Phase 2: Customize Triage (Gate 3 Domains)

Edit `.claude/commands/triage.md`:
- Update `PROJECT_DOMAINS` with detected domains
- If no domains detected, prompt user

### Phase 3: Customize Fix/Batch/Autopilot

Edit `.claude/commands/fix.md`, `batch.md`, `autopilot.md`:
- Update critical rules section with project-specific constraints:
  - Stack identity (e.g., "This is **ProjectName** (Next.js 14+ App Router + TypeScript)")
  - Path alias rule (e.g., "`@/` path alias maps to project root")
  - Multi-tenant rule if applicable (e.g., "every business table has `tenantId`")
  - Role list if applicable

### Phase 4: Customize Deslop Anti-Patterns

Edit `.claude/skills/deslop/SKILL.md`:
- Add project-specific slop patterns based on detected stack:
  - **React/Next.js**: Missing `revalidatePath`, unnecessary `"use client"`, `React.FC` usage
  - **Prisma**: Missing `tenantId`, N+1 queries, unused imports
  - **Vue**: Unnecessary `ref()` wrapping, missing `computed`
  - **Python**: Bare `except`, unused imports, unnecessary `type: ignore`
  - **Rust**: Unnecessary `.clone()`, `unwrap()` in non-test code

### Phase 5: Customize Review Agents

Edit agents in `.claude/agents/`:
- **review-security.md**: Update multi-tenant checks, auth model, CWE focus areas
- **review-bugs.md**: Update business logic checks, framework-specific patterns
- **review-guidelines.md**: Update CLAUDE.md rules reference, convention checks
- **review-visual.md**: Update dev server port, auth flow, viewport priorities
- **review-intent.md**: Update route patterns for framework

### Phase 6: Verify Setup

Run verification:

```bash
# 1. CRITICAL: Verify .env is gitignored (credentials must never be committed)
grep -q '\.env' .gitignore && echo ".env is gitignored ✓" || echo "WARNING: .env NOT in .gitignore — add it!"
```

```bash
# 2. Verify git has at least one commit (Ralph needs HEAD to be resolvable)
git rev-parse HEAD > /dev/null 2>&1 && echo "Git HEAD exists ✓" || echo "WARNING: No git commit yet — run: git add -A && git commit -m 'chore: init workspace'"
```

```bash
# 3. Check mentu connectivity
MENTU_TOKEN=$(grep '^{token_env_var}=' .env | cut -d'"' -f2)
MENTU_WS=$(grep '^{ws_env_var}=' .env | cut -d'"' -f2)
curl -s "https://mentu-proxy.affihub.workers.dev/status" \
  -H "X-Proxy-Token: $MENTU_TOKEN" \
  -H "X-Workspace-Id: $MENTU_WS"
```

```bash
# 4. Verify build command works
{{BUILD_CMD}}
```

```bash
# 5. Run ralph preflight (requires git HEAD to exist)
ralph preflight 2>&1 || echo "Ralph preflight failed — ensure git has at least one commit"
```

### Phase 7: Report

Output a summary of what was detected and customized:

```markdown
## Workspace Customization Complete

### Detected
- Stack: {stack}
- Build: {build_cmd}
- Domains: {domains}
- Roles: {roles}

### Customized
- [x] triage.md -- Gate 3 domains updated
- [x] fix.md -- Critical rules updated with stack identity
- [x] batch.md -- Critical rules updated
- [x] autopilot.md -- Critical rules updated
- [x] deslop/SKILL.md -- {N} project-specific anti-patterns added
- [x] review-security.md -- Auth model updated
- [x] review-bugs.md -- Business logic checks updated
- [x] review-guidelines.md -- Convention rules updated
- [x] review-visual.md -- Dev port updated to {port}
- [x] review-intent.md -- Route patterns updated

### Verified
- Mentu API: {connected/failed}
- Build: {pass/fail}

### Next Steps
1. Run `/triage` to see your current ticket dashboard
2. Run `/fix <mem_id>` to investigate and plan a bug fix
3. Run `/autopilot` to start autonomous bug fixing
```

---

## Rules

1. **Read before writing.** Always read the existing file before customizing it.
2. **Preserve structure.** Only modify the project-specific sections, don't rewrite entire files.
3. **Be conservative.** If you can't confidently detect a value, leave the template default and flag it for the user.
4. **Don't create files.** This command customizes existing files, it doesn't create new ones.
5. **Report everything.** The user should know exactly what was detected and changed.
