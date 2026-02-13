# Visual Testing Protocol v1.0

## Overview

The Visual Testing Protocol extends the Mentu Dual Triad framework with browser-based visual verification. This closes the gap between "code compiles" and "feature works in browser" by requiring screenshot evidence for UI features.

**Key insight**: Unit tests and build checks verify technical correctness. Visual tests verify user-facing correctness.

## The Three Roles

| Role | Responsibility | Artifact |
|------|----------------|----------|
| **Architect** | Define what should be visible | Visual test spec (YAML) |
| **Executor** | Capture screenshots proving it works | Evidence memories + screenshots |
| **Technical Validator** | Verify visual evidence exists | Pass/Fail verdict |

### Role Boundaries

- **Architect** creates specs WITHOUT seeing implementation
- **Executor** implements feature AND captures visual evidence
- **Technical Validator** checks evidence exists (doesn't judge quality)

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISUAL TESTING WORKFLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ARCHITECT PHASE                                             │
│     Create visual test spec                                     │
│     ↓                                                           │
│     /visual-test-spec "User login form"                         │
│     ↓                                                           │
│     docs/visual-tests/cmt_abc123-spec.yaml                      │
│                                                                 │
│  2. EXECUTOR PHASE                                              │
│     Implement feature                                           │
│     ↓                                                           │
│     Write code, tests                                           │
│     ↓                                                           │
│     mentu visual-test cmt_abc123                                │
│     ↓                                                           │
│     Puppeteer executes spec → screenshots → evidence memories   │
│                                                                 │
│  3. TECHNICAL VALIDATOR PHASE                                   │
│     Check for visual evidence                                   │
│     ↓                                                           │
│     If spec exists: require visual evidence                     │
│     If no spec: visual evidence optional                        │
│     ↓                                                           │
│     PASS/FAIL verdict                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Visual Test Specification

### Format

Visual test specs are YAML files stored at `docs/visual-tests/{commitment_id}-spec.yaml`.

```yaml
feature: "Brief feature description"
commitment_id: cmt_abc123
workspace_id: 550e8400-e29b-41d4-a716-446655440000  # Optional
base_url: "http://localhost:3000"  # Default dev server

visual_checkpoints:
  - name: "checkpoint-name"
    description: "What this checkpoint validates"
    url: "http://localhost:3000/page"
    viewport: { width: 1280, height: 720 }  # Optional
    selectors:  # CSS selectors that must be present
      - "input[type='email']"
      - "button[type='submit']"
    actions:  # Optional - user interactions
      - { type: "fill", selector: "input", value: "text" }
      - { type: "click", selector: "button" }
    wait_for: "selector"  # Optional - wait before screenshot
    expect_url: "http://localhost:3000/next"  # Optional - for navigation
```

### Checkpoint Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (alphanumeric-dash) |
| `description` | Yes | What's being tested |
| `url` | Yes | Page URL to navigate to |
| `viewport` | No | Browser size (default: 1280x720) |
| `selectors` | No | Elements that must exist |
| `actions` | No | Interactions before screenshot |
| `wait_for` | No | Element or "navigation" to wait for |
| `expect_url` | No | Expected URL after actions |

### Action Types

| Type | Parameters | Example |
|------|------------|---------|
| `fill` | `selector`, `value` | Fill input field |
| `click` | `selector` | Click element |
| `select` | `selector`, `value` | Select dropdown option |
| `hover` | `selector` | Hover over element |
| `focus` | `selector` | Focus element |
| `blur` | `selector` | Remove focus |
| `keypress` | `key`, `delay` | Press keyboard key |

## Creating Visual Test Specs

### Via Skill (Recommended)

```bash
/visual-test-spec "User login form"
```

This creates a spec with:
- Commitment ID from current context
- 3-5 checkpoints covering common scenarios
- Proper YAML formatting

### Manual Creation

1. Create `docs/visual-tests/` directory
2. Create `{commitment_id}-spec.yaml` file
3. Define checkpoints following the format above
4. Link to commitment (optional):
   ```bash
   mentu annotate cmt_abc123 "Visual test spec created at docs/visual-tests/cmt_abc123-spec.yaml"
   ```

## Executing Visual Tests

### Command

```bash
mentu visual-test <commitment_id>
```

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview test plan without executing |
| `--workspace-id <id>` | Override workspace ID from spec |
| `--base-url <url>` | Override base URL (e.g., staging server) |
| `--verbose` | Show detailed execution output |

### Execution Methods

**Via Task tool (session-bound)**:
- Use for immediate feedback during development
- Dies when terminal closes
- Blocks until complete

**Via mentu-bridge (persistent)**:
- Use for long-running test suites
- Survives terminal closure
- Executes async, captures evidence
- Command: `mentu spawn cmt_xxx --directory /path`

### What Happens During Execution

1. **Read spec**: Load visual test spec from YAML
2. **Check server**: Verify dev server running at base_url
3. **For each checkpoint**:
   - Generate Puppeteer script
   - Execute via SSH on VPS (isolated browser)
   - Navigate to URL
   - Wait for selectors
   - Perform actions
   - Capture full-page screenshot
   - Upload to visual-evidence bucket
   - Create Mentu evidence memory
4. **Annotate commitment**: Record test results
5. **Return summary**: JSON with pass/fail status

## Evidence Capture

### Screenshot Storage

- **Bucket**: `visual-evidence` (Supabase Storage)
- **Path**: `{workspace_id}/visual/{timestamp}-{checkpoint_name}.png`
- **Retention**: 30 days (automatic cleanup)
- **Deduplication**: SHA-256 hash matching
- **Public access**: Yes (via CDN URL)

### Evidence Memories

For each successful screenshot:

```bash
mentu capture "Visual checkpoint 'form-renders': Login form displays correctly. Screenshot: https://..." \
  --kind visual-evidence \
  --actor agent:visual-test-executor
```

Memory metadata:
- `kind`: "visual-evidence"
- `actor`: "agent:visual-test-executor"
- `body`: Checkpoint description + screenshot URL

### Commitment Annotation

After all checkpoints:

```bash
mentu annotate cmt_abc123 "Visual evidence captured: 4 checkpoints completed. Evidence memories: mem_111, mem_222, mem_333, mem_444"
```

## Technical Validator Integration

### Conditional Validation

```
IF visual test spec exists at docs/visual-tests/{cmt_id}-spec.yaml:
  THEN visual evidence is REQUIRED
  RUN: mentu show {cmt_id} --annotations | grep "visual-evidence"
  IF count > 0: PASS
  IF count = 0: FAIL (spec exists but no evidence)

ELSE (no spec):
  Visual evidence is OPTIONAL
  Validation result: null (doesn't affect overall verdict)
```

### Validator Output

```json
{
  "validator": "technical",
  "verdict": "PASS" | "FAIL",
  "checks": {
    "tsc": true,
    "tests": true,
    "build": true,
    "visual_evidence": true | false | null
  },
  "summary": "All technical checks passed including visual evidence"
}
```

### Headless Validator

The technical validator runs in two modes:

**SubAgent mode** (`.claude/agents/technical-validator.md`):
- Spawned via Task tool
- Interactive output
- Returns structured JSON

**Headless mode** (`.claude/validators/technical.sh`):
- Invoked via `claude -p`
- Schema-enforced output
- Runs in CI/CD pipelines

Both check for visual evidence when spec exists.

## Puppeteer Execution

### VPS Architecture

```
Local Machine                    VPS (208.167.255.71)
     │                                    │
     │  SSH exec puppeteer script         │
     ├───────────────────────────────────>│
     │                                    │
     │                          Docker: puppeteer-mcp
     │                                    │
     │                          ┌─────────┴─────────┐
     │                          │ Puppeteer         │
     │                          │ Chromium headless │
     │                          │ Screenshot gen    │
     │                          └─────────┬─────────┘
     │                                    │
     │                          Upload to Supabase
     │                                    │
     │<───────────────────────────────────┤
     │  Return screenshot URL             │
```

### Script Template

```javascript
import puppeteer from 'puppeteer';
import { uploadScreenshot } from './upload-screenshot.js';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Perform actions...
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'test@example.com');
  await page.click('button[type="submit"]');

  // Capture screenshot
  const screenshotPath = '/project/screenshots/cmt_abc123-checkpoint.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  // Upload to visual-evidence bucket
  const result = await uploadScreenshot(screenshotPath, workspaceId, 'visual-evidence');
  console.log(JSON.stringify(result));
})();
```

## Best Practices

### What to Test Visually

✅ **Do test**:
- Critical user journeys (login, checkout, registration)
- Form validation states (empty, invalid, valid)
- Responsive breakpoints (mobile, tablet, desktop)
- Error messages and success states
- Modal dialogs and overlays
- Data visualization rendering

❌ **Don't test**:
- Every input combination (use unit tests)
- Browser-native alert/confirm dialogs (Claude can't see these)
- Backend logic (use integration tests)
- Performance metrics (use lighthouse)

### Selector Best Practices

- Prefer semantic selectors: `button[type='submit']` over `.btn-primary`
- Use data attributes for stability: `[data-testid='login-button']`
- Avoid generated classes: not `.css-1a2b3c`
- Use `:contains()` sparingly (fragile to text changes)

### Viewport Guidelines

- **Desktop**: 1280x720 or 1920x1080
- **Tablet**: 768x1024
- **Mobile**: 375x667 (iPhone SE) or 390x844 (iPhone 12/13)

### Wait Strategies

- Always use `wait_for` for dynamic content
- `wait_for: "navigation"` for page transitions
- `wait_for: ".loading:not(.visible)"` for loading states
- Add explicit waits for animations

## Examples

### Example 1: Simple Form Rendering

```yaml
feature: "User registration form"
commitment_id: cmt_abc123
base_url: "http://localhost:3000"
visual_checkpoints:
  - name: "form-renders"
    description: "Registration form displays all required fields"
    url: "http://localhost:3000/register"
    selectors:
      - "input[name='email']"
      - "input[name='password']"
      - "input[name='confirmPassword']"
      - "button[type='submit']"
      - "h1:contains('Register')"
```

### Example 2: Form Validation

```yaml
feature: "Login form validation"
commitment_id: cmt_def456
base_url: "http://localhost:3000"
visual_checkpoints:
  - name: "empty-validation"
    description: "Shows error when submitting empty form"
    url: "http://localhost:3000/login"
    actions:
      - { type: "click", selector: "button[type='submit']" }
    wait_for: ".error-message"
    selectors:
      - ".error-message:contains('Email is required')"
      - ".error-message:contains('Password is required')"

  - name: "invalid-email"
    description: "Shows error for invalid email format"
    url: "http://localhost:3000/login"
    actions:
      - { type: "fill", selector: "input[name='email']", value: "not-an-email" }
      - { type: "click", selector: "button[type='submit']" }
    wait_for: ".error-message"
    selectors:
      - ".error-message:contains('Invalid email')"
```

### Example 3: User Workflow

```yaml
feature: "Complete login workflow"
commitment_id: cmt_ghi789
base_url: "http://localhost:3000"
visual_checkpoints:
  - name: "login-page"
    description: "Login page renders correctly"
    url: "http://localhost:3000/login"
    selectors:
      - "input[type='email']"
      - "input[type='password']"
      - "button:contains('Sign In')"

  - name: "successful-login"
    description: "User redirected to dashboard after login"
    url: "http://localhost:3000/login"
    actions:
      - { type: "fill", selector: "input[type='email']", value: "test@example.com" }
      - { type: "fill", selector: "input[type='password']", value: "Test123!" }
      - { type: "click", selector: "button[type='submit']" }
    wait_for: "navigation"
    expect_url: "http://localhost:3000/dashboard"
    selectors:
      - "h1:contains('Dashboard')"
      - "nav .user-menu"
```

### Example 4: Responsive Design

```yaml
feature: "Mobile navigation menu"
commitment_id: cmt_jkl012
base_url: "http://localhost:3000"
visual_checkpoints:
  - name: "desktop-nav"
    description: "Desktop navigation is horizontal"
    url: "http://localhost:3000"
    viewport: { width: 1280, height: 720 }
    selectors:
      - "nav.horizontal"
      - "nav a[href='/products']"
      - "nav a[href='/about']"

  - name: "mobile-nav-closed"
    description: "Mobile hamburger menu shows on small screens"
    url: "http://localhost:3000"
    viewport: { width: 375, height: 667 }
    selectors:
      - "button.hamburger"
      - "nav.mobile:not(.open)"

  - name: "mobile-nav-open"
    description: "Mobile menu expands when hamburger clicked"
    url: "http://localhost:3000"
    viewport: { width: 375, height: 667 }
    actions:
      - { type: "click", selector: "button.hamburger" }
    wait_for: "nav.mobile.open"
    selectors:
      - "nav.mobile.open a[href='/products']"
      - "nav.mobile.open a[href='/about']"
```

## Dual Triad Integration

### Creation Triad

| Agent | Action | Artifact |
|-------|--------|----------|
| **Architect** | `/visual-test-spec "Feature"` | YAML spec |
| **Auditor** | Review spec for safety | Approval/rejection |
| **Executor** | `mentu visual-test cmt_xxx` | Screenshots + evidence |

### Verification Triad

| Validator | Check | Verdict |
|-----------|-------|---------|
| **Intent** | Did we build what was envisioned? | Scope alignment |
| **Safety** | No secrets in screenshots? | Security check |
| **Technical** | Does it work? → Visual evidence exists? | **ENHANCED** |

### Accountability Chain

```
Architect defines vision (spec)
    ↓
Auditor approves constraints
    ↓
Executor implements + captures evidence
    ↓
Technical Validator verifies evidence exists
    ↓
If PASS: commitment can be submitted
If FAIL: Executor must fix + re-capture
```

## Troubleshooting

### Problem: Selectors not found

**Solution**: Use `wait_for` to ensure element is rendered before screenshot

```yaml
wait_for: "button[type='submit']"
```

### Problem: Screenshots show loading spinners

**Solution**: Wait for loading to complete

```yaml
wait_for: ".loading:not(.visible)"
# or
wait_for: "h1:contains('Dashboard')"  # Wait for actual content
```

### Problem: Form submit triggers navigation too fast

**Solution**: Use navigation wait and check URL

```yaml
actions:
  - { type: "click", selector: "button[type='submit']" }
wait_for: "navigation"
expect_url: "http://localhost:3000/dashboard"
```

### Problem: Responsive tests fail

**Solution**: Verify viewport matches CSS breakpoints exactly

```yaml
viewport: { width: 768, height: 1024 }  # Must match @media queries
```

### Problem: Dev server not running

**Error**: `mentu visual-test` reports connection refused

**Solution**: Start dev server before running tests

```bash
npm run dev &  # Start in background
mentu visual-test cmt_abc123
```

### Problem: Screenshot deduplication issues

**Symptom**: Same screenshot uploaded twice shows `deduplicated: false`

**Cause**: Different buckets or workspaces

**Solution**: Deduplication is per-bucket and per-workspace. Screenshots in `visual-evidence` bucket won't deduplicate against `bug-attachments` bucket.

## CLI Reference

### Visual Test Commands

```bash
# Create visual test spec (skill)
/visual-test-spec "Feature description"

# Execute visual tests
mentu visual-test <commitment_id>
mentu visual-test cmt_abc123 --dry-run
mentu visual-test cmt_abc123 --base-url http://localhost:4000
mentu visual-test cmt_abc123 --verbose

# Check for visual evidence
mentu show cmt_abc123 --annotations | grep "visual-evidence"

# List visual test specs
ls docs/visual-tests/*.yaml

# View spec content
cat docs/visual-tests/cmt_abc123-spec.yaml
```

### Evidence Commands

```bash
# Capture visual evidence manually
mentu capture "Visual checkpoint: ..." --kind visual-evidence

# Show all visual evidence for commitment
mentu show cmt_abc123 --annotations | grep "visual-evidence"

# List all visual evidence memories
mentu list memories --kind visual-evidence
```

### Validation Commands

```bash
# Run technical validator (includes visual evidence check)
CMT_ID=cmt_abc123 CMT_BODY="Task" .claude/validators/technical.sh

# Check validation result
echo $?  # 0 = PASS, non-zero = FAIL
```

## Related Documentation

- **Visual Test Spec Skill**: `.claude/skills/visual-test-spec/SKILL.md`
- **Visual Test Executor Agent**: `.claude/agents/visual-test-executor.md`
- **Technical Validator Agent**: `.claude/agents/technical-validator.md`
- **Technical Validator Script**: `.claude/validators/technical.sh`
- **Dual Triad Framework**: `docs/DUAL-TRIAD.md`
- **Execution Modes**: `docs/Execution-Modes.md`
- **Puppeteer Upload Script**: `/home/mentu/puppeteer-mcp/upload-screenshot.js` (VPS)

## Appendix: Anthropic Inspiration

This protocol is inspired by Anthropic's engineering practices:

> "agents initially failed to recognize non-functional features when testing only involved unit tests or curl commands"

**Source**: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

**Key lessons applied**:
1. **Browser-based validation**: Puppeteer MCP for end-to-end visual verification
2. **Feature state tracking**: Mentu commitments as feature list (instead of feature_list.json)
3. **Session initialization**: Standardized context loading (deferred to Phase 4)
4. **Observer-Reasoner-Actor**: Signal collection → decision → execution (deferred to Phase 3)

**Mentu advantage**: We have append-only ledger + evidence capture built in. Anthropic had to add persistence. We start with it.

---

*Visual Testing Protocol v1.0 - Part of the Mentu Dual Triad Framework*
