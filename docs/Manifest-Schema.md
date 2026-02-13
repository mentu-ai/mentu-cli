---
id: Manifest-Schema-v1.0
path: docs/Manifest-Schema.md
type: reference
intent: reference
version: "1.0"
created: 2025-12-30
last_updated: 2025-12-30
---

# Mentu Manifest Schema v1.0

## Overview

The manifest file (`.mentu/manifest.yaml`) declares what a repository can do. Claude queries available capabilities before execution.

## Location

Always at `.mentu/manifest.yaml` in the repository root.

## Schema

```yaml
# Required: Repository identity
name: string                      # Unique identifier (kebab-case)
description: string               # One-line description
version: string                   # Semantic version (e.g., "1.0.0")

# Optional: Execution requirements
requires:
  - mentu                         # CLI requirements

# Required: Capability declarations
capabilities:
  - name: string                  # Capability identifier (kebab-case)
    description: string           # Human-readable description
    command: string               # Command template with {placeholders}
    agent: claude | bash          # Execution agent (default: bash)
    working_dir: string           # Working directory (default: repo root)
    timeout: number               # Timeout in seconds (default: 300)

    # Input parameters
    inputs:
      param_name:
        type: string | number | boolean | array | object
        required: boolean         # Default: false
        default: any              # Default value if not provided
        description: string       # Parameter description

    # Expected outputs
    outputs:
      field_name:
        type: string | number | boolean | array | object
        description: string       # Output description

# Optional: Mentu integration
mentu:
  actor: string                   # Default actor for this repo
  auto_capture: boolean           # Auto-capture commands as evidence
```

## Examples

### Simple Repository

```yaml
name: my-app
description: My application
version: "1.0.0"

capabilities:
  - name: test
    description: Run unit tests
    command: npm test

  - name: build
    description: Build the application
    command: npm run build

  - name: deploy
    description: Deploy to staging
    command: npm run deploy:staging
```

### With Parameters

```yaml
name: devops-tools
description: DevOps automation tools
version: "2.0.0"

capabilities:
  - name: deploy
    description: Deploy to specified environment
    command: ./deploy.sh {environment}
    inputs:
      environment:
        type: string
        required: true
        description: Target environment (staging, production)
    outputs:
      url:
        type: string
        description: Deployed URL

  - name: scale
    description: Scale service replicas
    command: kubectl scale deployment/{service} --replicas={count}
    inputs:
      service:
        type: string
        required: true
      count:
        type: number
        required: true
        default: 3
```

### With Claude Agent

```yaml
name: code-reviewer
description: AI-powered code review
version: "1.0.0"

capabilities:
  - name: review
    description: Review code changes
    command: "Review the recent changes and provide feedback"
    agent: claude
    inputs:
      focus:
        type: string
        default: "security,performance"
        description: Review focus areas
```

## Validation

```bash
# Validate manifest syntax
python3 -c "import yaml; yaml.safe_load(open('.mentu/manifest.yaml'))"

# Validate against schema (if jsonschema available)
python3 -c "
import yaml
import jsonschema
manifest = yaml.safe_load(open('.mentu/manifest.yaml'))
# Schema validation here
print('Valid manifest')
"
```

## Bridge Integration

The Mentu Bridge daemon scans configured directories for manifests and reports capabilities to Supabase. Claude can then query available capabilities via the proxy's `/capabilities` endpoint.

```
Bridge Daemon
    |
    +-- Scan allowed_directories
    |   +-- Read .mentu/manifest.yaml
    |
    +-- Report to Supabase
        +-- machine_capabilities table
```

---

*Declare what you can do. Let Claude discover it.*
