#!/usr/bin/env python3
"""
============================================================
GENESIS KEY SYNC: Local repos → Supabase workspaces
============================================================

This script syncs genesis.key files from local repository .mentu/ directories
to the Supabase workspaces.genesis_key column.

USAGE:
    python3 sync-genesis-keys.py [--dry-run]

REQUIREMENTS:
    - PyYAML: pip install pyyaml
    - requests: pip install requests

ENVIRONMENT:
    MENTU_API_URL       - Proxy URL (default: https://mentu-proxy.affihub.workers.dev)
    MENTU_PROXY_TOKEN   - API authentication token
    WORKSPACES_ROOT     - Path to Workspaces directory (default: /Users/rashid/Desktop/Workspaces)

WHAT IT DOES:
    1. Scans WORKSPACES_ROOT for directories with .mentu/genesis.key
    2. Converts each YAML genesis.key to JSON
    3. UPSERTs to Supabase: workspaces.genesis_key WHERE name = {repo_name}

THE GENESIS.KEY CONTAINS:
    - identity: workspace name, owner, description
    - constitution: principles governing the workspace
    - permissions: actor roles and allowed operations
    - trust_gradient: author type constraints (architect/auditor/executor)
    - constraints: claim requirements
    - federation: cross-workspace settings
    - lineage: parent/child relationships
"""

import os
import sys
import json
import yaml
import requests
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================

API_URL = os.environ.get('MENTU_API_URL', 'https://mentu-proxy.affihub.workers.dev')
API_TOKEN = os.environ.get('MENTU_PROXY_TOKEN', '')
WORKSPACES_ROOT = os.environ.get('WORKSPACES_ROOT', '/Users/rashid/Desktop/Workspaces')

# Repos to sync (those with .mentu/genesis.key)
# Comment out repos you don't want to sync
REPOS_TO_SYNC = [
    'claude-code',      # Capability registry and coordination tools
    'mentu-ai',         # Core ledger, CLI, temporal primitives
    'mentu-bridge',     # Mac daemon for local execution
    'mentu-proxy',      # Cloudflare Worker gateway
    'mentu-web',        # Next.js dashboard
    # 'talisman',       # Uncomment when genesis.key exists
    # 'projects/xxx',   # Add nested repos as needed
]

# ============================================================
# SYNC LOGIC
# ============================================================

def load_genesis_key(repo_path: Path) -> dict | None:
    """
    Load and parse genesis.key YAML file from a repository.

    Args:
        repo_path: Path to the repository root

    Returns:
        Parsed genesis.key as dict, or None if not found
    """
    genesis_path = repo_path / '.mentu' / 'genesis.key'

    if not genesis_path.exists():
        print(f"  ⚠ No genesis.key found at {genesis_path}")
        return None

    try:
        with open(genesis_path, 'r') as f:
            data = yaml.safe_load(f)
        return data
    except Exception as e:
        print(f"  ✗ Error parsing {genesis_path}: {e}")
        return None


def upsert_workspace(name: str, genesis_key: dict, dry_run: bool = False) -> bool:
    """
    Upsert workspace with genesis_key to Supabase.

    Creates workspace if it doesn't exist, updates genesis_key if it does.

    Args:
        name: Workspace name (matches repo directory name)
        genesis_key: Full genesis.key as dict
        dry_run: If True, don't actually make the request

    Returns:
        True if successful, False otherwise
    """
    if not API_TOKEN:
        print("  ✗ MENTU_PROXY_TOKEN not set")
        return False

    # Extract display_name from genesis.key identity
    display_name = genesis_key.get('identity', {}).get('name', name)

    if dry_run:
        print(f"  [DRY RUN] Would upsert: {name} -> {display_name}")
        return True

    # Use PostgREST upsert via proxy
    # ON CONFLICT (name) DO UPDATE SET genesis_key = ...
    url = f"{API_URL}/rest/v1/workspaces"

    headers = {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
    }

    payload = {
        'name': name,
        'display_name': display_name,
        'genesis_key': genesis_key
    }

    try:
        response = requests.post(url, headers=headers, json=payload)

        if response.status_code in (200, 201):
            result = response.json()
            workspace_id = result[0]['id'] if result else 'unknown'
            print(f"  ✓ Synced: {name} (id: {workspace_id})")
            return True
        else:
            print(f"  ✗ Failed: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        print(f"  ✗ Request error: {e}")
        return False


def sync_all(dry_run: bool = False):
    """
    Sync all configured repos' genesis.key files to Supabase.
    """
    print("=" * 60)
    print("GENESIS KEY SYNC: Local repos → Supabase")
    print("=" * 60)
    print(f"Workspaces root: {WORKSPACES_ROOT}")
    print(f"API URL: {API_URL}")
    print(f"Dry run: {dry_run}")
    print("-" * 60)

    root = Path(WORKSPACES_ROOT)
    success_count = 0
    fail_count = 0

    for repo_name in REPOS_TO_SYNC:
        repo_path = root / repo_name
        print(f"\n[{repo_name}]")

        if not repo_path.exists():
            print(f"  ⚠ Repository not found: {repo_path}")
            fail_count += 1
            continue

        genesis_key = load_genesis_key(repo_path)

        if genesis_key is None:
            fail_count += 1
            continue

        # Validate required fields
        if 'identity' not in genesis_key:
            print(f"  ⚠ genesis.key missing 'identity' section")
            fail_count += 1
            continue

        if upsert_workspace(repo_name, genesis_key, dry_run):
            success_count += 1
        else:
            fail_count += 1

    print("\n" + "=" * 60)
    print(f"COMPLETE: {success_count} synced, {fail_count} failed")
    print("=" * 60)

    return fail_count == 0


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv

    if not API_TOKEN:
        print("ERROR: MENTU_PROXY_TOKEN environment variable required")
        print("  export MENTU_PROXY_TOKEN='your-token-here'")
        sys.exit(1)

    success = sync_all(dry_run)
    sys.exit(0 if success else 1)
