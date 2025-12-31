#!/usr/bin/env python3
"""
Mentu Post-Task Hook
Called when Claude completes a task. Captures evidence and closes commitment.
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


def load_active_commitment() -> Optional[dict]:
    """Load active commitment from session state."""
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def clear_active_commitment() -> None:
    """Clear active commitment state."""
    try:
        os.remove(STATE_FILE)
    except FileNotFoundError:
        pass


def on_task_complete(summary: str, evidence_details: Optional[dict] = None) -> None:
    """
    Called when Claude completes a task.
    Creates: evidence memory -> close commitment
    """
    state = load_active_commitment()
    if not state:
        print("[Mentu] Warning: No active commitment found", file=sys.stderr)
        return

    commitment_id = state.get("active_commitment")
    actor = state.get("actor", ACTOR)

    # 1. Build evidence body
    evidence_body = f"Completed: {summary}"
    if evidence_details:
        if evidence_details.get("pr_number"):
            evidence_body += f"\n\nPR: #{evidence_details['pr_number']}"
        if evidence_details.get("pr_url"):
            evidence_body += f"\nURL: {evidence_details['pr_url']}"
        if evidence_details.get("files_changed"):
            evidence_body += f"\nFiles: {', '.join(evidence_details['files_changed'])}"
        if evidence_details.get("tests_passed"):
            evidence_body += "\nTests: Passing"

    # 2. Capture evidence
    mem_result = call_mentu({
        "op": "capture",
        "actor": actor,
        "payload": {
            "body": evidence_body,
            "kind": "evidence",
            "meta": evidence_details or {}
        }
    })

    if not mem_result.get("id"):
        print("[Mentu] Failed to capture evidence", file=sys.stderr)
        return

    evidence_id = mem_result["id"]
    print(f"[Mentu] Evidence: {evidence_id}")

    # 3. Close with evidence
    call_mentu({
        "op": "close",
        "actor": actor,
        "payload": {
            "commitment": commitment_id,
            "evidence": evidence_id
        }
    })
    print(f"[Mentu] Closed: {commitment_id} with {evidence_id}")

    # 4. Clear state
    clear_active_commitment()


def on_task_error(error_message: str) -> None:
    """
    Called when task fails.
    Annotates commitment with error and releases claim.
    """
    state = load_active_commitment()
    if not state:
        return

    commitment_id = state.get("active_commitment")
    actor = state.get("actor", ACTOR)

    # 1. Annotate with error
    call_mentu({
        "op": "annotate",
        "actor": actor,
        "payload": {
            "target": commitment_id,
            "body": f"Task failed: {error_message}",
            "kind": "error"
        }
    })
    print(f"[Mentu] Annotated error on {commitment_id}")

    # 2. Release claim
    call_mentu({
        "op": "release",
        "actor": actor,
        "payload": {
            "commitment": commitment_id
        }
    })
    print(f"[Mentu] Released: {commitment_id}")

    # 3. Clear state
    clear_active_commitment()


if __name__ == "__main__":
    # Read from args: complete <summary> OR fail <error_message>
    if len(sys.argv) < 3:
        print("Usage: mentu_post_task.py complete <summary>", file=sys.stderr)
        print("       mentu_post_task.py fail <error_message>", file=sys.stderr)
        sys.exit(1)

    action = sys.argv[1]
    message = " ".join(sys.argv[2:])

    if action == "complete":
        on_task_complete(message)
    elif action == "fail":
        on_task_error(message)
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)
