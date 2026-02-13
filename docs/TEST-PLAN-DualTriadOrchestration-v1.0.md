---
id: TEST-PLAN-DualTriadOrchestration-v1.0
type: test-plan
version: "1.0"
created: 2026-01-09
---

# Test Plan: Dual Triad Orchestration v1.0

## Pre-Deployment Verification

### ✅ Step 1: Compilation Check

All TypeScript files must compile without errors:

```bash
cd mentu-bridge
npx tsc --noEmit src/workflow-orchestrator.ts
# Result: No errors ✓

cd mentu-ai
npx tsc --noEmit src/types/architect-memory.ts
npx tsc --noEmit src/types/auditor-memory.ts
npx tsc --noEmit src/types/executor-memory.ts
# Result: No errors ✓

npx js-yaml .mentu/workflows/bug-investigation-dual-triad.yaml
# Result: Valid YAML ✓
```

**Status**: ✅ PASSED

### ✅ Step 2: Config Validation

Verify both workspace configs are valid:

```bash
# mentu-ai config
cat mentu-ai/.mentu/config.yaml | grep -A 10 "orchestration"
# Expected: AUTONOMOUS mode, Sonnet models ✓

# WarrantyOS config
cat projects/inline-substitute/vin-to-value-main/.mentu/config.yaml | grep -A 10 "orchestration"
# Expected: MANUAL mode, Sonnet models ✓
```

**Status**: ✅ PASSED

---

## Integration Testing

### Test 1: Workflow Registration

**Objective**: Verify workflow can be registered in Supabase

**Setup**:
```bash
# Ensure environment variables are set
export MENTU_PROXY_TOKEN="<your-token>"
export MENTU_API_URL="https://mentu-proxy.affihub.workers.dev"
```

**Test**:
```bash
curl -X POST "$MENTU_API_URL/workflow/register" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -H "Content-Type: application/json" \
  -d @mentu-ai/.mentu/workflows/bug-investigation-dual-triad.yaml
```

**Expected**:
- HTTP 200 response
- JSON: `{"id": "...", "name": "Bug Investigation (Dual Triad)", "version": 2}`

**Status**: 🔲 TODO

---

### Test 2: Bug Report Webhook → Workflow Trigger

**Objective**: Verify bug report triggers workflow creation

**Test**:
```bash
curl -X POST "$MENTU_API_URL/bug-report-webhook" \
  -H "X-API-Key: $BUG_REPORTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Dual Triad: Login fails",
    "description": "Users cannot log in with valid credentials",
    "severity": "high",
    "source": "WarrantyOS",
    "context": "production"
  }'
```

**Expected**:
- HTTP 202 Accepted
- Bug queued in `bug_reports` table
- Memory created in ledger: `mem_bug_xxx`
- Workflow instance created: `workflow_instances` table

**Capture Instance ID**:
```bash
INSTANCE_ID=$(curl -s "$MENTU_API_URL/workflow/list" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq -r '.workflows[0].id')

echo "Workflow instance: $INSTANCE_ID"
```

**Status**: 🔲 TODO

---

### Test 3: Architect Step Execution

**Objective**: Verify Architect analyzes bug without code access

**Monitor**:
```bash
# Watch orchestrator logs
ssh mentu@208.167.255.71 'tail -f ~/Workspaces/mentu-bridge/logs/workflow-orchestrator.log' \
  | grep "architect"

# Check workflow status
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states.architect'
```

**Expected State Progression**:
```
architect:
  state: pending → running → completed
  output:
    investigation_strategy:
      hypothesis: "..."
      investigation_steps: [...]
      expected_root_causes: [...]
    prompt_for_auditor: "..."
    confidence_score: 0.8
```

**Verify Memory**:
```bash
mentu list memories --kind architect-investigation --recent 1
mentu show <mem_architect_xxx>
```

**Expected**: Memory with investigation strategy

**Status**: 🔲 TODO

---

### Test 4: Auditor Step Execution

**Objective**: Verify Auditor validates strategy with codebase access

**Monitor**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states.auditor'
```

**Expected State Progression**:
```
auditor:
  state: pending → running → completed
  output:
    feasibility_assessment:
      is_feasible: true/false
      concerns: [...]
    scope_boundaries:
      allowed_files: [...]
      forbidden_files: [...]
    decision: "approved" | "rejected"
    confidence_score: 0.9
