#!/usr/bin/env python3
"""
Mentu PR Events Hook
Called when PRs are created or merged.
"""

import os
import json
import sys
from typing import Optional
from urllib import request

MENTU_API = os.environ.get("MENTU_API_URL", "https://mentu-proxy.affihub.workers.dev")
MENTU_TOKEN = os.environ.get("MENTU_PROXY_TOKEN", "")
WORKSPACE_ID = os.environ.get("MENTU_WORKSPACE_ID", "")
ACTOR = os.environ.get("MENTU_ACTOR", "agent:claude-code")

STATE_FILE = ".claude/mentu_state.json"


def call_mentu(operation: dict) -> dict:
    """Call Mentu API."""
    if not MENTU_TOKEN:
        return {}

    data = json.dumps({
        "workspace_id": WORKSPACE_ID,
        **operation
    }).encode("utf-8")

    req = request.Request(
        f"{MENTU_API}/ops",
        data=data,
        headers={
            "X-Proxy-Token": MENTU_TOKEN,
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"[Mentu] Error: {e}", file=sys.stderr)
        return {}


def load_active_commitment() -> Optional[str]:
    """Load active commitment from session state."""
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
            return state.get("active_commitment")
    except FileNotFoundError:
        return None


def clear_active_commitment() -> None:
    """Clear active commitment state."""
    try:
        os.remove(STATE_FILE)
    except FileNotFoundError:
        pass


def on_pr_created(pr_number: int, pr_url: str, pr_title: str) -> None:
    """Called when Claude creates a PR."""
    commitment_id = load_active_commitment()
    if not commitment_id:
        return

    call_mentu({
        "op": "annotate",
        "actor": ACTOR,
        "payload": {
            "target": commitment_id,
            "body": f"PR created: #{pr_number} - {pr_title}\n{pr_url}",
            "kind": "pr_created",
            "meta": {
                "pr_number": pr_number,
                "pr_url": pr_url
            }
        }
    })
    print(f"[Mentu] Linked PR #{pr_number} to {commitment_id}")


def on_pr_merged(pr_number: int, pr_url: str, merge_sha: str) -> None:
    """Called when PR is merged - this IS the evidence."""
    commitment_id = load_active_commitment()
    if not commitment_id:
        return

    # Capture PR merge as evidence
    mem_result = call_mentu({
        "op": "capture",
        "actor": ACTOR,
        "payload": {
            "body": f"PR #{pr_number} merged\nCommit: {merge_sha}\nURL: {pr_url}",
            "kind": "evidence",
            "meta": {
                "type": "pr_merged",
                "pr_number": pr_number,
                "pr_url": pr_url,
                "merge_sha": merge_sha
            }
        }
    })

    if not mem_result.get("id"):
        print("[Mentu] Failed to capture PR evidence", file=sys.stderr)
        return

    evidence_id = mem_result["id"]

    # Auto-close commitment with this evidence
    call_mentu({
        "op": "close",
        "actor": ACTOR,
        "payload": {
            "commitment": commitment_id,
            "evidence": evidence_id
        }
    })

    clear_active_commitment()
    print(f"[Mentu] Closed {commitment_id} - PR #{pr_number} merged")


if __name__ == "__main__":
    # Usage: mentu_pr_events.py created <number> <url> <title>
    #        mentu_pr_events.py merged <number> <url> <sha>
    if len(sys.argv) < 5:
        print("Usage: mentu_pr_events.py created <number> <url> <title>", file=sys.stderr)
        print("       mentu_pr_events.py merged <number> <url> <sha>", file=sys.stderr)
        sys.exit(1)

    event = sys.argv[1]
    pr_number = int(sys.argv[2])
    pr_url = sys.argv[3]
    extra = " ".join(sys.argv[4:])

    if event == "created":
        on_pr_created(pr_number, pr_url, extra)
    elif event == "merged":
        on_pr_merged(pr_number, pr_url, extra)
