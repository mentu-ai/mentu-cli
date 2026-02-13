# AS-IS vs TO-BE: Evidence & Document Tracking System

**Date**: 2026-01-03
**Author**: agent:claude-mentu
**Purpose**: Audit current evidence capture gaps and propose unified system

---

## Executive Summary

The current `/craft` command and document lifecycle has **structural gaps** in evidence tracking:

1. **INTENT and AUDIT are orphaned** - Not part of the PRD → HANDOFF → PROMPT → RESULT chain
2. **Document relationships are strings, not validated IDs** - `parent: HANDOFF-Name-v1.0` is human-readable but not queryable
3. **No `documents` table** - Publications exist in `operations.payload` but there's no first-class entity to track document chains
4. **Evidence captures are unlinked** - `mentu capture "Created PRD..."` creates a memory but doesn't link to the published document

---

## AS-IS State

### 1. Operation Types in Supabase

| Operation | Count | Purpose |
|-----------|-------|---------|
| `capture` | 1,426 | Creates memories (observations) |
| `publish` | 329 | Creates publications (docs, evidence, artifacts) |
| `commit` | 79 | Creates commitments |
| `claim` | 404 | Claims commitment ownership |
| `submit` | 39 | Submits for review |
| `close` | 33 | Closes with evidence |
| `approve` | 33 | Approves submission |

### 2. Document Lifecycle per /craft Command

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CURRENT /craft LIFECYCLE                                               │
│                                                                         │
│  PRD → HANDOFF → PROMPT → [Agent Executes] → RESULT                    │
│   ↓        ↓         ↓                          ↓                      │
│  capture  capture  capture                   capture                   │
│  (kind:   (kind:   (kind:                   (kind:                    │
│  document) document) document)              document)                  │
│                                                                         │
│  MISSING FROM CHAIN:                                                    │
│  ─────────────────────                                                 │
│  INTENT → AUDIT → PRD (INTENT/AUDIT not in /craft lifecycle)          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. YAML Frontmatter Structure (Current)

```yaml
---
id: PRD-ThreePlanesNavigation-W1-v1.0
path: docs/PRD-ThreePlanesNavigation-W1-v1.0.md
type: prd
intent: reference

version: "1.0"
created: 2026-01-03
last_updated: 2026-01-03

tier: T3

# RELATIONSHIPS - STRINGS, NOT IDs
parent: HANDOFF-ThreePlanesNavigation-W1-v1.0     # ← Just a string
children:
  - HANDOFF-ThreePlanesNavigation-W1-v1.0         # ← Just strings
dependencies:
  - INTENT-ThreePlanesNavigation-v1.0             # ← Just a string

# MENTU - WRITE-ONCE, THEN FROZEN
mentu:
  commitment: pending    # → cmt_xxx (ONE TIME UPDATE)
  status: pending        # NEVER CHANGE MANUALLY
---
```

**Problems:**
- `parent`, `children`, `dependencies` are **human-readable strings**, not validated document IDs
- No way to query "what documents depend on this one?"
- No enforcement that referenced documents exist
- `mentu.status` is frozen after creation - accurate state requires CLI query

### 4. Publish Operation Payload (Current)

```json
{
  "id": "pub_tpobcks3",
  "url": "mentu-ai/docs/prd/prd",
  "path": "prd/prd",
  "module": "docs",
  "content": "# PRD: {Name} v{X.Y}...",
  "version": 1,
  "metadata": {
    "doc_id": "PRD-{Name}-v{X.Y}",
    "doc_type": "prd",
    "intent": "reference",
    "parent": "HANDOFF-{Name}-v{X.Y}",      // ← String, not ID
    "children": ["HANDOFF-{Name}-v{X.Y}"],  // ← Strings, not IDs
    "commitment": "pending",
    "status": "pending"
  },
  "content_hash": "b766f7c59d7fb960"
}
```

**Problems:**
- `metadata.parent` and `metadata.children` are strings matching `metadata.doc_id` of other documents
- No foreign key validation
- Querying document chains requires string matching across JSONB payloads
- No index on `payload->>'metadata'->>'doc_id'`

