#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
SessionStart Hook: Inject commitment context into new sessions.

Agents start "warm" with full awareness of their current commitments.

HOOK EVENT: SessionStart
INPUT: {
  "session_id": "...",
  "source": "startup",
  "cwd": "...",
  "agent_type": "..." (optional, populated if --agent specified)
}
OUTPUT: {"hookSpecificOutput": {"additionalContext": "..."}}

This hook reads the MENTU_ACTOR environment variable and queries
the ledger for claimed commitments by this actor.

Agent Type Behavior:
- If agent_type is set, the hook adjusts context for subagent use
- Subagents get lighter context to preserve their token budget
"""

import json
import os
import subprocess
import sys
from typing import List, Tuple, Any


def run_mentu(args: List[str]) -> Tuple[bool, Any]:
    """Run mentu command, return (success, parsed_json)."""
    try:
        result = subprocess.run(
            ["mentu"] + args + ["--json"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            return False, None
        return True, json.loads(result.stdout)
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return False, None


def get_claimed_commitments(actor: str) -> List[dict]:
    """Get commitments claimed by this actor."""
    ok, data = run_mentu(["list", "commitments"])
    if not ok or not isinstance(data, list):
        return []

    return [
        c for c in data
        if c.get("owner") == actor and c.get("state") == "claimed"
    ]


def get_in_review_commitments(actor: str) -> List[dict]:
    """Get commitments in review by this actor."""
    ok, data = run_mentu(["list", "commitments"])
    if not ok or not isinstance(data, list):
        return []

    return [
        c for c in data
        if c.get("state") == "in_review"
        # Check if this actor submitted it (created_by or last actor on it)
    ]


def build_context(actor: str, claimed: List[dict], in_review: List[dict]) -> str:
    """Build context string for injection."""
    lines = [
        "## MENTU ACCOUNTABILITY MODE",
        "",
        f"**You are:** `{actor}`",
        ""
    ]

    if not claimed and not in_review:
        lines.extend([
            "**No active commitments.**",
            "",
            "To start work:",
            "```bash",
            f'mentu capture "Task description" --kind task --actor {actor}',
            f'mentu commit "What you will deliver" --source mem_XXX --actor {actor}',
            f'mentu claim cmt_XXX --actor {actor}',
            "```",
        ])
        return "\n".join(lines)

    if claimed:
        lines.append("### Active Commitments (claimed)")
        lines.append("")
        for cmt in claimed:
            lines.extend([
                f"**{cmt['id']}**: {cmt.get('body', 'No description')}",
                f"  - Source: `{cmt.get('source', 'unknown')}`",
                f"  - Tags: {', '.join(cmt.get('tags', [])) or 'none'}",
                ""
            ])

    if in_review:
        lines.append("### Pending Review")
        lines.append("")
        for cmt in in_review:
            lines.extend([
                f"**{cmt['id']}**: {cmt.get('body', 'No description')} (awaiting approval)",
                ""
            ])

    lines.extend([
        "### Completion Protocol",
        "",
        "1. Complete the work described above",
        "2. Stop hook will run validators (technical, safety, intent based on tier)",
        "3. Submit with evidence:",
        "   ```bash",
        "   mentu submit <cmt_id> --summary \"What was done\" --include-files",
        "   ```",
        "",
        "**Validators will be invoked based on commitment tier (tags determine tier).**",
    ])

    return "\n".join(lines)


def build_subagent_context(actor: str, agent_type: str, claimed: List[dict]) -> str:
    """Build lighter context for subagents to preserve token budget."""
    lines = [
        f"## MENTU (subagent: {agent_type})",
        "",
        f"**Actor:** `{actor}`",
    ]

    if claimed:
        # Only show IDs for subagents, not full details
        cmt_ids = ", ".join(c["id"] for c in claimed[:3])
        lines.append(f"**Active:** {cmt_ids}")

    return "\n".join(lines)


def main():
    """Main entry point."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    # Get actor identity
    actor = os.environ.get("MENTU_ACTOR", "agent:claude-code")

    # Check if running as subagent (new in Claude Code 2.1.2+)
    agent_type = input_data.get("agent_type")

    # Check if workspace exists
    if not os.path.exists(".mentu"):
        # No workspace, return minimal context
        output = {
            "hookSpecificOutput": {
                "additionalContext": f"## MENTU\n\n**Actor:** `{actor}`\n\n*No workspace initialized. Run `mentu init` to start tracking.*"
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    # Get commitments
    claimed = get_claimed_commitments(actor)
    in_review = get_in_review_commitments(actor)

    # Build context based on agent type
    if agent_type:
        # Subagent: lighter context to preserve tokens
        context = build_subagent_context(actor, agent_type, claimed)
    else:
        # Main agent: full context
        context = build_context(actor, claimed, in_review)

    output = {
        "hookSpecificOutput": {
            "additionalContext": context
        }
    }

    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Fail-safe: on error, return empty context
        sys.stderr.write(f"SessionStart hook error: {e}\n")
        print(json.dumps({}))
        sys.exit(0)
