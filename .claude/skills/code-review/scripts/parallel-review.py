#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
Parallel Code Review Runner

Runs 4 review agents in parallel using ThreadPoolExecutor.
Each agent focuses on a specific domain:
  1. Guidelines - CLAUDE.md compliance
  2. Security - OWASP top 10, injection, secrets
  3. Bugs - Logic errors, null handling, race conditions
  4. Context - Git history, regression risk

Returns aggregated results with confidence scoring.

Usage:
  python3 parallel-review.py <files...>
  echo '{"files": [...]}' | python3 parallel-review.py

Output:
  JSON with verdict, findings, and agent results
"""

import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# Confidence thresholds
THRESHOLDS = {
    "guidelines": 80,
    "security": 80,
    "bugs": 80,
    "context": 70
}

# Security patterns with confidence scores
SECURITY_PATTERNS = [
    # SQL Injection
    (r"db\.(query|execute)\s*\(\s*[`'\"].*\$\{", "sql_injection", 95),
    (r"SELECT.*FROM.*WHERE.*\+\s*\w+", "sql_injection", 90),
    (r"\.query\s*\([^,]+\+", "sql_injection", 88),

    # Command Injection
    (r"exec\s*\(\s*[`'\"].*\$\{", "command_injection", 95),
    (r"execSync\s*\(\s*[`'\"].*\$\{", "command_injection", 95),
    (r"child_process\.exec\s*\(\s*[^,]+\+", "command_injection", 90),

    # Hardcoded Secrets
    (r"password\s*[=:]\s*['\"][^'\"]{8,}['\"]", "hardcoded_password", 92),
    (r"api[_-]?key\s*[=:]\s*['\"][^'\"]{16,}['\"]", "hardcoded_api_key", 95),
    (r"secret\s*[=:]\s*['\"][^'\"]{8,}['\"]", "hardcoded_secret", 90),
    (r"token\s*[=:]\s*['\"][^'\"]{16,}['\"]", "hardcoded_token", 88),
    (r"Bearer\s+[A-Za-z0-9_-]{20,}", "hardcoded_bearer", 92),

    # XSS
    (r"dangerouslySetInnerHTML\s*=", "potential_xss", 85),
    (r"innerHTML\s*=\s*[^;]*\w+", "potential_xss", 80),

    # Path Traversal
    (r"readFile\s*\([^)]*\+", "path_traversal", 82),
    (r"writeFile\s*\([^)]*\+", "path_traversal", 82),

    # Eval
    (r"\beval\s*\(", "eval_usage", 88),
    (r"new\s+Function\s*\(", "function_constructor", 85),
]

# Bug patterns with confidence scores
BUG_PATTERNS = [
    # Off-by-one
    (r"for\s*\([^;]*;\s*\w+\s*<=\s*\w+\.length", "off_by_one", 92),
    (r"\[(\w+)\.length\]", "array_bounds", 90),

    # Null/undefined
    (r"\.(\w+)\.(\w+)\s*(?!\?\.)(?![^=]*=)", "potential_null_access", 75),

    # Floating promises
    (r"^\s*\w+\s*\.\s*then\s*\(", "floating_promise", 78),
    (r"(?<!await\s)fetch\s*\(", "unawait_fetch", 72),

    # Type coercion
    (r"==\s*['\"]", "type_coercion", 70),
    (r"==\s*null", "null_coercion", 65),
]


def run_command(cmd: List[str], timeout: int = 30) -> Tuple[bool, str, str]:
    """Run command, return (success, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout, result.stderr
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return False, "", str(e)


def read_file_safe(path: str) -> Optional[str]:
    """Read file content safely."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except (IOError, UnicodeDecodeError):
        return None


def get_claude_md_content() -> str:
    """Get content of all relevant CLAUDE.md files."""
    content = ""
    for root, _, files in os.walk("."):
        if "CLAUDE.md" in files:
            file_content = read_file_safe(os.path.join(root, "CLAUDE.md"))
            if file_content:
                content += f"\n--- {root}/CLAUDE.md ---\n{file_content}"
    return content


def review_guidelines(files: List[str]) -> Dict[str, Any]:
    """Review files for CLAUDE.md compliance."""
    findings = []
    claude_md = get_claude_md_content()

    # Extract naming patterns from CLAUDE.md
    naming_rules = []
    if "camelCase" in claude_md:
        naming_rules.append("camelCase")
    if "PascalCase" in claude_md:
        naming_rules.append("PascalCase")

    for file_path in files:
        content = read_file_safe(file_path)
        if not content:
            continue

        # Check for any patterns
        if "any" in content.lower():
            matches = re.findall(r":\s*any\b", content)
            if len(matches) > 3:
                findings.append({
                    "file": file_path,
                    "type": "excessive_any_type",
                    "confidence": 75,
                    "severity": "medium",
                    "message": f"Found {len(matches)} uses of 'any' type"
                })

        # Check for console.log in non-test files
        if "test" not in file_path.lower() and "spec" not in file_path.lower():
            if "console.log" in content:
                count = content.count("console.log")
                if count > 2:
                    findings.append({
                        "file": file_path,
                        "type": "console_log",
                        "confidence": 70,
                        "severity": "low",
                        "message": f"Found {count} console.log statements"
                    })

    # Filter by threshold
    filtered = [f for f in findings if f["confidence"] >= THRESHOLDS["guidelines"]]
    verdict = "FAIL" if any(f["severity"] in ("high", "critical") for f in filtered) else "PASS"

    return {
        "agent": "guidelines",
        "verdict": verdict,
        "findings": filtered,
        "filtered_count": len(findings) - len(filtered),
        "summary": f"Found {len(filtered)} guideline issues"
    }


def review_security(files: List[str]) -> Dict[str, Any]:
    """Review files for security vulnerabilities."""
    findings = []

    for file_path in files:
        content = read_file_safe(file_path)
        if not content:
            continue

        # Skip test files
        if "test" in file_path.lower() or "spec" in file_path.lower() or "mock" in file_path.lower():
            continue

        for line_num, line in enumerate(content.split("\n"), 1):
            for pattern, issue_type, confidence in SECURITY_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append({
                        "file": file_path,
                        "line": line_num,
                        "type": issue_type,
                        "confidence": confidence,
                        "severity": "critical" if confidence >= 90 else "high",
                        "code": line.strip()[:100],
                        "message": f"Potential {issue_type.replace('_', ' ')}"
                    })

    # Filter by threshold
    filtered = [f for f in findings if f["confidence"] >= THRESHOLDS["security"]]
    verdict = "FAIL" if filtered else "PASS"

    return {
        "agent": "security",
        "verdict": verdict,
        "findings": filtered,
        "filtered_count": len(findings) - len(filtered),
        "summary": f"Found {len(filtered)} security issues"
    }


def review_bugs(files: List[str]) -> Dict[str, Any]:
    """Review files for bugs and correctness issues."""
    findings = []

    for file_path in files:
        content = read_file_safe(file_path)
        if not content:
            continue

        for line_num, line in enumerate(content.split("\n"), 1):
            for pattern, issue_type, confidence in BUG_PATTERNS:
                if re.search(pattern, line):
                    findings.append({
                        "file": file_path,
                        "line": line_num,
                        "type": issue_type,
                        "confidence": confidence,
                        "severity": "high" if confidence >= 85 else "medium",
                        "code": line.strip()[:100],
                        "message": f"Potential {issue_type.replace('_', ' ')}"
                    })

    # Filter by threshold
    filtered = [f for f in findings if f["confidence"] >= THRESHOLDS["bugs"]]
    verdict = "FAIL" if any(f["severity"] == "high" for f in filtered) else "PASS"

    return {
        "agent": "bugs",
        "verdict": verdict,
        "findings": filtered,
        "filtered_count": len(findings) - len(filtered),
        "summary": f"Found {len(filtered)} potential bugs"
    }


def review_context(files: List[str]) -> Dict[str, Any]:
    """Review git history for regression risks."""
    findings = []

    # Get recently fixed files (within 30 days)
    ok, stdout, _ = run_command([
        "git", "log", "--oneline", "--since=30 days ago", "--name-only",
        "--format=COMMIT:%s"
    ])

    recent_fixes = set()
    if ok:
        for line in stdout.split("\n"):
            if line.startswith("COMMIT:") and any(word in line.lower() for word in ["fix", "bug", "issue", "hotfix"]):
                # Next non-empty lines are files
                continue
            elif line.strip() and not line.startswith("COMMIT:"):
                recent_fixes.add(line.strip())

    # Get hotspots (frequently changed files)
    ok, stdout, _ = run_command([
        "git", "log", "--format=format:", "--name-only", "--since=90 days ago"
    ])

    hotspots = {}
    if ok:
        for line in stdout.split("\n"):
            if line.strip():
                hotspots[line.strip()] = hotspots.get(line.strip(), 0) + 1

    top_hotspots = {f for f, count in sorted(hotspots.items(), key=lambda x: -x[1])[:10]}

    for file_path in files:
        if file_path in recent_fixes:
            findings.append({
                "file": file_path,
                "type": "recently_fixed",
                "confidence": 85,
                "severity": "medium",
                "message": "File was fixed within last 30 days - check for regression"
            })

        if file_path in top_hotspots:
            findings.append({
                "file": file_path,
                "type": "hotspot",
                "confidence": 75,
                "severity": "low",
                "message": f"File is a hotspot ({hotspots.get(file_path, 0)} changes in 90 days)"
            })

    # Filter by threshold
    filtered = [f for f in findings if f["confidence"] >= THRESHOLDS["context"]]
    verdict = "PASS"  # Context never fails, only advises

    return {
        "agent": "context",
        "verdict": verdict,
        "findings": filtered,
        "filtered_count": len(findings) - len(filtered),
        "summary": f"Found {len(filtered)} context notes"
    }


def run_parallel_review(files: List[str]) -> Dict[str, Any]:
    """Run all 4 review agents in parallel."""
    agents = {
        "guidelines": review_guidelines,
        "security": review_security,
        "bugs": review_bugs,
        "context": review_context
    }

    results = {}
    all_findings = []

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(func, files): name
            for name, func in agents.items()
        }

        for future in as_completed(futures):
            name = futures[future]
            try:
                result = future.result()
                results[name] = result
                all_findings.extend(result.get("findings", []))
            except Exception as e:
                results[name] = {
                    "agent": name,
                    "verdict": "ERROR",
                    "findings": [],
                    "summary": str(e)
                }

    # Determine overall verdict
    verdicts = [r.get("verdict") for r in results.values()]
    if "FAIL" in verdicts:
        overall = "FAIL"
    elif "ERROR" in verdicts:
        overall = "ERROR"
    else:
        overall = "PASS"

    total_filtered = sum(r.get("filtered_count", 0) for r in results.values())

    return {
        "verdict": overall,
        "files_reviewed": len(files),
        "findings": all_findings,
        "agents": {
            name: {
                "verdict": r.get("verdict"),
                "findings": len(r.get("findings", [])),
                "filtered": r.get("filtered_count", 0)
            }
            for name, r in results.items()
        },
        "stats": {
            "issues_found": len(all_findings),
            "issues_filtered": total_filtered,
            "thresholds": THRESHOLDS
        }
    }


def main():
    """Main entry point."""
    # Get files from args or stdin
    files = []

    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        try:
            data = json.load(sys.stdin)
            files = data.get("files", [])
        except json.JSONDecodeError:
            pass

    if not files:
        # Default to git diff
        ok, stdout, _ = run_command(["git", "diff", "--name-only", "HEAD~1"])
        if not ok:
            ok, stdout, _ = run_command(["git", "diff", "--name-only", "origin/main...HEAD"])

        if ok and stdout.strip():
            files = stdout.strip().split("\n")

    if not files:
        print(json.dumps({
            "verdict": "PASS",
            "files_reviewed": 0,
            "findings": [],
            "agents": {},
            "stats": {"issues_found": 0, "issues_filtered": 0}
        }))
        sys.exit(0)

    # Filter to existing files
    files = [f for f in files if os.path.exists(f)]

    result = run_parallel_review(files)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