### 5. Capture Evidence Pattern (Current)

```bash
# /craft creates captures for each document
mentu capture "Created PRD-{name}: {summary}" --kind document --author-type auditor
```

**Result in operations table:**
```json
{
  "id": "mem_2c49a511",
  "op": "capture",
  "actor": "rashid.azarang.e@gmail.com",
  "payload": {
    "kind": "document",
    "body": "Created PRD-PersistentVisualVerification-v1.0: Specification for..."
  }
}
```

**Problems:**
- The capture is **unlinked** to the actual publication
- No `refs.publication_id` or `refs.doc_id` field
- Cannot query "which memory captured which document"
- Document name is embedded in body text, not structured data

---

## Gap Analysis

### Gap 1: INTENT and AUDIT Not in /craft Chain

| Document Type | In /craft Lifecycle? | In Templates? |
|--------------|---------------------|---------------|
| INTENT | **NO** | YES (`TEMPLATE-Intent.md`) |
| AUDIT | **NO** | YES (`TEMPLATE-Audit.md`) |
| PRD | YES | YES |
| HANDOFF | YES | YES |
| PROMPT | YES | YES |
| RESULT | YES | YES |

**Impact**: INTENT → AUDIT → PRD chain exists in templates but `/craft` starts at PRD. The architect-auditor-executor trust gradient is not enforced in the document chain.

### Gap 2: Document Relationships Are Strings

```
YAML Frontmatter          Supabase
─────────────────          ────────
parent: "HANDOFF-X"   →    payload.metadata.parent = "HANDOFF-X"

Both are strings. Neither validates the target exists.
Neither creates a queryable relationship.
```

**Impact**: Cannot answer:
- "What documents depend on INTENT-X?"
- "Show me the full chain from INTENT to RESULT"
- "Which documents are orphaned (no parent)?"

### Gap 3: No First-Class Document Entity

```
Current State:
┌──────────────────────────────────────────────────────────────────┐
│  operations table                                                │
│  ─────────────────                                              │
│  op='publish' → payload.metadata.doc_id = "PRD-X-v1.0"          │
│  op='capture' → payload.body = "Created PRD-X..."               │
│                                                                  │
│  NO JOIN POSSIBLE - both are JSONB strings                      │
└──────────────────────────────────────────────────────────────────┘

Desired State:
┌──────────────────────────────────────────────────────────────────┐
│  documents table                                                 │
│  ────────────────                                               │
│  id: doc_xxx                                                    │
│  doc_id: "PRD-X-v1.0"                                           │
│  type: "prd"                                                    │
│  parent_id: doc_yyy (FK)                                        │
│  commitment_id: cmt_zzz (FK)                                    │
│  publication_id: pub_aaa                                        │
│  source_memory_id: mem_bbb                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Gap 4: Capture-to-Publication Link Missing

When `/craft` runs:
1. Creates PRD file on disk
2. Runs `mentu capture "Created PRD..."` → creates `mem_xxx`
3. (Sometimes) Runs `mentu publish ...` → creates `pub_yyy`

**But there's no link between `mem_xxx` and `pub_yyy`.**

The capture knows about the document (in body text).
The publication knows its content.
Neither knows about the other.

---

## TO-BE State

### 1. Complete Document Chain in /craft

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PROPOSED /craft LIFECYCLE                                              │
│                                                                         │
│  INTENT → AUDIT → PRD → HANDOFF → PROMPT → [Execute] → RESULT          │
│     ↓        ↓       ↓       ↓         ↓                  ↓            │
│  doc_001  doc_002 doc_003 doc_004  doc_005           doc_006           │
│     │        │       │       │         │                  │            │
│     └────────┴───────┴───────┴─────────┴──────────────────┘            │
│                        ALL LINKED VIA parent_id FK                      │
│                                                                         │
│  /craft-auditor: Creates AUDIT, links to INTENT                        │
│  /craft: Creates PRD-HANDOFF-PROMPT, links to AUDIT                    │
│  /craft-executor: Creates RESULT, links to PROMPT                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. New `documents` Table Schema

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),

  -- Document Identity
  doc_id TEXT NOT NULL,                    -- "PRD-ThreePlanesNavigation-W1-v1.0"
  doc_type TEXT NOT NULL,                  -- "intent" | "audit" | "prd" | "handoff" | "prompt" | "result"
  version TEXT NOT NULL DEFAULT '1.0',

  -- Relationships (FOREIGN KEYS, not strings!)
  parent_id UUID REFERENCES documents(id), -- Links to parent document
  commitment_id TEXT,                      -- Links to commitment (cmt_xxx)

  -- Content References
  publication_id TEXT,                     -- pub_xxx from operations
  source_memory_id TEXT,                   -- mem_xxx from creation capture
  file_path TEXT,                          -- Local filesystem path

  -- Metadata
  tier TEXT,                               -- T1, T2, T3, T4
  intent TEXT,                             -- "reference" | "execute"
  status TEXT DEFAULT 'draft',             -- "draft" | "published" | "superseded"

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(workspace_id, doc_id)
);

-- Index for chain traversal
CREATE INDEX idx_documents_parent ON documents(parent_id);
CREATE INDEX idx_documents_commitment ON documents(commitment_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
```

