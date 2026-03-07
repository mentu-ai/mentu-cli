# Skill: Remote Login

Open an interactive browser session for user authentication, capture cookies, and sync to VPS.

## Trigger

This skill is invoked via `/login` command.

## What This Skill Does

1. Opens a browser window on Mac (where user can see and interact)
2. User navigates to target site and authenticates
3. User presses ENTER to signal completion
4. Cookies captured and saved to `~/.mentu/cookies/{domain}.json`
5. SyncThing syncs cookies to VPS automatically
6. VPS can now use cookies for authenticated headless operations

## Usage

```bash
# Login to a website
/login https://mentu.ai

# Check cookie status
/login --status mentu.ai

# List all stored cookies
/login --list

# Clear cookies for a domain
/login --clear github.com
```

## Execution Flow

```
+-------------+     +-------------+     +-------------+
|   INVOKE    | --> |   BROWSER   | --> |   CAPTURE   |
|   /login    |     |   Opens     |     |   Cookies   |
|   <url>     |     |   User logs |     |   on ENTER  |
+-------------+     |   in        |     +-------------+
                    +-------------+            |
                                               v
                                        +-------------+
                                        |   SYNCTHING |
                                        |   Mac -> VPS|
                                        +-------------+
```

## Cookie Storage

| Location | Path |
|----------|------|
| Mac | `~/.mentu/cookies/{domain}.json` |
| VPS | `/home/mentu/Workspaces/.mentu/cookies/{domain}.json` |

Domain mapping:
- `mentu.ai` -> `mentu-ai.json`
- `github.com` -> `github-com.json`
- `www.example.com` -> `example-com.json`

## VPS Usage

After login, VPS tools can load cookies:

```javascript
const cookies = JSON.parse(fs.readFileSync('~/.mentu/cookies/mentu-ai.json'));
await page.setCookie(...cookies);
// Now authenticated!
```

## Integration

- Works with `BrowserBehaviorRecording` skill
- Used by `mentu-bridge` for authenticated screenshots
- Enables VPS evidence capture for protected pages

## Requirements

- Puppeteer installed (`npm install puppeteer`)
- Interactive terminal (Mac)
- SyncThing running for VPS sync
