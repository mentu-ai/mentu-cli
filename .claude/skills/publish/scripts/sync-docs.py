#!/usr/bin/env python3
"""
============================================================
DOCUMENT SYNC: Local workspace files → Supabase publications
============================================================

This script syncs documentation files from local workspace directories
to Supabase as publications. Intended to run as part of `mentu sync`.

USAGE:
    python3 sync-docs.py [--dry-run] [--workspace <name>]

REQUIREMENTS:
    - requests: pip install requests
    - hashlib (standard library)

ENVIRONMENT:
    MENTU_API_URL       - Proxy URL (default: https://mentu-proxy.affihub.workers.dev)
    MENTU_PROXY_TOKEN   - API authentication token
    WORKSPACES_ROOT     - Path to Workspaces directory (default: /Users/rashid/Desktop/Workspaces)

WHAT IT SYNCS:
    For each workspace (repo with .mentu/):
    1. README.md         → docs/readme
    2. CLAUDE.md         → docs/claude
    3. docs/*.md         → docs/{filename}
    4. .mentu/manifest.yaml → docs/mentu/manifest (as code block)
    5. .mentu/genesis.key   → docs/mentu/genesis (as code block)

VERSION DETECTION:
    - Computes SHA-256 hash of file content
    - Compares with stored hash in Supabase
    - Only publishes if content changed
    - Increments version number on changes
"""

import os
import sys
import json
import hashlib
import requests
from pathlib import Path
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================

API_URL = os.environ.get('MENTU_API_URL', 'https://mentu-proxy.affihub.workers.dev')
API_TOKEN = os.environ.get('MENTU_PROXY_TOKEN', '')
WORKSPACES_ROOT = os.environ.get('WORKSPACES_ROOT', '/Users/rashid/Desktop/Workspaces')

# Files to sync for each workspace
DOC_PATTERNS = [
    ('README.md', 'docs', 'readme'),
    ('CLAUDE.md', 'docs', 'claude'),
    # Future: Add more patterns
    # ('docs/*.md', 'docs', None),  # Use filename as path
]

# Repos to sync (those with .mentu/)
REPOS_TO_SYNC = [
    'claude-code',
    'mentu-ai',
    'mentu-bridge',
    'mentu-proxy',
    'mentu-web',
]

# ============================================================
# UTILITIES
# ============================================================

