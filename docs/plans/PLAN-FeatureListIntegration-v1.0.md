---
id: PLAN-FeatureListIntegration-v1.0
type: plan
created: 2026-01-11
status: draft
---

# Plan: Feature List Integration

## Summary

Replace `completion.json` with `feature_list.json` as the Executor's contract. Respect existing lineage (hooks, DUAL TRIAD, Mentu evidence). Simplify Executor workflow while keeping trust gradient intact.

## What Changes

| Before | After |
|--------|-------|
| `completion.json` (required_files, checks) | `feature_list.json` (features with passes) |
| Check file existence + run checks | Check all features pass |
| required_files[] is static | features[] updated as work progresses |
| No intermediate progress | Each feature marked as complete |

## What Stays

| Component | Status |
|-----------|--------|
| DUAL TRIAD (Architect → Auditor → Executor) | Keep |
| Trust gradient (untrusted → trusted → authorized) | Keep |
| SessionStart hook (inject context) | Update to read feature_list |
| Stop hook enforcement | Update to check features |
| Mentu evidence capture | Keep (each feature = capture) |
| Tier validators | Keep (run on stop) |

## feature_list.json Schema

```json
{
  "$schema": "feature-list-v1",
  "instruction_id": "INST-FeatureName-v1.0",
  "created": "2026-01-11T10:00:00Z",
  "tier": "T2",
  "mentu": {
    "commitment": "cmt_xxx",
    "source": "mem_xxx"
  },
  "features": [
    {
      "id": "F001",
      "description": "Implement core logic",
      "acceptance": ["Criterion 1", "Criterion 2"],
      "passes": false,
      "evidence": null
    },
    {
      "id": "F002",
      "description": "Add tests",
      "acceptance": ["Criterion 3"],
      "passes": false,
      "evidence": null
    }
  ],
  "checks": {
    "tsc": true,
    "build": true,
    "test": false
  }
}
```

**Key fields:**
- `features[].passes` - Updated by Executor when feature complete
- `features[].evidence` - Mentu memory ID from capture
- `checks` - Same as completion.json (tsc, build, test)
- `tier` - For tier_validator.py

## Hook Updates

### SessionStart (`session_start.py`)

**Current**: Reads ledger for claimed commitments

**Add**: Also read feature_list.json and inject progress

```python
# New injection
if os.path.exists("feature_list.json"):
    with open("feature_list.json") as f:
        fl = json.load(f)

    total = len(fl["features"])
    passed = sum(1 for f in fl["features"] if f["passes"])
    pending = [f["id"] for f in fl["features"] if not f["passes"]]

    context += f"""
## Feature Progress

**Instruction**: {fl["instruction_id"]}
**Progress**: {passed}/{total} features complete
**Pending**: {', '.join(pending[:5])}

Resume from first pending feature.
"""
```

### Stop Hook (`feature_enforcer.py`)

**Replace**: `mentu_enforcer.py` logic with feature-aware version

```python
def check_features_complete():
    if not os.path.exists("feature_list.json"):
        return True, "No feature list"

    with open("feature_list.json") as f:
        fl = json.load(f)

    incomplete = [f for f in fl["features"] if not f["passes"]]

    if incomplete:
        ids = [f["id"] for f in incomplete[:3]]
        return False, f"Incomplete features: {', '.join(ids)}"

    # Also run checks (tsc, build, test)
    checks = fl.get("checks", {})
    if checks.get("tsc"):
        result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True)
        if result.returncode != 0:
            return False, "TypeScript compilation failed"

    if checks.get("build"):
        result = subprocess.run(["npm", "run", "build"], capture_output=True)
        if result.returncode != 0:
            return False, "Build failed"

    return True, "All features complete and checks pass"
```

### Tier Validator Integration

**Keep**: `tier_validator.py` runs validators based on tier

**Read tier from**: `feature_list.json` instead of completion.json

```python
# In tier_validator.py
def get_tier():
    if os.path.exists("feature_list.json"):
        with open("feature_list.json") as f:
            return json.load(f).get("tier", "T1")
    return "T1"
```

## Executor Workflow

```
1. Read HANDOFF (or instruction.md)
2. Generate feature_list.json from acceptance criteria
3. mentu commit + claim

4. FOR each feature where passes == false:
     a. Implement
     b. Test
     c. mentu capture "Completed {id}: {description}"
     d. Update feature_list.json:
        - passes: true
        - evidence: mem_xxx

5. When all features pass:
   - mentu submit cmt_xxx --summary "All features complete"
   - Stop (hook allows because all pass)
```

## Craft Integration

### Option A: Generate from HANDOFF

`/craft` produces HANDOFF as before. Executor extracts feature_list.json from HANDOFF acceptance criteria.

```
/craft → PRD → HANDOFF → PROMPT
           ↓
    Executor reads HANDOFF
           ↓
    Generates feature_list.json
           ↓
    Works through features
           ↓
    RESULT + evidence
```

### Option B: Generate during /craft

`/craft` produces feature_list.json alongside HANDOFF.

```
/craft → PRD → HANDOFF + feature_list.json → PROMPT
                              ↓
                     Already extracted
                              ↓
                     Executor just executes
```

**Recommendation**: Option A (Executor generates). Keeps /craft simple, Executor owns the contract.

## Migration Path

1. **Keep completion.json support** - Both files work during transition
2. **Add feature_list.json reading** - SessionStart + Stop hooks
3. **Update one HANDOFF** - Test with single task
4. **Deprecate completion.json** - After validation

## Files to Create/Modify

| File | Action | Status |
|------|--------|--------|
| `.claude/hooks/session_start.py` | Add feature_list reading | Done |
| `.claude/hooks/feature_enforcer.py` | New stop hook | Done |
| `.claude/hooks/tier_validator.py` | Read tier from feature_list | Done |
| `.claude/settings.json` | Register feature_enforcer | Done |
| `docs/templates/TEMPLATE-FeatureList.md` | Schema template | Done |

## Propagation Status

| Repo | Hooks Updated | Settings Updated |
|------|---------------|------------------|
| **Workspaces (hub)** | Yes | Yes |
| mentu-ai | Yes | Yes |
| mentu-beacon | Yes | Yes |
| mentu-web | Inherits from hub | Inherits from hub |
| mentu-bridge | Inherits from hub | Inherits from hub |
| mentu-proxy | Inherits from hub | Inherits from hub |

**Note**: Repos without their own hooks directories inherit from the Workspaces hub-level hooks.

## Evidence Flow

```
Feature completed → mentu capture → mem_xxx
                           ↓
              feature_list.json updated
                   (evidence: mem_xxx)
                           ↓
              All features pass → mentu submit
                           ↓
              Commitment closed with all evidence
```

**Key**: Each feature links to its evidence. Final submit aggregates all.

## Success Criteria

- [ ] SessionStart injects feature progress
- [ ] Stop hook blocks until all features pass
- [ ] Each feature creates Mentu evidence
- [ ] Tier validators still work
- [ ] Executor completes ALL features in one session
- [ ] HANDOFF still works (feature_list extracted from it)

## What We're NOT Changing

- PRD (strategic intent) - stays
- HANDOFF (build instructions) - stays
- PROMPT (launch command) - stays
- RESULT (completion evidence) - stays
- DUAL TRIAD (trust gradient) - stays
- Mentu operations (capture, commit, submit) - stays
- Tier validators (technical, safety, intent) - stays

We're **replacing the Executor's exit contract** (completion.json → feature_list.json) and **adding intermediate progress tracking**.

---

*Respect lineage. Simplify execution.*