### 3. Unified YAML Frontmatter with IDs

```yaml
---
# DOCUMENT IDENTITY
id: PRD-ThreePlanesNavigation-W1-v1.0
doc_uuid: doc_abc123                    # ← NEW: Supabase document ID
path: docs/PRD-ThreePlanesNavigation-W1-v1.0.md
type: prd
intent: reference

# VERSIONING
version: "1.0"
created: 2026-01-03
last_updated: 2026-01-03

# TIER
tier: T3

# RELATIONSHIPS - NOW WITH BOTH STRING AND ID
parent:
  doc_id: HANDOFF-ThreePlanesNavigation-W1-v1.0
  doc_uuid: doc_def456                  # ← NEW: Validated FK
children:
  - doc_id: HANDOFF-ThreePlanesNavigation-W1-v1.0
    doc_uuid: doc_ghi789                # ← NEW: Validated FK
dependencies:
  - doc_id: INTENT-ThreePlanesNavigation-v1.0
    doc_uuid: doc_jkl012                # ← NEW: Validated FK

# MENTU INTEGRATION
mentu:
  document_id: doc_abc123               # ← NEW: Back-reference
  commitment: cmt_xxx
  source_memory: mem_yyy                # ← NEW: Creation capture
  publication: pub_zzz                  # ← NEW: Published version
  status: pending
---
```

### 4. Enhanced /craft Commands

```bash
# Create INTENT (Architect)
/craft-intent FeatureName-v1.0
# → Creates INTENT doc
# → Registers in documents table (parent_id: null)
# → Returns doc_uuid for linking

# Audit INTENT (Auditor)
/craft-auditor docs/INTENT-FeatureName-v1.0.md
# → Creates AUDIT doc
# → Sets parent_id to INTENT's doc_uuid
# → Registers in documents table

# Create craft chain (from AUDIT)
/craft FeatureName-v1.0
# → Creates PRD, HANDOFF, PROMPT
# → Sets PRD.parent_id to AUDIT's doc_uuid
# → Chains HANDOFF → PRD, PROMPT → HANDOFF
# → All registered in documents table

# Execute and create RESULT
/craft-executor docs/HANDOFF-FeatureName-v1.0.md
# → Creates RESULT doc
# → Sets parent_id to PROMPT's doc_uuid
# → Closes commitment with evidence
```

### 5. Query Capabilities (TO-BE)

