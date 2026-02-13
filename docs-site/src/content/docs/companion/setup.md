---
title: "Companion App Setup"
description: "Install and configure the Mentu Companion macOS menu bar app"
---

This guide covers installing, configuring, and verifying the Mentu Companion app on macOS.

## 1. Download

Download the latest release from the [GitHub Releases page](https://github.com/mentu-ai/mentu-companion/releases):

- Look for the `.dmg` file for your architecture (`arm64` for Apple Silicon, `x64` for Intel)
- Download the latest stable release

## 2. Install

1. Open the downloaded `.dmg` file
2. Drag the **Mentu Companion** icon to the **Applications** folder
3. Eject the disk image

On first launch, macOS may show a security prompt since the app is not distributed via the App Store. Go to **System Settings > Privacy & Security** and click **Open Anyway** if prompted.

## 3. First Launch

When you open the Companion for the first time, an onboarding wizard will guide you through initial configuration:

1. **Welcome screen** — brief introduction to what the Companion does
2. **Authentication** — enter your API token and workspace details
3. **Preferences** — configure notifications and startup behavior
4. **Verification** — the app connects to your workspace and confirms everything works

## 4. Configuration

After onboarding (or at any time from the Companion panel), configure the following settings:

### Required Settings

| Setting | Description | Example |
|---------|-------------|---------|
| **API Token** | Your Mentu API token for authentication | `mentu_tok_abc123...` |
| **Workspace ID** | The workspace to monitor | `2e78554d-9d92-4e4a-...` |
| **Dashboard URL** | Base URL of your Mentu dashboard (for deep links) | `https://app.mentu.dev` |

### Optional Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Polling interval** | How often the app checks for updates (in seconds) | `30` |
| **Notifications** | Enable/disable native macOS notifications | Enabled |
| **Launch at login** | Automatically start the Companion when you log in | Disabled |
| **Notification filter** | Which state transitions trigger notifications | `in_review` only |
| **Quiet hours** | Time range during which notifications are silenced | None |

To access settings after initial setup, click the Companion icon in the menu bar, then click the gear icon in the panel footer.

## 5. Verify

After configuration, the Companion should be running in your menu bar. Verify it is working correctly:

1. **Menu bar icon is visible** — look for the Mentu icon in the top-right area of your screen
2. **Icon color reflects pipeline health:**
   - **Green** — no commitments need attention
   - **Yellow** — commitments are awaiting review
   - **Red** — urgent items or errors detected
3. **Click the icon** — the panel should open showing recent activity from your workspace
4. **Check connectivity** — the panel footer should show "Connected" with the workspace name

## Troubleshooting

### Icon does not appear
- Ensure the app is running (check Activity Monitor for "Mentu Companion")
- macOS may hide menu bar icons if the bar is full — try closing other menu bar apps

### Icon stays gray
- Verify your API token is correct in settings
- Check that the workspace ID matches an active workspace
- Ensure your network connection allows access to the Mentu API

### Notifications not working
- Check **System Settings > Notifications** and ensure Mentu Companion has permission
- Verify notifications are enabled in the Companion settings
- Check that quiet hours are not currently active
