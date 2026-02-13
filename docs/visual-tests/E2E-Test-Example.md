# End-to-End Visual Testing Example

This document demonstrates the complete visual testing workflow using the login form example.

## Scenario: User Login Form Feature

**Feature**: Implement a user login form with email/password validation and successful login redirect.

## Phase 1: Architect Creates Visual Test Spec

### Step 1: Create Commitment

```bash
# Capture the feature request
MEMORY=$(mentu capture "Implement user login form with validation" --kind feature --json | jq -r '.id')
# Output: mem_abc123

# Create commitment
COMMITMENT=$(mentu commit "Deliver working login form with visual evidence" --source $MEMORY --json | jq -r '.id')
# Output: cmt_example_login
```

### Step 2: Create Visual Test Spec

**Method 1: Via skill (recommended)**
```bash
/visual-test-spec "User login form with validation"
```

**Method 2: Manual creation**
```bash
# Already created at: docs/visual-tests/example-login-form-spec.yaml
```

**Spec content**: See `example-login-form-spec.yaml`
- 5 checkpoints:
  1. form-renders: Initial display
  2. empty-validation: Empty form errors
  3. invalid-email: Invalid email error
  4. successful-login: Login redirect
  5. mobile-responsive: Mobile view

### Step 3: Link Spec to Commitment

```bash
mentu annotate cmt_example_login "Visual test spec created at docs/visual-tests/example-login-form-spec.yaml"
```

**Architect's work is done**. The spec defines "what should be visible" without seeing implementation.

---

## Phase 2: Executor Implements Feature

### Step 1: Claim Commitment

```bash
mentu claim cmt_example_login --actor agent:executor
```

### Step 2: Implement the Feature

```typescript
// Example implementation (simplified)
// src/pages/login.tsx

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: string[] = [];
    if (!email) newErrors.push('Email is required');
    if (!password) newErrors.push('Password is required');
    if (email && !isValidEmail(email)) newErrors.push('Invalid email');

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    // Authenticate
    const result = await login(email, password);
    if (result.success) {
      router.push('/dashboard');
    }
  };

  return (
    <div className="mobile-optimized-form">
      <h1>Sign In</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit">Sign In</button>
      </form>

      {errors.map(error => (
        <div key={error} className="error-message">{error}</div>
      ))}

      <a href="/register">Don't have an account? Register</a>
    </div>
  );
}
```

### Step 3: Run Unit Tests

```bash
npm test
# ✓ LoginPage renders correctly
# ✓ Email validation works
# ✓ Password validation works
# ✓ Successful login redirects
```

### Step 4: Execute Visual Tests

```bash
# Start dev server
npm run dev &

# Execute visual tests
mentu visual-test cmt_example_login
```

**What happens**:
1. Reads `docs/visual-tests/example-login-form-spec.yaml`
2. Checks dev server at http://localhost:3000
3. For each of 5 checkpoints:
   - Generates Puppeteer script
   - Executes via SSH on VPS
   - Navigates, interacts, captures screenshot
   - Uploads to visual-evidence bucket
   - Creates evidence memory

**Expected output**:
```
Executing visual tests for commitment cmt_example_login...
Spec: docs/visual-tests/example-login-form-spec.yaml

Checkpoint 1/5: form-renders
  ✓ Screenshot captured: https://...supabase.co/.../visual/20260111-form-renders.png
  ✓ Evidence created: mem_111

Checkpoint 2/5: empty-validation
  ✓ Screenshot captured: https://...supabase.co/.../visual/20260111-empty-validation.png
  ✓ Evidence created: mem_222

Checkpoint 3/5: invalid-email
  ✓ Screenshot captured: https://...supabase.co/.../visual/20260111-invalid-email.png
  ✓ Evidence created: mem_333

Checkpoint 4/5: successful-login
  ✓ Screenshot captured: https://...supabase.co/.../visual/20260111-successful-login.png
  ✓ Evidence created: mem_444

Checkpoint 5/5: mobile-responsive
  ✓ Screenshot captured: https://...supabase.co/.../visual/20260111-mobile-responsive.png
  ✓ Evidence created: mem_555

Visual tests complete: 5/5 checkpoints passed
Commitment annotated with results
```

