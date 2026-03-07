#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
Mentu SessionStart Hook - Injects claimed commitments into Claude's context.

This hook runs when a Claude Code session starts and returns context
about any commitments claimed by this agent.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Dict


def get_active_commitment() -> str:
    """Get active commitment from tracking file."""
    try:
        active_file = Path(".mentu/active_commitment")
        if active_file.exists():
            cmt_id = active_file.read_text().strip()
            if cmt_id.startswith("cmt_"):
                return cmt_id
    except Exception:
        pass
    return ""


def close_stale_commitment(cmt_id: str) -> None:
    """Submit + close a leftover commitment from a crashed session."""
    actor = os.environ.get("MENTU_ACTOR", "{{ACTOR}}")
    evidence_ids: list[str] = []
    evidence_log = Path(".claude/mentu_evidence.json")
    if evidence_log.exists():
        try:
            entries = json.loads(evidence_log.read_text())
            evidence_ids = [e["id"] for e in entries[-10:]]
        except Exception:
            pass

    # Submit (sync, best-effort)
    try:
        subprocess.run(
            ["mentu", "submit", cmt_id, "--summary", "Auto-closed stale session",
             "--actor", actor, "--json"],
            capture_output=True, text=True, timeout=10
        )
    except Exception:
        pass

    # Close (sync, best-effort)
    try:
        cmd = ["mentu", "close", cmt_id, "--actor", actor]
        if evidence_ids:
            cmd.extend(["--evidence", evidence_ids[0]])
        subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    except Exception:
        pass

    # Clear tracking file
    Path(".mentu/active_commitment").unlink(missing_ok=True)


def ensure_active_commitment() -> str:
    """Create a commitment for this session if none exists. Returns cmt_id or ''."""
    active_file = Path(".mentu/active_commitment")
    actor = os.environ.get("MENTU_ACTOR", "{{ACTOR}}")

    # Already have one
    if active_file.exists():
        existing = active_file.read_text().strip()
        if existing.startswith("cmt_"):
            return existing

    # Step 1: Capture a session-start memory (sync — need the mem_id)
    try:
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=5
        ).stdout.strip() or "unknown"
    except Exception:
        branch = "unknown"

    session_body = f"Session started on branch {branch}"
    try:
        result = subprocess.run(
            ["mentu", "capture", session_body, "--kind", "session",
             "--actor", actor, "--json"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return ""
        mem_id = json.loads(result.stdout).get("id", "")
    except Exception:
        return ""

    if not mem_id:
        return ""

    # Step 2: Commit from that memory (sync — need the cmt_id)
    try:
        result = subprocess.run(
            ["mentu", "commit", f"Work session: {branch}",
             "--source", mem_id, "--actor", actor, "--json"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return ""
        cmt_id = json.loads(result.stdout).get("id", "")
    except Exception:
        return ""

    if not cmt_id:
        return ""

    # Step 3: Claim it (fire-and-forget)
    try:
        subprocess.Popen(
            ["mentu", "claim", cmt_id, "--actor", actor],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass

    # Step 4: Write tracking file
    active_file.parent.mkdir(parents=True, exist_ok=True)
    active_file.write_text(cmt_id)

    return cmt_id


def get_lifecycle_summary() -> str:
    """Get commitment lifecycle summary from mentu status."""
    try:
        result = subprocess.run(
            ["mentu", "status", "--json"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return ""
        return result.stdout.strip()
    except Exception:
        return ""


def get_claimed_commitments() -> List[Dict]:
    """Get commitments claimed by this agent."""
    actor = os.environ.get("MENTU_ACTOR", "{{ACTOR}}")

    try:
        result = subprocess.run(
            ["mentu", "list", "commitments", "--state", "claimed", "--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            return []

        all_commitments = json.loads(result.stdout)
        # Filter to commitments claimed by this actor
        return [c for c in all_commitments if c.get("owner") == actor]
    except Exception:
        return []


def main():
    """Main hook entry point - returns context to inject."""
    # Read hook input from stdin to determine session source
    try:
        hook_input = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        hook_input = {}

    source = hook_input.get("source", "startup")

    # Sync with cloud before checking commitments (best-effort, non-blocking)
    try:
        subprocess.Popen(
            ["mentu", "sync"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass

    # Only manage commitment lifecycle on new sessions or clear
    # Resume and compact are the same session — don't touch the active commitment
    if source in ("startup", "clear"):
        stale = get_active_commitment()
        if stale:
            close_stale_commitment(stale)
        active_cmt = ensure_active_commitment()
    else:
        active_cmt = get_active_commitment()

    claimed = get_claimed_commitments()
    lifecycle_json = get_lifecycle_summary()

    has_context = claimed or active_cmt or lifecycle_json

    if not has_context:
        # No commitments = no context to inject
        sys.exit(0)

    # Format for injection
    context = "## Mentu Lifecycle State\n\n"

    # Active commitment (from tracking file)
    if active_cmt:
        context += f"**Active commitment (in-progress):** `{active_cmt}`\n\n"

    # Claimed commitments
    if claimed:
        context += "**Claimed commitments** — you MUST submit each before stopping:\n\n"
        for cmt in claimed:
            context += f"- `{cmt['id']}`: {cmt['body']}\n"
        context += "\n"

    # Lifecycle summary
    if lifecycle_json:
        try:
            status = json.loads(lifecycle_json)
            counts = []
            for state in ["open", "claimed", "in_review", "closed"]:
                count = status.get(state, 0)
                if count:
                    counts.append(f"{state}: {count}")
            if counts:
                context += f"**Lifecycle counts:** {', '.join(counts)}\n\n"
        except (json.JSONDecodeError, TypeError):
            pass

    context += "Use `mentu submit <id> --summary '...'` when complete."

    print(context)
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"SessionStart hook error: {e}\n")
        sys.exit(0)