```sql
-- Get full document chain for a feature
WITH RECURSIVE chain AS (
  SELECT id, doc_id, doc_type, parent_id, 0 as depth
  FROM documents
  WHERE doc_id = 'RESULT-ThreePlanesNavigation-W1-v1.0'

  UNION ALL

  SELECT d.id, d.doc_id, d.doc_type, d.parent_id, c.depth + 1
  FROM documents d
  JOIN chain c ON d.id = c.parent_id
)
SELECT * FROM chain ORDER BY depth DESC;

-- Result:
-- INTENT-ThreePlanesNavigation-v1.0     (depth: 5)
-- AUDIT-ThreePlanesNavigation-v1.0      (depth: 4)
-- PRD-ThreePlanesNavigation-W1-v1.0     (depth: 3)
-- HANDOFF-ThreePlanesNavigation-W1-v1.0 (depth: 2)
-- PROMPT-ThreePlanesNavigation-W1-v1.0  (depth: 1)
-- RESULT-ThreePlanesNavigation-W1-v1.0  (depth: 0)
```

```sql
-- Find all orphaned documents (no parent, not INTENT)
SELECT doc_id, doc_type
FROM documents
WHERE parent_id IS NULL
  AND doc_type != 'intent';

-- Find documents linked to a commitment
SELECT doc_id, doc_type
FROM documents
WHERE commitment_id = 'cmt_abc123';

-- Get all children of a document
SELECT doc_id, doc_type
FROM documents
WHERE parent_id = 'doc_abc123';
```

---

## Document Registration & Frontmatter Sync

### The Trigger: `mentu doc register`

When a document is created, the CLI registers it in Supabase and **automatically updates the YAML frontmatter** with assigned IDs.

```bash
# Register a new document (auto-populates YAML)
mentu doc register docs/PRD-FeatureName-v1.0.md --parent doc_abc123

# What happens:
# 1. Reads YAML frontmatter from file
# 2. Creates record in `documents` table
# 3. Gets back doc_uuid (e.g., doc_xyz789)
# 4. Updates YAML frontmatter IN-PLACE with:
#    - doc_uuid: doc_xyz789
#    - mentu.document_id: doc_xyz789
#    - parent.doc_uuid: doc_abc123 (resolved from --parent)
# 5. Captures evidence: "Registered PRD-FeatureName-v1.0"
```

### Registration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DOCUMENT REGISTRATION FLOW                                                 │
│                                                                             │
│  1. Agent creates document file                                             │
│     └─→ docs/PRD-FeatureName-v1.0.md (YAML has doc_uuid: pending)          │
│                                                                             │
│  2. Agent runs: mentu doc register <path> --parent <parent_doc_uuid>        │
│     └─→ CLI reads file, extracts frontmatter                               │
│     └─→ CLI calls Supabase: INSERT INTO documents (...) RETURNING id       │
│     └─→ CLI receives: doc_xyz789                                           │
│                                                                             │
│  3. CLI updates YAML frontmatter IN-PLACE                                   │
│     └─→ doc_uuid: doc_xyz789                                               │
│     └─→ mentu.document_id: doc_xyz789                                      │
│     └─→ parent.doc_uuid: doc_abc123                                        │
│                                                                             │
│  4. CLI captures evidence                                                   │
│     └─→ mentu capture "Registered PRD-FeatureName-v1.0" --kind doc-register│
│     └─→ Returns mem_xxx                                                    │
│                                                                             │
│  5. CLI updates document record with source_memory_id                       │
│     └─→ UPDATE documents SET source_memory_id = 'mem_xxx' WHERE id = ...   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### YAML Before/After Registration

**BEFORE** (document created, not yet registered):

```yaml
---
id: PRD-FeatureName-v1.0
doc_uuid: pending                         # ← Placeholder
path: docs/PRD-FeatureName-v1.0.md
type: prd
intent: reference

version: "1.0"
created: 2026-01-03

parent: AUDIT-FeatureName-v1.0            # ← String only (legacy)

mentu:
  document_id: pending                    # ← Placeholder
  commitment: pending
  source_memory: pending                  # ← Placeholder
  status: draft
---
```

**AFTER** (registered via `mentu doc register`):