```

**Verify Memory**:
```bash
mentu list memories --kind auditor-assessment --recent 1
mentu show <mem_auditor_xxx>
```

**Expected**: Memory with scope boundaries

**Status**: 🔲 TODO

---

### Test 5: Branching Logic (Approved Path)

**Objective**: Verify approved decision leads to approval gate

**Prerequisite**: Auditor decision = "approved"

**Expected Flow**:
```
auditor_gate → (condition: decision == 'approved') → approval_gate
```

**Verify**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states | keys'

# Should include: architect, auditor, approval_gate, ...
```

**Status**: 🔲 TODO

---

### Test 6: Branching Logic (Rejected Path)

**Objective**: Verify rejected decision loops back to Architect

**Setup**: Manually test by:
1. Running workflow with flawed bug report
2. Monitor if Auditor rejects strategy

**Expected Flow**:
```
auditor_gate → (condition: decision == 'rejected') → architect (LOOP)
```

**Verify Loop Limit**:
```bash
# After 3 Architect↔Auditor loops, should escalate to human
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.state'

# Expected: escalated (not running)
```

**Status**: 🔲 TODO (Manual test)

---

### Test 7: Approval Gate (AUTONOMOUS Mode)

**Objective**: Verify auto-approval for mentu-ai workspace

**Prerequisite**: mentu-ai config has `approval.mode: AUTONOMOUS`

**Expected Behavior**:
```
approval_gate → (auto-approve) → executor
```

**Monitor**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states.approval_gate'

# Expected: state = "completed", outcome = "approved"
```

**Status**: 🔲 TODO

---

### Test 8: Approval Gate (MANUAL Mode)

**Objective**: Verify human approval flow for WarrantyOS

**Setup**: Trigger bug report for WarrantyOS workspace (MANUAL mode)

**Expected Behavior**:
```
approval_gate → (waiting for human) → [approval endpoint]
```

**Verify Pending Approval**:
```bash
curl -s "$MENTU_API_URL/workflow/pending-approvals" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN"

# Expected: approval_gate step waiting
```

**Approve**:
```bash
curl -X POST "$MENTU_API_URL/workflow/approve" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" \
  -d '{
    "instance_id": "'$INSTANCE_ID'",
    "step_id": "approval_gate",
    "outcome": "approved"
  }'
```

**Expected**: Workflow continues to executor

**Status**: 🔲 TODO

---

### Test 9: Executor Step Execution

**Objective**: Verify Executor implements fix within scope

**Monitor**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states.executor'
```

**Expected State Progression**:
```
executor:
  state: pending → running → completed
  output:
    implementation:
      files_changed: [...]
      changes_summary: "..."
      tests_added: [...]
    test_results:
      tests_passed: true
      tests_count: 5
    evidence:
      build_status: "success"
      commit_hash: "..."
    within_scope: true
    scope_violations: []
```

**Verify Memory**:
```bash
mentu list memories --kind executor-results --recent 1
mentu show <mem_executor_xxx>
```

**Expected**: Memory with implementation details

**Status**: 🔲 TODO

---

### Test 10: Scope Violation Handling

**Objective**: Verify Executor looping back to Auditor on scope violation

**Setup**: Modify Executor prompt to deliberately exceed scope

**Expected Behavior**:
```
executor (with scope_violations)
  → on_scope_violation handler
  → auditor (LOOP)
```

**Verify**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states.executor.scope_violations'

# Expected: ["Violated constraint: modified forbidden file xyz"]
```

**Status**: 🔲 TODO (Manual test)

---

### Test 11: Validators (Parallel)

**Objective**: Verify technical, safety, intent validators run in parallel

**Monitor**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states.validators'
```

**Expected State**:
```
validators:
  technical_validator:
    state: completed
    outcome: passed
  safety_validator:
    state: completed
    outcome: passed
  intent_validator:
    state: completed
    outcome: passed
```

**Status**: 🔲 TODO

---

### Test 12: Validation Failure Handling

**Objective**: Verify technical failure loops back to Executor

**Setup**: Trigger validator failure (e.g., test fails)

**Expected Flow**:
```
validation_gate (condition: technical_validator.passed == false)
  → executor (LOOP)
```

**Verify**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.step_states | keys'