def compute_hash(content: str) -> str:
    """Compute SHA-256 hash of content."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]


def generate_id(prefix: str = 'pub') -> str:
    """Generate a random ID."""
    import random
    import string
    chars = string.ascii_lowercase + string.digits
    return f"{prefix}_{''.join(random.choices(chars, k=8))}"


# ============================================================
# SUPABASE OPERATIONS
# ============================================================

def get_workspace(name: str) -> dict | None:
    """Fetch workspace by name."""
    if not API_TOKEN:
        return None

    url = f"{API_URL}/rest/v1/workspaces"
    params = {'name': f'eq.{name}', 'select': 'id,name,display_name'}
    headers = {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
    }

    try:
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            rows = response.json()
            return rows[0] if rows else None
    except Exception as e:
        print(f"  Error fetching workspace: {e}")

    return None


def get_existing_publication(workspace_id: str, module: str, path: str) -> dict | None:
    """Check if a publication already exists."""
    if not API_TOKEN:
        return None

    url = f"{API_URL}/rest/v1/publications_with_owner"
    params = {
        'workspace_id': f'eq.{workspace_id}',
        'module': f'eq.{module}',
        'path': f'eq.{path}',
        'select': 'publication_id,version,content',
        'order': 'version.desc',
        'limit': '1'
    }
    headers = {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
    }

    try:
        response = requests.get(url, params=params, headers=headers)
        if response.status_code == 200:
            rows = response.json()
            return rows[0] if rows else None
    except Exception as e:
        print(f"  Error checking existing publication: {e}")

    return None


def publish_document(workspace_id: str, workspace_name: str, module: str, path: str,
                    content: str, version: int, dry_run: bool = False) -> bool:
    """Publish a document to Supabase."""
    if not API_TOKEN:
        print("  Error: MENTU_PROXY_TOKEN not set")
        return False

    pub_id = generate_id('pub')
    op_id = generate_id('op')

    if dry_run:
        print(f"  [DRY RUN] Would publish: {module}/{path} v{version}")
        return True

    url = f"{API_URL}/rest/v1/operations"
    headers = {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

    payload = {
        'id': op_id,
        'workspace_id': workspace_id,
        'op': 'publish',
        'ts': datetime.utcnow().isoformat() + 'Z',
        'actor': 'agent:doc-sync',
        'payload': {
            'id': pub_id,
            'module': module,
            'path': path,
            'version': version,
            'url': f"{workspace_name}/{module}/{path}",
            'content': content,
            'content_hash': compute_hash(content)
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code in (200, 201):
            print(f"  Published: {module}/{path} v{version}")
            return True
        else:
            print(f"  Failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  Request error: {e}")
        return False


# ============================================================
# SYNC LOGIC
# ============================================================

def sync_file(repo_path: Path, workspace_id: str, workspace_name: str,
              filename: str, module: str, path: str, dry_run: bool = False) -> tuple[bool, str]:
    """
    Sync a single file to Supabase.

    Returns:
        (success, status) where status is 'published', 'unchanged', or 'error'
    """
    file_path = repo_path / filename

    if not file_path.exists():
        return (True, 'missing')

    try:
        content = file_path.read_text()
    except Exception as e:
        print(f"  Error reading {filename}: {e}")
        return (False, 'error')

    # Check existing publication
    existing = get_existing_publication(workspace_id, module, path)

    if existing:
        # Compare content hashes
        existing_hash = compute_hash(existing.get('content', ''))
        new_hash = compute_hash(content)

        if existing_hash == new_hash:
            return (True, 'unchanged')

        # Content changed - increment version
        version = existing.get('version', 0) + 1
    else:
        version = 1

    # Publish
    success = publish_document(workspace_id, workspace_name, module, path, content, version, dry_run)
    return (success, 'published' if success else 'error')


def sync_workspace(repo_name: str, dry_run: bool = False) -> dict:
    """
    Sync all documents for a single workspace.

    Returns:
        Stats dict with counts
    """
    stats = {'published': 0, 'unchanged': 0, 'missing': 0, 'error': 0}

    repo_path = Path(WORKSPACES_ROOT) / repo_name
    print(f"\n[{repo_name}]")

    if not repo_path.exists():
        print(f"  Repository not found: {repo_path}")
        stats['error'] += 1
        return stats

    # Check for .mentu/ directory
    if not (repo_path / '.mentu').exists():
        print(f"  No .mentu/ directory - skipping")
        return stats

    # Get workspace from Supabase
    workspace = get_workspace(repo_name)
    if not workspace:
        print(f"  Workspace not found in Supabase - skipping")
        stats['error'] += 1
        return stats

    workspace_id = workspace['id']
    workspace_name = workspace['name']

    # Sync each document pattern
    for filename, module, path in DOC_PATTERNS:
        success, status = sync_file(repo_path, workspace_id, workspace_name,
                                    filename, module, path, dry_run)
        stats[status] = stats.get(status, 0) + 1

    return stats


def sync_all(dry_run: bool = False, single_workspace: str = None):
    """
    Sync all configured workspaces.
    """
    print("=" * 60)
    print("DOCUMENT SYNC: Local files → Supabase publications")
    print("=" * 60)
    print(f"Workspaces root: {WORKSPACES_ROOT}")
    print(f"API URL: {API_URL}")
    print(f"Dry run: {dry_run}")
    print("-" * 60)

    total_stats = {'published': 0, 'unchanged': 0, 'missing': 0, 'error': 0}

    repos = [single_workspace] if single_workspace else REPOS_TO_SYNC

    for repo_name in repos:
        stats = sync_workspace(repo_name, dry_run)
        for key, value in stats.items():
            total_stats[key] = total_stats.get(key, 0) + value

    print("\n" + "=" * 60)
    print(f"COMPLETE: {total_stats['published']} published, "
          f"{total_stats['unchanged']} unchanged, "
          f"{total_stats['missing']} missing, "
          f"{total_stats['error']} errors")
    print("=" * 60)

    return total_stats['error'] == 0


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv

    # Check for --workspace flag
    single_workspace = None
    if '--workspace' in sys.argv:
        idx = sys.argv.index('--workspace')
        if idx + 1 < len(sys.argv):
            single_workspace = sys.argv[idx + 1]

    if not API_TOKEN:
        print("ERROR: MENTU_PROXY_TOKEN environment variable required")
        print("  export MENTU_PROXY_TOKEN='your-token-here'")
        sys.exit(1)

    success = sync_all(dry_run, single_workspace)
    sys.exit(0 if success else 1)