```yaml
---
id: PRD-FeatureName-v1.0
doc_uuid: doc_xyz789                      # ← POPULATED by CLI
path: docs/PRD-FeatureName-v1.0.md
type: prd
intent: reference

version: "1.0"
created: 2026-01-03

parent:
  doc_id: AUDIT-FeatureName-v1.0
  doc_uuid: doc_abc123                    # ← POPULATED by CLI (resolved from --parent)

mentu:
  document_id: doc_xyz789                 # ← POPULATED by CLI
  commitment: pending
  source_memory: mem_reg456               # ← POPULATED by CLI (from registration capture)
  status: registered                      # ← UPDATED by CLI
---
```

### Integration with /craft Commands

Each `/craft` command auto-registers documents after creation:

```bash
# /craft FeatureName-v1.0 internally does:

# 1. Create PRD file
write docs/PRD-FeatureName-v1.0.md

# 2. Register PRD (gets parent from AUDIT if exists)
AUDIT_UUID=$(mentu doc find AUDIT-FeatureName-v1.0 --json | jq -r '.doc_uuid')
mentu doc register docs/PRD-FeatureName-v1.0.md --parent $AUDIT_UUID

# 3. Create HANDOFF file
write docs/HANDOFF-FeatureName-v1.0.md

# 4. Register HANDOFF (parent = PRD)
PRD_UUID=$(mentu doc find PRD-FeatureName-v1.0 --json | jq -r '.doc_uuid')
mentu doc register docs/HANDOFF-FeatureName-v1.0.md --parent $PRD_UUID

# 5. Create PROMPT file
write docs/PROMPT-FeatureName-v1.0.md

# 6. Register PROMPT (parent = HANDOFF)
HANDOFF_UUID=$(mentu doc find HANDOFF-FeatureName-v1.0 --json | jq -r '.doc_uuid')
mentu doc register docs/PROMPT-FeatureName-v1.0.md --parent $HANDOFF_UUID
```

### CLI Commands for Document Management

```bash
# Register a document (creates record, updates YAML)
mentu doc register <path> [--parent <doc_uuid>] [--commitment <cmt_id>]

# Find document by doc_id (returns UUID and metadata)
mentu doc find <doc_id> [--json]

# Show document chain (ancestry)
mentu doc chain <doc_id>

# Show document children (descendants)
mentu doc children <doc_id>

# Sync YAML from Supabase (pull latest state)
mentu doc sync <path>

# Validate YAML matches Supabase
mentu doc validate <path>

# List all registered documents
mentu doc list [--type <type>] [--orphaned] [--unregistered]
```

### Sync Commands (Bidirectional)

**Pull** (Supabase → YAML): Update local file from database state

```bash
mentu doc sync docs/PRD-FeatureName-v1.0.md

# Updates YAML with:
# - Latest parent.doc_uuid (if parent changed)
# - mentu.commitment (if linked)
# - mentu.status (current state)
```

**Push** (YAML → Supabase): Update database from local changes

```bash
mentu doc push docs/PRD-FeatureName-v1.0.md

# Updates Supabase with:
# - New version number
# - Updated file_path
# - Changed tier
```

### Hook Integration

Add a Claude Code hook that triggers registration on document save:

```python
# .claude/hooks/doc_register.py

import subprocess
import sys
import yaml
import re

def on_file_save(file_path: str):
    """Auto-register documents when saved to docs/ folder."""

    # Only trigger for docs/*.md files
    if not file_path.startswith("docs/") or not file_path.endswith(".md"):
        return

    # Check if it's a craft document (PRD, HANDOFF, PROMPT, etc.)
    doc_types = ["INTENT", "AUDIT", "PRD", "HANDOFF", "PROMPT", "RESULT"]
    filename = file_path.split("/")[-1]

    if not any(filename.startswith(dt) for dt in doc_types):
        return

    # Read YAML frontmatter
    with open(file_path, 'r') as f:
        content = f.read()

    # Check if already registered
    if 'doc_uuid: pending' in content or 'doc_uuid:' not in content:
        # Not yet registered - trigger registration
        result = subprocess.run(
            ["mentu", "doc", "register", file_path],
            capture_output=True,
            text=True
        )

        if result.returncode == 0:
            print(f"✓ Registered: {file_path}")
        else:
            print(f"✗ Registration failed: {result.stderr}")
```

