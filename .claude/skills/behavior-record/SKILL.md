---
name: record-behavior
description: Record browser behavior with comprehensive interaction tracking (clicks, typing, scrolling, hovers). Auto-saves every second, detects browser close. Recordings captured as Mentu evidence.
allowed-tools: Bash, Read, Write, Glob
---

# Behavior Recording Skill

Record user browser behavior with comprehensive interaction tracking, automatic evidence capture, and VPS-compatible replay specifications.

## Features

- **Auto-save every second** - No data loss, recording continuously saved
- **Browser close detection** - Just close browser when done, no ENTER needed
- **Comprehensive tracking** - Clicks, typing (passwords redacted), scrolling, hovers, selects, focus events
- **Mentu integration** - Automatically captured as evidence with commitment linking
- **VPS replay** - Generate YAML specs for headless replay

## Quick Start

```bash
# Simple recording
.claude/skills/behavior-record/scripts/record.sh https://mentu.ai

# With custom name
.claude/skills/behavior-record/scripts/record.sh https://app.example.com --name login-flow

# With auto-timeout (60 seconds)
.claude/skills/behavior-record/scripts/record.sh https://app.example.com --auto 60

# With commitment linking (creates evidence trail)
.claude/skills/behavior-record/scripts/record.sh https://dev.talismanapp.co --commitment cmt_abc123
```

## Interaction Tracking

The recorder captures comprehensive browser interactions:

| Interaction | Captured | Notes |
|-------------|----------|-------|
| **Clicks** | selector + element text | Full CSS selector with aria-label, data attributes |
| **Typing** | selector + value | Passwords automatically redacted |
| **Scrolling** | x,y coordinates | Throttled to 500ms intervals |
| **Hovers** | selector | Only on interactive elements (buttons, links, inputs) |
| **Selects** | selector + value | Dropdown selections |
| **Focus** | selector | Form field focus events |
| **Navigation** | URL | Page transitions |

## Recording Modes

### Browser Close Mode (Default)

Simply close the browser when done. Recording auto-saves every second:

```bash
.claude/skills/behavior-record/scripts/record.sh https://mentu.ai --name my-flow
# Perform actions in browser...
# Close browser window when done
# Recording finalizes automatically
```

### Auto-Timeout Mode

Set a specific timeout (useful when terminal isn't accessible):

```bash
.claude/skills/behavior-record/scripts/record.sh https://mentu.ai --auto 90
# Perform actions within 90 seconds
# Recording saves automatically after timeout
```

## Output Files

| File | Purpose |
|------|---------|
| `behaviors/{name}.json` | Full recording with all metadata |
| `behaviors/{name}.yaml` | Replayable specification for VPS |
| `~/.mentu/cookies/{domain}.json` | Session cookies for re-authentication |

### JSON Structure

```json
{
  "name": "login-flow",
  "target": "https://example.com",
  "created": "2026-01-12T20:00:00Z",
  "version": "1.0",
  "steps": [
    {
      "action": "navigate",
      "url": "https://example.com",
      "timestamp": 0
    },
    {
      "action": "click",
      "selector": "#email",
      "timestamp": 1500,
      "description": "Email input"
    },
    {
      "action": "type",
      "selector": "#email",
      "value": "[redacted]",
      "timestamp": 2100
    }
  ],
  "cookies": [...],
  "mentu": {
    "evidence_id": "mem_xxx"
  }
}
```

## Mentu Integration

### Automatic Evidence Capture

Every recording is automatically captured as Mentu evidence:

```bash
.claude/skills/behavior-record/scripts/record.sh https://mentu.ai
# Output includes: Evidence captured: mem_abc123
```

### Link to Commitment

Reference a commitment for traceable evidence:

```bash
.claude/skills/behavior-record/scripts/record.sh https://app.example.com --commitment cmt_xyz789
# Evidence is linked: mentu annotate cmt_xyz789 "Behavior recording evidence: ..."
```

### Skip Evidence Capture

```bash
.claude/skills/behavior-record/scripts/record.sh https://mentu.ai --no-capture
```

## CLI Reference

```bash
.claude/skills/behavior-record/scripts/record.sh <url> [options]

Arguments:
  url                     Target URL to record (required)

Options:
  --name <name>          Recording name (default: auto-generated from URL)
  --commitment <id>      Link evidence to commitment
  --output <dir>         Output directory (default: behaviors/)
  --auto <seconds>       Auto-save timeout (0 = wait for browser close)
  --json                 Output as JSON
  --no-capture           Skip Mentu evidence capture
```

## Workflow Integration

### With Commitments

```bash
# 1. Create commitment for behavior task
mentu commit "Record login flow for Talisman app" --source mem_task

# 2. Claim and record
mentu claim cmt_xxx
.claude/skills/behavior-record/scripts/record.sh https://dev.talismanapp.co --commitment cmt_xxx --name talisman-login

# 3. Submit with recording evidence
mentu submit cmt_xxx --summary "Recorded Talisman login flow" --include-files
```

### Replay on VPS

After recording, replay headlessly on VPS:

```bash
# Simple replay
node tools/behavior-replayer.js behaviors/talisman-login.yaml --headless

# Replay with commitment evidence
node tools/behavior-replayer.js behaviors/talisman-login.yaml --commitment cmt_xxx

# Spawn via bridge for persistent execution
mentu spawn cmt_xxx --directory . --prompt "Replay behavior: behaviors/talisman-login.yaml"
```

### Visual Testing

Use recordings for visual regression testing:

```bash
# Record baseline behavior
.claude/skills/behavior-record/scripts/record.sh https://app.example.com --name baseline-flow

# Later: replay and capture screenshots
node tools/behavior-replayer.js behaviors/baseline-flow.yaml --commitment cmt_xxx --screenshots
```

## Selector Strategy

The recorder uses a priority-based selector strategy for reliable replay:

1. **ID** - `#unique-id`
2. **Data attributes** - `[data-testid="login-btn"]`
3. **Aria labels** - `[aria-label="Submit"]`
4. **Name attribute** - `[name="email"]`
5. **Classes** - `button.primary.large`
6. **Role** - `[role="button"]`
7. **Tag fallback** - `button`

## Troubleshooting

### Browser doesn't open
```bash
# Check Puppeteer is installed
npm ls puppeteer
# If not: npm install puppeteer
```

### Recording not saving
- Auto-save runs every 1 second
- Check `behaviors/` directory for incremental saves
- Ensure output directory is writable

### Cookies not captured
- Perform login BEFORE closing browser
- Check `~/.mentu/cookies/` for domain file
- Some sites block cookie capture

### Steps not recording
- Ensure actions are on the main frame
- iFrames may not capture properly
- Check browser console for `BEHAVIOR_*` messages

## Requirements

- Node.js 18+
- Puppeteer (`npm install puppeteer`)
- Mentu CLI (for evidence capture)
- Interactive browser support (not headless)

## Examples

### Record Login Flow

```bash
.claude/skills/behavior-record/scripts/record.sh \
  https://app.example.com/login \
  --name example-login \
  --commitment cmt_abc123
```

### Record Full User Journey

```bash
.claude/skills/behavior-record/scripts/record.sh \
  https://shop.example.com \
  --name shopping-journey \
  --auto 120
```

### Record with Existing Cookies

Cookies from previous recordings are automatically loaded:

```bash
# First recording captures cookies
.claude/skills/behavior-record/scripts/record.sh https://app.example.com --name initial-session

# Second recording reuses cookies (already logged in)
.claude/skills/behavior-record/scripts/record.sh https://app.example.com --name logged-in-flow
```
