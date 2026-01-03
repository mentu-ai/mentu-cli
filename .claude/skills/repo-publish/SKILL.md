---
name: repo-publish
description: Publish repositories to GitHub under Mentu ecosystem organizations. Use for publishing mentu-ai, mentu-bridge, mentu-proxy, mentu-web, talisman, and personal repos. Enforces clean publishing standards.
allowed-tools: Read, Bash, Glob, Write, Grep
---

# Repository Publishing Skill

Publish repositories to GitHub under the Mentu ecosystem organizations with strict quality standards.

## Organizations

| Org | Purpose | Repos |
|-----|---------|-------|
| `mentu-ai` | Core Mentu infrastructure | mentu-ai, mentu-bridge, mentu-proxy, mentu-web |
| `talisman-engineering` | Talisman product repos | talisman-app, talisman-api |
| `rashidazarang` | Personal/experimental | claude-code, projects, experiments |

---

## Sacred Rules

```
+-------------------------------------------------------------------------+
|  PUBLISHING PROTOCOL - EVERY REPO, EVERY TIME                           |
|                                                                         |
|  1. REVIEW FIRST         Read all docs, understand architecture        |
|  2. MINIMAL EXPOSURE     Only publish what's necessary                 |
|  3. HIGH SIGNAL          No cruft, temp files, experiments             |
|  4. CLEAN HISTORY        Curate commits, no "wip" or "fix typo"        |
|  5. AUTHOR IDENTITY      Always as rashidazarang, NOT as agent         |
|  6. NO SECRETS           Verify .gitignore, no tokens, no .env         |
|  7. DOCUMENTATION        README must be accurate and self-contained    |
+-------------------------------------------------------------------------+
```

---

## Quick Start

```bash
# 1. Navigate to repo
cd /Users/rashid/Desktop/Workspaces/<repo-name>

# 2. Set identity (REQUIRED - never publish as agent)
git config user.name "Rashid Azarang"
git config user.email "rashid.azarang.e@gmail.com"

# 3. Clean cruft
rm -f .DS_Store **/.DS_Store *.log
rm -rf dist/ node_modules/

# 4. Publish to GitHub
gh repo create mentu-ai/<repo-name> \
  --public \
  --description "<description>" \
  --source . \
  --push

# 5. Add topics
gh repo edit mentu-ai/<repo-name> --add-topic mentu
```

---

## Pre-Publish Audit

### Check for Secrets

```bash
# MUST run before every publish
grep -rE "(API_KEY|SECRET|TOKEN|PASSWORD|SUPABASE_KEY|ANTHROPIC)" . \
  --include="*.ts" --include="*.js" --include="*.json" --include="*.yaml" \
  | grep -v node_modules | grep -v ".env.example"
```

If anything shows up, **STOP** and remove it.

### Files to NEVER Publish

| Pattern | Reason |
|---------|--------|
| `.env`, `.env.*` | Secrets |
| `*.log` | Runtime logs |
| `dist/`, `build/` | Build artifacts |
| `node_modules/` | Dependencies |
| `.DS_Store` | macOS cruft |
| `*.local` | Local overrides |
| `*.sqlite`, `*.db` | Local databases |
| `coverage/` | Test coverage |

### Files to ALWAYS Include

| File | Purpose |
|------|---------|
| `README.md` | Entry point |
| `LICENSE` | Legal |
| `.gitignore` | Exclusions |
| `package.json` | Definition |
| `.mentu/manifest.yaml` | Identity |

---

## Standard .gitignore

Every Mentu repo should have this:

```gitignore
# Dependencies
node_modules/

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.*
!.env.example

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp

# Test
coverage/
.nyc_output/

# Local
*.local
*.sqlite
*.db
```

---

## Publishing by Repo Type

### mentu-ai (Core Ledger)

```bash
cd /Users/rashid/Desktop/Workspaces/mentu-ai

# This is the primary repo - already at github.com/mentu-ai/mentu
# Just push updates
git push origin main
```

### mentu-bridge (Daemon)

```bash
cd /Users/rashid/Desktop/Workspaces/mentu-bridge

# Remove runtime files
rm -f bridge.log .DS_Store
rm -rf dist/

# Verify clean
git status

# Push
gh repo create mentu-ai/mentu-bridge --public --source . --push
```

### mentu-proxy (Cloudflare Worker)

```bash
cd /Users/rashid/Desktop/Workspaces/mentu-proxy

# Ensure wrangler.toml has no secrets
cat wrangler.toml | grep -v "account_id"

# Push
gh repo create mentu-ai/mentu-proxy --public --source . --push
```

### mentu-web (Dashboard)

```bash
cd /Users/rashid/Desktop/Workspaces/mentu-web

# Remove Next.js build
rm -rf .next/ out/

# Push
gh repo create mentu-ai/mentu-web --public --source . --push
```

### Talisman Repos

```bash
# For Talisman org
gh repo create talisman-engineering/<repo> --public --source . --push
```

### Personal Repos

```bash
# For personal/experimental
gh repo create rashidazarang/<repo> --public --source . --push
```

---

## Commit Message Format

```
<type>: <repo-name> v<version> - <summary>

<body - what's included>

Co-Authored-By: Rashid Azarang <rashid.azarang.e@gmail.com>
```

Types:
- `feat:` - New repo or major feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `chore:` - Maintenance

---

## Post-Publish Checklist

After every publish:

- [ ] Open repo in browser: `gh repo view <org>/<repo> --web`
- [ ] Verify README renders correctly
- [ ] Verify no secrets visible
- [ ] Add topics: `gh repo edit <org>/<repo> --add-topic mentu`
- [ ] Update Workspaces/CLAUDE.md if needed

---

## Mentu Integration

Record every publication:

```bash
# Capture as evidence
mentu capture "Published <repo> to github.com/<org>/<repo>" \
  --kind publication \
  --actor agent:claude-executor

# If part of a commitment
mentu submit cmt_XXXXXXXX \
  --summary "Published <repo> v<version>" \
  --actor agent:claude-executor
```

---

## Rollback

If you published secrets:

```bash
# 1. Rotate the secret IMMEDIATELY

# 2. Remove from history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file>" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all

# 3. Or nuclear option
gh repo delete <org>/<repo> --yes
# Then recreate clean
```

---

## Workspace Map

```
/Users/rashid/Desktop/Workspaces/
├── mentu-ai/       → github.com/mentu-ai/mentu
├── mentu-bridge/   → github.com/mentu-ai/mentu-bridge
├── mentu-proxy/    → github.com/mentu-ai/mentu-proxy
├── mentu-web/      → github.com/mentu-ai/mentu-web
├── claude-code/    → github.com/rashidazarang/claude-code
└── projects/       → (various)
```

---

*Clean repos reflect clean thinking. Publish with intention.*
