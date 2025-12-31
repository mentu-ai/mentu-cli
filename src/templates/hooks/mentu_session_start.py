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
from typing import List, Dict


def get_claimed_commitments() -> List[Dict]:
    """Get commitments claimed by this agent."""
    actor = os.environ.get("MENTU_ACTOR", "agent:claude-code")

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
    claimed = get_claimed_commitments()

    if not claimed:
        # No commitments = no context to inject
        print(json.dumps({}))
        sys.exit(0)

    # Format for injection
    context = "## Active Mentu Commitments\n\n"
    context += "You have claimed the following commitments. "
    context += "You MUST submit each before stopping.\n\n"

    for cmt in claimed:
        context += f"- `{cmt['id']}`: {cmt['body']}\n"

    context += "\nUse `mentu submit <id> --summary '...'` when complete."

    print(json.dumps({
        "context": context
    }))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write(f"SessionStart hook error: {e}\n")
        print(json.dumps({}))
        sys.exit(0)
