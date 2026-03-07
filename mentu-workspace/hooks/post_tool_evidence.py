#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
PostToolUse Hook: Capture tool operations as evidence memories.

Creates an audit trail of significant tool operations without agent intervention.

HOOK EVENT: PostToolUse
MATCHER: Edit|Write|Bash
INPUT: {"tool_name": "...", "tool_input": {...}, "tool_output": "..."}
OUTPUT: {} (non-blocking)

Evidence is captured silently. Errors are logged but don't block.
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from typing import Optional


# Tools that generate evidence
EVIDENCE_TOOLS = {"Edit", "Write", "Bash"}

# Bash commands to skip (trivial operations)
SKIP_BASH_PREFIXES = [
    "ls", "cd", "pwd", "echo", "cat ", "head ", "tail ",
    "which", "type", "file ", "stat ", "wc ",
]

# Bash commands that ALWAYS capture (significant operations)
CAPTURE_BASH_KEYWORDS = [
    "mentu", "npm", "npx", "node", "python",
    "git commit", "git push", "git merge",
    "build", "test", "deploy", "install",
]


def should_capture(tool_name: str, tool_input: dict) -> bool:
    """Determine if this operation should be captured as evidence."""
    if tool_name not in EVIDENCE_TOOLS:
        return False

    if tool_name == "Bash":
        command = tool_input.get("command", "").strip()

        # Skip trivial commands
        if any(command.startswith(p) for p in SKIP_BASH_PREFIXES):
            return False

        # Capture significant commands
        if any(kw in command.lower() for kw in CAPTURE_BASH_KEYWORDS):
            return True

        # Skip other bash commands by default
        return False

    # Edit and Write always captured
    return True


def format_evidence_body(tool_name: str, tool_input: dict) -> str:
    """Format evidence body for this tool operation."""
    timestamp = datetime.utcnow().strftime("%H:%M:%S")

    if tool_name == "Edit":
        file_path = tool_input.get("file_path", "unknown")
        # Get just the filename
        filename = file_path.split("/")[-1] if "/" in file_path else file_path
        return f"[{timestamp}] Edited: {filename}"

    elif tool_name == "Write":
        file_path = tool_input.get("file_path", "unknown")
        filename = file_path.split("/")[-1] if "/" in file_path else file_path
        return f"[{timestamp}] Created: {filename}"

    elif tool_name == "Bash":
        command = tool_input.get("command", "")
        # Truncate long commands
        if len(command) > 80:
            command = command[:77] + "..."
        return f"[{timestamp}] Ran: {command}"

    return f"[{timestamp}] Tool: {tool_name}"


def capture_evidence(body: str) -> Optional[str]:
    """Capture evidence memory, return ID or None on failure."""
    actor = os.environ.get("MENTU_ACTOR", "agent:claude-code")

    try:
        result = subprocess.run(
            ["mentu", "capture", body, "--kind", "tool-evidence", "--actor", actor, "--json"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("id")
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        pass

    return None


def main():
    """Main entry point."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Check if we should capture this operation
    if should_capture(tool_name, tool_input):
        body = format_evidence_body(tool_name, tool_input)
        evidence_id = capture_evidence(body)

        if evidence_id:
            # Log success (visible in debug mode)
            sys.stderr.write(f"[Evidence] {evidence_id}: {body}\n")

    # Always return success (non-blocking)
    print(json.dumps({}))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Fail-safe: on error, allow tool execution to continue
        sys.stderr.write(f"PostToolUse evidence error: {e}\n")
        print(json.dumps({}))
        sys.exit(0)
