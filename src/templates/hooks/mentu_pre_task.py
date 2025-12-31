#!/usr/bin/env python3
"""
Mentu Pre-Task Hook
Called when Claude receives a task. Creates commitment and claims it.
"""

import os
import json
import sys
from typing import Optional
from urllib import request
from urllib.error import HTTPError

MENTU_API = os.environ.get("MENTU_API_URL", "https://mentu-proxy.affihub.workers.dev")
MENTU_TOKEN = os.environ.get("MENTU_PROXY_TOKEN", "")
WORKSPACE_ID = os.environ.get("MENTU_WORKSPACE_ID", "")
ACTOR = os.environ.get("MENTU_ACTOR", "agent:claude-code")

STATE_FILE = ".claude/mentu_state.json"


def call_mentu(operation: dict) -> dict:
    """Call Mentu API."""
    if not MENTU_TOKEN:
        print("[Mentu] Warning: MENTU_PROXY_TOKEN not set", file=sys.stderr)
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
    except HTTPError as e:
        print(f"[Mentu] API error: {e.code} - {e.read().decode()}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"[Mentu] Error: {e}", file=sys.stderr)
        return {}


def save_active_commitment(commitment_id: str, memory_id: str) -> None:
    """Store active commitment for session."""
    os.makedirs(".claude", exist_ok=True)
    state = {
        "active_commitment": commitment_id,
        "source_memory": memory_id,
        "actor": ACTOR
    }
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def on_task_start(task_description: str, context: Optional[dict] = None) -> str:
    """
    Called when Claude receives a task.
    Creates: memory -> commitment -> claim
    Returns: commitment_id
    """
    # 1. Capture the task as a memory
    mem_result = call_mentu({
        "op": "capture",
        "actor": ACTOR,
        "payload": {
            "body": f"Task received: {task_description}",
            "kind": "task_request",
            "meta": {
                "source": "claude-code",
                "context": context or {}
            }
        }
    })

    if not mem_result.get("id"):
        print("[Mentu] Failed to capture memory", file=sys.stderr)
        return ""

    memory_id = mem_result["id"]
    print(f"[Mentu] Captured: {memory_id}")

    # 2. Create commitment
    cmt_result = call_mentu({
        "op": "commit",
        "actor": ACTOR,
        "payload": {
            "body": task_description,
            "source": memory_id
        }
    })

    if not cmt_result.get("id"):
        print("[Mentu] Failed to create commitment", file=sys.stderr)
        return ""

    commitment_id = cmt_result["id"]
    print(f"[Mentu] Committed: {commitment_id}")

    # 3. Claim it
    call_mentu({
        "op": "claim",
        "actor": ACTOR,
        "payload": {
            "commitment": commitment_id
        }
    })
    print(f"[Mentu] Claimed: {commitment_id}")

    # 4. Save state
    save_active_commitment(commitment_id, memory_id)

    return commitment_id


if __name__ == "__main__":
    # Read task from stdin or args
    if len(sys.argv) > 1:
        task = " ".join(sys.argv[1:])
    else:
        task = sys.stdin.read().strip()

    if task:
        commitment_id = on_task_start(task)
        if commitment_id:
            print(f"[Mentu] Ready: {commitment_id}")
