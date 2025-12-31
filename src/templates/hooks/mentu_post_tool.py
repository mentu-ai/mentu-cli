#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
Mentu PostToolUse Hook - Auto-captures file modifications as evidence.

This hook runs after Edit, Write, or MultiEdit tools are used and
captures the file modification as a Mentu memory for later use as evidence.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

EVIDENCE_LOG = Path(".claude/mentu_evidence.json")


def capture_evidence(body: str) -> Optional[str]:
    """Capture a memory as evidence, return ID."""
    actor = os.environ.get("MENTU_ACTOR", "agent:claude-code")

    try:
        result = subprocess.run(
            ["mentu", "capture", body, "--kind", "evidence", "--actor", actor, "--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        return data.get("id")
    except Exception:
        return None


def append_to_evidence_log(mem_id: str, file_path: str, evidence_type: str) -> None:
    """Store evidence for later use."""
    log = []
    if EVIDENCE_LOG.exists():
        try:
            log = json.loads(EVIDENCE_LOG.read_text())
        except Exception:
            log = []

    log.append({
        "id": mem_id,
        "file": file_path,
        "ts": subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
                             capture_output=True, text=True).stdout.strip(),
        "type": evidence_type
    })

    EVIDENCE_LOG.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_LOG.write_text(json.dumps(log, indent=2))


def main():
    """Main hook entry point."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(json.dumps({}))
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only capture file changes
    if tool_name not in ["Edit", "Write", "MultiEdit"]:
        print(json.dumps({}))
        sys.exit(0)

    file_path = tool_input.get("file_path") or tool_input.get("path", "")
    if not file_path:
        print(json.dumps({}))
        sys.exit(0)

    # Build evidence body and type
    if tool_name == "Write":
        body = f"Created: {file_path}"
        evidence_type = "file_created"
    else:
        body = f"Modified: {file_path}"
        evidence_type = "file_modified"

    # Capture as evidence memory
    mem_id = capture_evidence(body)

    if mem_id:
        append_to_evidence_log(mem_id, file_path, evidence_type)
        sys.stderr.write(f"[Mentu] Evidence captured: {mem_id} ({evidence_type})\n")

    print(json.dumps({}))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"PostToolUse hook error: {e}\n")
        print(json.dumps({}))
        sys.exit(0)