### Validation on Commit

Add pre-commit hook to ensure all craft documents are registered:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Find all unregistered craft documents
UNREGISTERED=$(mentu doc list --unregistered --json | jq -r '.[].path')

if [ -n "$UNREGISTERED" ]; then
    echo "ERROR: Unregistered documents found:"
    echo "$UNREGISTERED"
    echo ""
    echo "Run: mentu doc register <path> for each document"
    exit 1
fi
```

### Example: Full Registration Flow

```bash
# 1. Create INTENT (architect)
cat > docs/INTENT-NewFeature-v1.0.md << 'EOF'
---
id: INTENT-NewFeature-v1.0
doc_uuid: pending
type: intent
...
EOF

# 2. Register INTENT (no parent - it's the root)
mentu doc register docs/INTENT-NewFeature-v1.0.md
# → Creates doc_001, updates YAML with doc_uuid: doc_001

# 3. Create AUDIT (auditor)
cat > docs/AUDIT-NewFeature-v1.0.md << 'EOF'
---
id: AUDIT-NewFeature-v1.0
doc_uuid: pending
type: audit
parent: INTENT-NewFeature-v1.0
...
EOF

# 4. Register AUDIT (parent = INTENT)
mentu doc register docs/AUDIT-NewFeature-v1.0.md --parent doc_001
# → Creates doc_002, updates YAML with:
#   - doc_uuid: doc_002
#   - parent.doc_uuid: doc_001