# Should show: executor executed twice
```

**Status**: 🔲 TODO (Manual test)

---

### Test 13: Deploy Step

**Objective**: Verify GitHub PR creation and commitment closure

**Expected Behavior**:
```
deploy
  → create GitHub PR
  → merge PR
  → close commitment with evidence
```

**Verify GitHub PR**:
```bash
gh pr list --repo rashidazarang/tickets | grep "Dual Triad"
```

**Expected**: PR title mentions bug fix

**Verify Commitment Closure**:
```bash
mentu list commitments --recent 1
mentu show <cmt_xxx> --evidence
```

**Expected**: Commitment state = "closed", evidence = GitHub commit link

**Status**: 🔲 TODO

---

### Test 14: Complete Workflow (Happy Path)

**Objective**: End-to-end test from bug report to deployment

**Setup**:
```bash
# Clear any previous test data
# Prepare mentu-ai workspace (AUTONOMOUS mode)
# Prepare test bug report
```

**Execute**:
```bash
# 1. Submit bug report
curl -X POST "$MENTU_API_URL/bug-report-webhook" \
  -H "X-API-Key: $BUG_REPORTER_KEY" \
  -d '{"title": "Test E2E", "description": "..."}'

# 2. Wait 5 minutes for orchestration to complete
sleep 300

# 3. Check final state
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.state'

# Expected: "completed"
```

**Verify Artifacts**:
```bash
# All memories created
mentu list memories --kind architect-investigation --recent 1
mentu list memories --kind auditor-assessment --recent 1
mentu list memories --kind executor-results --recent 1

# Commitment closed with evidence
mentu list commitments --recent 1

# GitHub PR merged
gh pr list --state merged | grep "Dual Triad"
```

**Expected**: All 3 memories + commitment closed + PR merged

**Status**: 🔲 TODO

---

## Regression Testing

### Test 15: Iteration Limits Prevent Infinite Loops

**Objective**: Verify workflow doesn't loop infinitely

**Setup**: Create pathological bug report that causes repeated rejections

**Expected Behavior**:
```
1. Architect generates strategy
2. Auditor rejects (iteration 1)
3. Architect revises (iteration 2)
4. Auditor rejects again (iteration 2)
5. Architect revises (iteration 3)
6. Auditor rejects (iteration 3)
7. Max loops exceeded → escalate_to_human
```

**Verify Escalation**:
```bash
curl -s "$MENTU_API_URL/workflow/status/$INSTANCE_ID" \
  -H "X-Proxy-Token: $MENTU_PROXY_TOKEN" | jq '.state'

# Expected: "escalated" (not "running")
```

**Status**: 🔲 TODO (Manual test)

---

## Success Criteria

| Test | Status | Notes |
|------|--------|-------|
| Compilation | ✅ | All TypeScript files compile |
| Workflow YAML | ✅ | Valid YAML syntax |
| Workflow Registration | 🔲 | Must register in Supabase |
| Bug Webhook | 🔲 | Must trigger workflow |
| Architect Execution | 🔲 | Must generate strategy |
| Auditor Execution | 🔲 | Must validate with code access |
| Branching (Approved) | 🔲 | Must proceed to approval |
| Branching (Rejected) | 🔲 | Must loop to Architect |
| Approval (AUTONOMOUS) | 🔲 | Must auto-approve |
| Approval (MANUAL) | 🔲 | Must wait for human |
| Executor Execution | 🔲 | Must implement fix |
| Scope Violation | 🔲 | Must loop to Auditor |
| Validators | 🔲 | Must run in parallel |
| Validator Failure | 🔲 | Must loop to Executor |
| Deploy | 🔲 | Must create/merge PR |
| E2E Happy Path | 🔲 | Full workflow must complete |
| Loop Prevention | 🔲 | Infinite loops must escalate |

---

## Known Limitations (Phase 2)

- [ ] V4.1 spec needs extension for `validation` and `parallel` step types
- [ ] V4.1 spec needs extension for `iteration_limit` and `on_scope_violation` fields
- [ ] Deploy step currently defined as `commitment` (should be `action` type in Phase 2)
- [ ] Validators currently defined as `validation` type (needs to be formalized in V4.1)
- [ ] Error handling paths (safety_validator failure → escalate) not yet tested

---

**Test Plan Created**: 2026-01-09
**Ready for Integration Testing**: Yes ✓
**Estimated Duration**: 2-3 hours for full test suite
