---
name: visual-pathway
description: Replay recorded browser pathways and capture screenshots at multiple resolutions. Uploads to Supabase with JSON manifest. Runs on VPS for headless execution.
allowed-tools: Bash, Read, Write, Glob
---

# Visual Pathway Skill

Replay recorded browser behaviors and capture visual evidence at multiple screen resolutions. Screenshots are uploaded to Supabase Storage with a JSON manifest for easy access.

## Features

- **Multi-resolution capture** - Desktop, laptop, tablet, mobile viewports
- **Headless execution** - Runs on VPS without display
- **Supabase integration** - Automatic upload with public URLs
- **Mentu evidence** - Captured as memories, linked to commitments
- **WebP compression** - Efficient storage with configurable quality

## Quick Start

```bash
# Capture pathway with default settings (desktop only)
.claude/skills/visual-pathway/scripts/capture.sh behaviors/talisman-flow.json

# Capture at multiple resolutions
.claude/skills/visual-pathway/scripts/capture.sh behaviors/login.yaml --viewports desktop,tablet,mobile

# Capture with commitment linking
.claude/skills/visual-pathway/scripts/capture.sh behaviors/app.json --commitment cmt_abc123 --name app-visual
```

## Viewports

| Viewport | Dimensions | Type |
|----------|------------|------|
| `desktop` | 1920x1080 | Desktop browser |
| `laptop` | 1366x768 | Laptop browser |
| `tablet` | 768x1024 | iPad (mobile, touch) |
| `mobile` | 375x812 | iPhone (mobile, touch) |

## CLI Reference

```bash
.claude/skills/visual-pathway/scripts/capture.sh <recording> [options]

Arguments:
  recording             Path to behavior recording (JSON/YAML)

Options:
  --name <name>        Pathway name (default: auto-generated)
  --viewports <list>   Comma-separated viewports (default: desktop)
  --commitment <id>    Link evidence to commitment
  --bucket <name>      Supabase bucket (default: visual-evidence)
  --format <fmt>       Screenshot format: png, jpeg, webp (default: webp)
  --quality <num>      Quality 1-100 (default: 85)
  --wait <ms>          Wait between steps (default: 1000)
  --local              Run locally instead of VPS
  --json               Output as JSON
```

## Output Structure

### Supabase Storage

```
visual-evidence/
└── pathways/
    └── {pathway-name}/
        ├── step-000-desktop.webp
        ├── step-000-tablet.webp
        ├── step-000-mobile.webp
        ├── step-001-desktop.webp
        ├── ...
        └── manifest.json
```

### JSON Manifest

```json
{
  "success": true,
  "pathwayName": "talisman-flow-20260112-123456",
  "recording": "behaviors/talisman-flow.json",
  "startedAt": "2026-01-12T12:34:56.789Z",
  "completedAt": "2026-01-12T12:35:30.123Z",
  "duration": 33334,
  "totalSteps": 12,
  "totalScreenshots": 36,
  "viewports": ["desktop", "tablet", "mobile"],
  "screenshots": [
    {
      "stepIndex": 0,
      "step": { "action": "navigate", "url": "https://example.com" },
      "viewport": "desktop",
      "supabaseUrl": "https://xxx.supabase.co/storage/v1/object/public/visual-evidence/...",
      "timestamp": "2026-01-12T12:34:57.123Z",
      "fileSize": 45678,
      "dimensions": { "width": 1920, "height": 1080 }
    }
  ],
  "supabaseFolder": "pathways/talisman-flow-20260112-123456",
  "evidenceId": "mem_abc123"
}
```

## Mentu Integration

### Automatic Evidence Capture

Every pathway capture is automatically recorded as Mentu evidence:

```bash
.claude/skills/visual-pathway/scripts/capture.sh behaviors/app.json
# Output includes: Evidence captured: mem_xxx
```

### Link to Commitment

```bash
.claude/skills/visual-pathway/scripts/capture.sh behaviors/app.json --commitment cmt_abc123
# Evidence is linked: mentu annotate cmt_abc123 "Visual pathway evidence: ..."
```

### Workflow Integration

```bash
# 1. Create commitment for visual testing
mentu commit "Capture visual evidence for Talisman app" --source mem_task

# 2. Claim and capture
mentu claim cmt_xxx
.claude/skills/visual-pathway/scripts/capture.sh behaviors/talisman-flow.json \
  --commitment cmt_xxx \
  --viewports desktop,tablet,mobile \
  --name talisman-visual

# 3. Submit with evidence
mentu submit cmt_xxx --summary "Captured visual pathway with 36 screenshots" --include-files
```

## VPS Execution

By default, pathways run on VPS for headless browser support:

- **Host**: `208.167.255.71`
- **User**: `mentu`
- **Path**: `/home/mentu/Workspaces/mentu-ai`

The recording file is automatically copied to VPS, executed, and cleaned up.

### Local Execution

For debugging or visible browser:

```bash
.claude/skills/visual-pathway/scripts/capture.sh behaviors/app.json --local
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `MENTU_SUPABASE_URL` | Alt | Alternative Supabase URL |
| `MENTU_SUPABASE_KEY` | Alt | Alternative Supabase key |

## Best Practices

1. **Use WebP format** - 50-70% smaller than PNG
2. **Test locally first** - Use `--local --no-headless` for debugging
3. **Link to commitments** - Creates traceable evidence chain
4. **Multiple viewports** - Catch responsive design issues

## Troubleshooting

### SSH connection failed
```bash
# Test VPS connectivity
ssh mentu@208.167.255.71 'echo OK'
```

### Puppeteer fails on VPS
```bash
# Check dependencies
ssh mentu@208.167.255.71 'which chromium || which google-chrome'
```

### Supabase upload fails
```bash
# Verify credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

### Recording not found
- Use absolute paths or paths relative to mentu-ai directory
- Check file exists: `ls -la behaviors/`

## Examples

### Responsive Testing

```bash
# All viewports
.claude/skills/visual-pathway/scripts/capture.sh behaviors/homepage.json \
  --name homepage-responsive \
  --viewports desktop,laptop,tablet,mobile
```

### High Quality PNG

```bash
# Lossless PNG for pixel-perfect comparison
.claude/skills/visual-pathway/scripts/capture.sh behaviors/checkout.json \
  --format png \
  --name checkout-highres
```

### CI/CD Integration

```bash
# JSON output for pipeline parsing
RESULT=$(.claude/skills/visual-pathway/scripts/capture.sh behaviors/app.json --json)
SUCCESS=$(echo "$RESULT" | jq -r '.success')
SCREENSHOTS=$(echo "$RESULT" | jq -r '.totalScreenshots')
```