# 5. Query the chain
mentu doc chain AUDIT-NewFeature-v1.0
# Output:
# INTENT-NewFeature-v1.0 (doc_001) [root]
#   └── AUDIT-NewFeature-v1.0 (doc_002) ← you are here
```

---

## Migration Path

### Phase 1: Add `documents` Table (Non-Breaking)

1. Create `documents` table in Supabase
2. Add `/craft` flag `--register` to optionally register documents
3. Backfill existing publications into `documents` table
4. Update mentu-web to display document chains

### Phase 2: Update /craft Commands

1. Add `/craft-intent` command for architect workflow
2. Update `/craft-auditor` to link to INTENT
3. Update `/craft` to link PRD to AUDIT
4. Update `/craft-executor` to link RESULT to PROMPT

### Phase 3: Enforce Relationships

1. Require `parent_id` for non-INTENT documents
2. Add validation that parent exists before creation
3. Add RLS policies for document access

---

## Implementation Checklist

### Database Changes

- [ ] Create `documents` table with schema above
- [ ] Add indexes for `parent_id`, `commitment_id`, `doc_type`
- [ ] Create RLS policies matching `operations` table
- [ ] Add database trigger for `updated_at` timestamp

### CLI Commands (`mentu doc`)

- [ ] `mentu doc register <path>` - Register document, update YAML frontmatter
- [ ] `mentu doc find <doc_id>` - Find document by human-readable ID
- [ ] `mentu doc chain <doc_id>` - Show full ancestry (recursive)
- [ ] `mentu doc children <doc_id>` - Show descendants
- [ ] `mentu doc sync <path>` - Pull latest state from Supabase to YAML
- [ ] `mentu doc push <path>` - Push YAML changes to Supabase
- [ ] `mentu doc validate <path>` - Validate YAML matches Supabase
- [ ] `mentu doc list [--type] [--orphaned] [--unregistered]` - List documents

### YAML Frontmatter Auto-Population

- [ ] CLI reads frontmatter, extracts `id`, `type`, `parent`
- [ ] CLI creates record in `documents` table via Supabase
- [ ] CLI receives `doc_uuid` from INSERT RETURNING
- [ ] CLI updates YAML in-place with `doc_uuid`, `mentu.document_id`
- [ ] CLI resolves `--parent` flag to parent's `doc_uuid`
- [ ] CLI updates `parent.doc_uuid` in YAML
- [ ] CLI captures evidence: `mentu capture "Registered {doc_id}" --kind doc-register`
- [ ] CLI updates `source_memory_id` in documents table

### Hooks & Triggers

- [ ] Create `.claude/hooks/doc_register.py` - Auto-register on file save
- [ ] Create `.git/hooks/pre-commit` - Block commits with unregistered docs
- [ ] Add hook configuration to `.claude/settings.json`
- [ ] Document hook behavior in CLAUDE.md

### /craft Command Integration

- [ ] `/craft-intent` - Create INTENT, register with `parent_id: null`
- [ ] `/craft-auditor` - Create AUDIT, auto-link to INTENT
- [ ] `/craft` - Create PRD/HANDOFF/PROMPT, auto-chain parents
- [ ] `/craft-executor` - Create RESULT, auto-link to PROMPT
- [ ] All commands call `mentu doc register` after file creation
- [ ] All commands resolve parent doc_uuid before registration

### Template Updates

- [ ] Add `doc_uuid: pending` placeholder to all templates
- [ ] Update `parent` from string to object: `{doc_id, doc_uuid}`
- [ ] Add `mentu.document_id: pending` to all templates
- [ ] Add `mentu.source_memory: pending` to all templates
- [ ] Add `mentu.publication: pending` to all templates
- [ ] Update TEMPLATE comments explaining auto-population

### Dashboard (mentu-web) Changes

- [ ] Add "Document Chain" view with visual tree
- [ ] Show INTENT → AUDIT → PRD → HANDOFF → PROMPT → RESULT hierarchy
- [ ] Add "Orphaned Documents" alert panel
- [ ] Add "Unregistered Documents" warning
- [ ] Add document detail page with chain navigation
- [ ] Add search by doc_id or doc_uuid

### Validation & Enforcement

- [ ] Block `mentu commit` if document unregistered
- [ ] Block `mentu submit` if document chain incomplete
- [ ] Warn on orphaned documents during `mentu status`
- [ ] Add `--strict` mode that fails on validation errors

---

## Summary

| Aspect | AS-IS | TO-BE |
|--------|-------|-------|
| Document chain | PRD → HANDOFF → PROMPT → RESULT | INTENT → AUDIT → PRD → HANDOFF → PROMPT → RESULT |
| Relationships | Strings (`parent: "HANDOFF-X"`) | Foreign Keys (`parent_id: doc_uuid`) |
| Queryability | JSONB string matching | SQL with CTEs and JOINs |
| Orphan detection | Manual | `WHERE parent_id IS NULL AND doc_type != 'intent'` |
| Chain traversal | Read YAML files | Recursive CTE in 1 query |
| Evidence linking | Body text only | `source_memory_id`, `publication_id` FKs |
| Validation | None | FK constraints enforce existence |
| **YAML population** | **Manual placeholders** | **`mentu doc register` auto-populates** |
| **Sync direction** | **One-way (write YAML)** | **Bidirectional (sync/push)** |
| **Registration trigger** | **None** | **Hook on file save, pre-commit block** |

The TO-BE state makes document chains **first-class entities** in the database, enabling:
- Full lineage queries from RESULT back to INTENT
- Orphan and broken-link detection
- Evidence-to-document linking
- Commitment-to-document-chain association
- **Automatic YAML frontmatter population on registration**
- **Bidirectional sync between local files and Supabase**
- **Pre-commit validation ensuring all documents are registered**

---

## Key Principle: Single Source of Truth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUPABASE `documents` TABLE = SOURCE OF TRUTH                               │
│                                                                             │
│  YAML Frontmatter = LOCAL CACHE                                             │
│                                                                             │
│  The CLI keeps them in sync:                                                │
│  - `mentu doc register` → Creates record, updates YAML                      │
│  - `mentu doc sync`     → Pulls latest from Supabase to YAML               │
│  - `mentu doc push`     → Pushes YAML changes to Supabase                  │
│                                                                             │
│  Hooks enforce consistency:                                                 │
│  - File save hook       → Auto-registers if unregistered                   │
│  - Pre-commit hook      → Blocks if any docs unregistered                  │
│  - CI validation        → Fails if YAML doesn't match Supabase             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*This analysis was produced by auditing the current /craft command, Supabase schema, and document templates.*
