# VPS File Sync Infrastructure

Real-time file synchronization between Mac and VPS using SyncThing.

## Overview

The Mentu infrastructure spans two machines:

| Machine | Hostname | Path | Role |
|---------|----------|------|------|
| Mac | `rashid-mac` | `/Users/rashid/Desktop/Workspaces` | Development, primary |
| VPS | `mentu-vps-01` | `/home/mentu/Workspaces` | Execution, 24/7 runtime |

SyncThing keeps these directories synchronized in real-time.

---

## Architecture

```
┌─────────────────────────────────────┐           ┌─────────────────────────────────────┐
│  Mac (rashid-mac)                   │           │  VPS (mentu-vps-01)                 │
│                                     │           │                                     │
│  /Users/rashid/Desktop/Workspaces/  │◄─────────►│  /home/mentu/Workspaces/            │
│                                     │   :22000  │                                     │
│  ├── mentu-ai/                      │  TCP/QUIC │  ├── mentu-ai/                      │
│  ├── mentu-bridge/                  │           │  ├── mentu-bridge/                  │
│  ├── mentu-proxy/                   │           │  ├── mentu-proxy/                   │
│  ├── mentu-web/                     │           │  ├── mentu-web/                     │
│  ├── claude-code/                   │           │  ├── claude-code/                   │
│  └── projects/                      │           │  └── projects/                      │
│                                     │           │                                     │
│  SyncThing GUI: localhost:8384      │           │  SyncThing: cron @reboot            │
└─────────────────────────────────────┘           └─────────────────────────────────────┘
```

### Key Properties

| Property | Value |
|----------|-------|
| Protocol | SyncThing (peer-to-peer, encrypted) |
| Port | 22000 (TCP/QUIC) |
| Direction | Bidirectional |
| Encryption | TLS |
| Conflict handling | Last-writer-wins + `.sync-conflict-*` files |
| Current size | ~6.3 GB |

### Excluded Paths

These are not synced (defined in `.stignore`):

```
.git
node_modules
dist
.venv
__pycache__
.DS_Store
```

---

## VPS Details

| Property | Value |
|----------|-------|
| IP | 208.167.255.71 |
| Domain | mentu.rashidazarang.com |
| User | mentu |
| Plan | vhf-1c-2gb (2GB RAM, 64GB disk) |
| SyncThing Device ID | `FCF24BA-WUY276W-S2TD337-OZLJCCV-WN4EL2E-WYWLMFO-KI7ZMZF-ITKOOQ7` |

---

## How Sync Works

### Normal Operation

1. File changes on either machine
2. SyncThing detects change (filesystem watcher)
3. Change propagates to peer via port 22000
4. Peer receives, writes file
5. Both machines now identical

### Conflict Resolution

When both machines edit the same file while disconnected:

1. Both versions sync
2. One becomes canonical (by timestamp)
3. Other saved as `.sync-conflict-YYYYMMDD-HHMMSS-DEVICEID.ext`
4. Manual review required

---

## Rebuilding the Sync

If the sync breaks completely, here's how to restore it.

### Prerequisites

- SSH access to VPS: `ssh mentu@208.167.255.71`
- SyncThing installed on both machines

### Step 1: Install SyncThing

**Mac:**
```bash
brew install syncthing
brew services start syncthing
# GUI available at http://localhost:8384
```

**VPS:**
```bash
sudo apt update && sudo apt install syncthing
# Add to crontab for auto-start
crontab -e
# Add line: @reboot syncthing --no-browser
```

### Step 2: Get Device IDs

**Mac:**
1. Open http://localhost:8384
2. Actions → Show ID
3. Copy the device ID

**VPS:**
```bash
syncthing --device-id
# Or check config: cat ~/.config/syncthing/config.xml | grep -A1 "<device"
```

### Step 3: Add Devices to Each Other

**On Mac (via GUI):**
1. Add Remote Device
2. Paste VPS device ID
3. Name: "mentu-vps-01"
4. Save

**On VPS (via GUI or config):**
1. SSH tunnel for GUI: `ssh -L 8385:localhost:8384 mentu@208.167.255.71`
2. Open http://localhost:8385
3. Add Mac device ID
4. Accept on Mac when prompted

### Step 4: Create Shared Folder

**On both machines, create folder with:**

| Setting | Value |
|---------|-------|
| Folder ID | `workspaces` (must match exactly) |
| Folder Path | `/Users/rashid/Desktop/Workspaces` (Mac) |
| Folder Path | `/home/mentu/Workspaces` (VPS) |
| Share With | The other device |

### Step 5: Configure Ignores

Create `.stignore` in the Workspaces folder:

```
.git
node_modules
dist
.venv
__pycache__
.DS_Store
*.pyc
.pytest_cache
.mypy_cache
coverage/
.next/
```

### Step 6: Verify Sync

```bash
# Check Mac status
curl -s http://localhost:8384/rest/system/status | jq '.myID, .uptime'

# Check VPS status (via SSH)
ssh mentu@208.167.255.71 "curl -s http://localhost:8384/rest/system/status | jq '.myID'"

# Check folder status
curl -s http://localhost:8384/rest/db/status?folder=workspaces | jq '.state'
```

---