### Step 5: Verify Evidence Captured

```bash
mentu show cmt_example_login --annotations | grep "visual-evidence"
# Output shows 5 visual-evidence memories
```

**Executor's implementation is complete**.

---

## Phase 3: Technical Validator Checks

### Step 1: Submit Commitment

```bash
mentu submit cmt_example_login --summary "Login form complete with visual evidence" --tier tier_2
```

### Step 2: Technical Validator Runs (Automatic)

The technical validator is triggered by the submit operation. It checks:

```bash
# 1. TypeScript compilation
tsc --noEmit
# ✓ PASS

# 2. Tests
npm test
# ✓ PASS

# 3. Build
npm run build
# ✓ PASS

# 4. Visual Evidence Check
# Check if spec exists
if [ -f "docs/visual-tests/cmt_example_login-spec.yaml" ]; then
  # Spec exists - visual evidence is REQUIRED
  VISUAL_COUNT=$(mentu show cmt_example_login --annotations | grep "visual-evidence" | wc -l)
  # Count: 5

  if [ $VISUAL_COUNT -gt 0 ]; then
    VISUAL_EVIDENCE=true  # ✓ PASS
  else
    VISUAL_EVIDENCE=false # ✗ FAIL
  fi
else
  # No spec - visual evidence is optional
  VISUAL_EVIDENCE=null  # ⊘ SKIP
fi
```

**Validator output**:
```json
{
  "validator": "technical",
  "verdict": "PASS",
  "attribution": {
    "author_type": "executor",
    "responsible_for": "technical"
  },
  "checks": {
    "tsc": true,
    "tests": true,
    "build": true,
    "visual_evidence": true
  },
  "summary": "All technical checks passed including visual evidence (5 checkpoints captured)"
}
```

### Step 3: Evidence Captured

```bash
mentu capture "Technical validation: PASS - tsc:true, tests:true, build:true, visual_evidence:true (5 checkpoints)" \
  --kind validation \
  --actor agent:technical-validator
# Output: mem_validator_001
```

### Step 4: Auto-Approval (Tier 2)

Since this is Tier 2, safety validator also runs:
- ✓ No hardcoded secrets in screenshots
- ✓ No sensitive data exposed
- ✓ Test isolation maintained

**Result**: `in_review` → `closed` (auto-approved)

```bash
mentu show cmt_example_login
```

**Output**:
```
Commitment: cmt_example_login
Body: Deliver working login form with visual evidence
State: closed
Source: mem_abc123
Evidence:
  - mem_111: Visual checkpoint 'form-renders'
  - mem_222: Visual checkpoint 'empty-validation'
  - mem_333: Visual checkpoint 'invalid-email'
  - mem_444: Visual checkpoint 'successful-login'
  - mem_555: Visual checkpoint 'mobile-responsive'
  - mem_validator_001: Technical validation PASS
Annotations:
  - Visual test spec created at docs/visual-tests/example-login-form-spec.yaml
  - Visual evidence captured: 5 checkpoints completed
  - Technical validation: PASS (all checks including visual evidence)
```

---

## Evidence Chain

### Lineage

```
Feature Request (mem_abc123)
    ↓
Commitment Created (cmt_example_login)
    ↓
Visual Test Spec Created (docs/visual-tests/example-login-form-spec.yaml)
    ↓
Implementation Complete
    ↓
Visual Tests Executed
    ├── Screenshot 1 → mem_111 (form-renders)
    ├── Screenshot 2 → mem_222 (empty-validation)
    ├── Screenshot 3 → mem_333 (invalid-email)
    ├── Screenshot 4 → mem_444 (successful-login)
    └── Screenshot 5 → mem_555 (mobile-responsive)
    ↓
Technical Validation → mem_validator_001 (PASS)
    ↓
Commitment Closed with Full Evidence
```

### Accountability

| Role | Responsible For | Evidence |
|------|----------------|----------|
| Architect | Vision | Visual test spec (YAML) |
| Executor | Implementation | Code + screenshots + evidence memories |
| Technical Validator | Correctness | Validation result (PASS) |