## Failure Scenarios

### Scenario 1: Mac Goes Offline

**What happens:**
- VPS continues running with its local copy
- Changes on VPS stay on VPS
- Changes on Mac stay on Mac

**When Mac returns:**
- SyncThing auto-reconnects
- Reconciles changes from both sides
- Conflicting edits create `.sync-conflict-*` files

**Risk:** Conflicting edits require manual resolution.

### Scenario 2: VPS Goes Down

**What happens:**
- Mac continues normally
- Bridge daemon stops (no VPS execution)
- Agents can't run on VPS

**Recovery:**
```bash
# Restart VPS
ssh mentu@208.167.255.71 "sudo reboot"
# SyncThing auto-starts via cron @reboot
# Files sync back to current state
```

### Scenario 3: Network Partition

**What happens:**
- Both machines run independently
- Queue of changes builds on each side
- Neither knows about the other's changes

**When reconnected:**
- Flood of sync activity
- Potential conflicts if same files edited

**Mitigation:** Avoid editing same files on both machines.

### Scenario 4: SyncThing Process Dies

**Symptoms:**
- Files stop syncing
- `curl http://localhost:8384` fails

**Mac recovery:**
```bash
brew services restart syncthing
```

**VPS recovery:**
```bash
# Kill and restart
pkill syncthing
syncthing --no-browser &

# Or reboot (triggers @reboot cron)
sudo reboot
```

### Scenario 5: Catastrophic VPS Loss

**What happens:**
- VPS disk destroyed
- All VPS data gone

**Recovery:**
1. Mac has full copy of all files
2. Provision new VPS
3. Install SyncThing
4. Re-add devices (new device ID)
5. Create shared folder
6. Initial sync repopulates VPS (~6.3GB, ~30 minutes)

**Note:** No data lost if Mac is intact.

---

## Health Checks

### Quick Status

```bash
# Mac - SyncThing running?
brew services list | grep syncthing

# Mac - Sync status
curl -s http://localhost:8384/rest/system/status | jq '{uptime, myID}'

# VPS - via public endpoint
curl -s https://mentu.rashidazarang.com/health

# VPS - direct check
ssh mentu@208.167.255.71 "pgrep -a syncthing"
```

### Folder Sync Status

```bash
# Get folder status (should be "idle" when synced)
curl -s http://localhost:8384/rest/db/status?folder=workspaces | jq '{state, needBytes, globalBytes}'
```

| State | Meaning |
|-------|---------|
| `idle` | Fully synced |
| `scanning` | Checking for changes |
| `syncing` | Transferring files |
| `error` | Something wrong |

### Check Connection to Peer

```bash
curl -s http://localhost:8384/rest/system/connections | jq 'to_entries[] | {device: .key, connected: .value.connected}'
```

---

## Configuration Reference

### Mac Config Location

```
~/.config/syncthing/config.xml
```

### VPS Config Location

```
/home/mentu/.config/syncthing/config.xml
```

### Key Config Elements

```xml
<folder id="workspaces" path="/Users/rashid/Desktop/Workspaces">
    <device id="FCF24BA-..."></device>
</folder>

<device id="FCF24BA-..." name="mentu-vps-01">
    <address>dynamic</address>
</device>
```

---

## Manifest Reference

The sync is documented in the Workspaces manifest:

**File:** `/Users/rashid/Desktop/Workspaces/.mentu/manifest.yaml`

```yaml
sync:
  protocol: syncthing
  port: 22000
  direction: bidirectional
  excludes:
    - .git
    - node_modules
    - dist
    - .venv
    - __pycache__
    - .DS_Store

location:
  mac:
    path: /Users/rashid/Desktop/Workspaces
    hostname: rashid-mac
  vps:
    path: /home/mentu/Workspaces
    hostname: mentu-vps-01
    ip: 208.167.255.71
    domain: mentu.rashidazarang.com
```

---

## Commands Quick Reference

| Action | Command |
|--------|---------|
| Mac: Start SyncThing | `brew services start syncthing` |
| Mac: Stop SyncThing | `brew services stop syncthing` |
| Mac: Restart SyncThing | `brew services restart syncthing` |
| Mac: Open GUI | Open http://localhost:8384 |
| VPS: Check process | `ssh mentu@208.167.255.71 "pgrep -a syncthing"` |
| VPS: Start manually | `ssh mentu@208.167.255.71 "syncthing --no-browser &"` |
| VPS: View GUI | `ssh -L 8385:localhost:8384 mentu@208.167.255.71` then http://localhost:8385 |
| Check sync status | `curl -s http://localhost:8384/rest/db/status?folder=workspaces` |
| Check connections | `curl -s http://localhost:8384/rest/system/connections` |
| VPS health | `curl -s https://mentu.rashidazarang.com/health` |

---

## Related Documentation

- **Mentu Cloud Sync** (`SYNC.md`): Supabase-based operation sync (different from file sync)
- **VPS Runtime** (`claude-code/docs/PRD-VPSRuntimeContainer-v1.2.md`): Full VPS infrastructure
- **Workspaces Manifest** (`.mentu/manifest.yaml`): Canonical sync configuration

---

*File synchronization layer for the Mentu distributed agent infrastructure.*