**If feature had bugs**:
- Screenshots would show incorrect UI
- Executor could see the evidence
- Executor would fix and re-run visual tests
- New screenshots would replace old ones (deduplication)

---

## What If Visual Tests Failed?

### Scenario: Checkpoint 4 Fails

**Error**: Navigation timeout - login doesn't redirect

**Executor discovers**:
```bash
mentu visual-test cmt_example_login

Checkpoint 4/5: successful-login
  ✗ Error: Timeout waiting for navigation
  ✗ Screenshot shows: still on /login page with loading spinner
```

**Executor fixes**:
```typescript
// Bug: forgot to call router.push()
if (result.success) {
  router.push('/dashboard');  // ← This was missing
}
```

**Re-run**:
```bash
mentu visual-test cmt_example_login

Checkpoint 4/5: successful-login
  ✓ Screenshot captured: https://...
  ✓ Evidence created: mem_444_v2
```

**Technical Validator**: Now sees visual evidence → PASS

---

## Dry Run Mode

Preview what would happen without executing:

```bash
node dist/index.js visual-test cmt_example_login --dry-run
```

**Output**:
```
Visual Test Plan:
  Commitment: cmt_example_login
  Feature: Deliver working login form with visual evidence
  Spec: docs/visual-tests/example-login-form-spec.yaml
  State: claimed

Spec content:
feature: "User login form with validation"
commitment_id: cmt_example_login
...
visual_checkpoints:
  - name: "form-renders"
    ...

Would execute visual-test-executor SubAgent
Run without --dry-run to execute
```

---

## Key Takeaways

### For Architects
- Create visual test specs BEFORE implementation
- Define checkpoints covering happy path + edge cases
- Don't need to see code - just define "what should be visible"

### For Executors
- Visual tests are NOT optional if spec exists
- Screenshots provide proof that UI works
- Re-run tests after fixes until they pass
- Evidence is automatically captured and linked

### For Validators
- Technical validation includes visual evidence check
- If spec exists, visual evidence is REQUIRED
- No evidence = FAIL (implementation incomplete)

---

## Files Created in This Example

```
docs/visual-tests/
├── example-login-form-spec.yaml    # Visual test specification
└── E2E-Test-Example.md             # This file

.mentu/ledger.jsonl                 # Contains all operations:
├── capture mem_abc123              # Feature request
├── commit cmt_example_login        # Commitment
├── claim cmt_example_login         # Executor claims
├── capture mem_111                 # Visual evidence 1
├── capture mem_222                 # Visual evidence 2
├── capture mem_333                 # Visual evidence 3
├── capture mem_444                 # Visual evidence 4
├── capture mem_555                 # Visual evidence 5
├── annotate cmt_example_login      # Link spec
├── annotate cmt_example_login      # Record results
├── submit cmt_example_login        # Request closure
├── capture mem_validator_001       # Validation result
└── approve cmt_example_login       # Auto-closed

Supabase Storage (visual-evidence bucket):
├── 00000000.../visual/20260111-form-renders.png
├── 00000000.../visual/20260111-empty-validation.png
├── 00000000.../visual/20260111-invalid-email.png
├── 00000000.../visual/20260111-successful-login.png
└── 00000000.../visual/20260111-mobile-responsive.png
```

---

## Next Steps

To run this example in a real project:

1. **Set up a Next.js/React project** with a login page
2. **Create the commitment**:
   ```bash
   mentu capture "Implement login form" --kind feature
   mentu commit "Deliver login form" --source mem_xxx
   ```
3. **Copy the spec**: `cp docs/visual-tests/example-login-form-spec.yaml docs/visual-tests/{your_cmt_id}-spec.yaml`
4. **Implement the feature**
5. **Run visual tests**: `mentu visual-test {your_cmt_id}`
6. **Submit**: `mentu submit {your_cmt_id} --summary "Login form complete"`

**The visual evidence layer ensures you can't claim "it works" without proving it works in the browser.**

---

*This example demonstrates Phase 1 & 2 of the Visual Evidence Testing Harness implementation.*
