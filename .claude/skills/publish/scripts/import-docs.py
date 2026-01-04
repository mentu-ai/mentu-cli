#!/usr/bin/env python3
"""
============================================================
DOCS IMPORT: Parse frontmatter and publish to Supabase
============================================================

Scans mentu-ai/docs/ for all .md files, parses YAML frontmatter,
categorizes into docs/evidence/artifacts/assets, and publishes
to Supabase with full metadata.

USAGE:
    python3 import-docs.py [--dry-run] [--limit N]

CATEGORIZATION RULES:
    - type: prd, handoff, prompt, intent, spec, directive → docs
    - type: result, audit, trace → evidence
    - type: schema, config → artifacts
    - essays, research, roadmaps → docs
    - Default → docs
"""

import os
import sys
import re
import json
import yaml
import hashlib
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

# ============================================================
# CONFIGURATION
# ============================================================

API_URL = os.environ.get('MENTU_API_URL', 'https://mentu-proxy.affihub.workers.dev')
API_TOKEN = os.environ.get('MENTU_PROXY_TOKEN', '')
DOCS_ROOT = Path('/Users/rashid/Desktop/Workspaces/mentu-ai/docs')
WORKSPACE_ID = '9584ae30-14f5-448a-9ff1-5a6f5caf6312'  # mentu-ai workspace
WORKSPACE_NAME = 'mentu-ai'

# Type to module mapping (from Canonical-Front-Matter-Spec.md)
TYPE_TO_MODULE = {
    # Documentation types
    'prd': 'docs',
    'handoff': 'docs',
    'prompt': 'docs',
    'intent': 'docs',
    'spec': 'docs',
    'specification': 'docs',  # alias for spec
    'directive': 'docs',
    'roadmap': 'docs',
    'essay': 'docs',
    'reference': 'docs',
    'context': 'docs',
    'delegation': 'docs',

    # Evidence types
    'result': 'evidence',
    'audit': 'evidence',
    'trace': 'evidence',
    'review': 'evidence',

    # Artifact types
    'schema': 'artifacts',
    'config': 'artifacts',
    'template': 'artifacts',

    # Default
    'default': 'docs'
}

# ============================================================
# FRONTMATTER PARSING
# ============================================================

def parse_frontmatter(content: str) -> Tuple[Dict[str, Any], str]:
    """
    Parse YAML frontmatter from markdown content.

    Returns:
        (metadata dict, body content)
    """
    # Check for frontmatter delimiter
    if not content.startswith('---'):
        return {}, content

    # Find closing delimiter
    end_match = re.search(r'\n---\s*\n', content[3:])
    if not end_match:
        return {}, content

    frontmatter_end = end_match.end() + 3
    frontmatter_str = content[3:end_match.start() + 3]
    body = content[frontmatter_end:]

    try:
        # Parse YAML, handling comments
        metadata = yaml.safe_load(frontmatter_str) or {}
        return metadata, body
    except yaml.YAMLError as e:
        print(f"  Warning: Failed to parse frontmatter: {e}")
        return {}, content


def infer_type_from_filename(filename: str) -> str:
    """Infer document type from filename prefix."""
    name = filename.upper()

    if name.startswith('PRD-'):
        return 'prd'
    elif name.startswith('HANDOFF-'):
        return 'handoff'
    elif name.startswith('PROMPT-'):
        return 'prompt'
    elif name.startswith('RESULT-'):
        return 'result'
    elif name.startswith('AUDIT-'):
        return 'audit'
    elif name.startswith('INTENT-'):
        return 'intent'
    elif name.startswith('SPEC-'):
        return 'spec'
    elif name.startswith('DIRECTIVE-'):
        return 'directive'
    elif name.startswith('TRACE-'):
        return 'trace'
    elif name.startswith('ROADMAP-'):
        return 'roadmap'
    else:
        return 'default'


def get_module_for_type(doc_type: str) -> str:
    """Get the publication module for a document type."""
    return TYPE_TO_MODULE.get(doc_type, TYPE_TO_MODULE['default'])


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
# PATH UTILITIES
# ============================================================

def get_publication_path(file_path: Path, doc_type: str) -> str:
    """
    Convert file path to publication path using document type (not directory structure).

    Path format: {doc_type}/{clean_filename}

    Examples:
        PRD-DocsPlatform-v1.0.md (type=prd) → prd/docsplatform-v1.0
        research/01-technical-findings.md (type=reference) → reference/01-technical-findings
        archive/PRD-Intelligence-Layer-v2.0.md (type=prd) → prd/intelligence-layer-v2.0

    Directory structure is IGNORED - only doc_type and filename matter.
    """
    # Get just the filename, ignore directory
    filename = file_path.stem  # Remove .md extension

    # Convert to lowercase with hyphens
    filename = filename.lower().replace('_', '-')

    # Strip type prefix from filename if present (avoid duplication)
    prefixes = ['prd-', 'handoff-', 'prompt-', 'result-', 'audit-', 'intent-',
                'spec-', 'directive-', 'trace-', 'roadmap-', 'context-',
                'delegation-', 'template-']

    for prefix in prefixes:
        if filename.startswith(prefix):
            filename = filename[len(prefix):]
            break

    # Use doc_type as the category, handle 'default' case
    category = doc_type if doc_type != 'default' else 'misc'

    return f"{category}/{filename}"


# ============================================================
# SUPABASE OPERATIONS
# ============================================================

def get_existing_publication(module: str, path: str) -> Optional[Dict]:
    """Check if a publication already exists."""
    if not API_TOKEN:
        return None

    url = f"{API_URL}/rest/v1/publications_with_owner"
    params = {
        'workspace_id': f'eq.{WORKSPACE_ID}',
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
        print(f"  Error checking existing: {e}")

    return None


def publish_document(module: str, path: str, content: str, metadata: Dict,
                    version: int, dry_run: bool = False) -> bool:
    """Publish a document to Supabase with metadata."""
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

    # Build payload with metadata
    payload = {
        'id': op_id,
        'workspace_id': WORKSPACE_ID,
        'op': 'publish',
        'ts': datetime.utcnow().isoformat() + 'Z',
        'actor': 'agent:doc-import',
        'payload': {
            'id': pub_id,
            'module': module,
            'path': path,
            'version': version,
            'url': f"{WORKSPACE_NAME}/{module}/{path}",
            'content': content,
            'content_hash': compute_hash(content),
            # Metadata from frontmatter
            'metadata': {
                'doc_id': metadata.get('id'),
                'doc_type': metadata.get('type'),
                'doc_version': metadata.get('version'),
                'tier': metadata.get('tier'),
                'author_type': metadata.get('author_type'),
                'intent': metadata.get('intent'),
                'created': str(metadata.get('created')) if metadata.get('created') else None,
                'last_updated': str(metadata.get('last_updated')) if metadata.get('last_updated') else None,
                'parent': metadata.get('parent'),
                'children': metadata.get('children'),
                'dependencies': metadata.get('dependencies'),
                'commitment': metadata.get('mentu', {}).get('commitment') if isinstance(metadata.get('mentu'), dict) else None,
                'status': metadata.get('mentu', {}).get('status') if isinstance(metadata.get('mentu'), dict) else None,
            }
        }
    }

    # Remove None values from metadata
    payload['payload']['metadata'] = {k: v for k, v in payload['payload']['metadata'].items() if v is not None}

    try:
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code in (200, 201):
            return True
        else:
            print(f"  Failed: {response.status_code} - {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  Request error: {e}")
        return False


# ============================================================
# MAIN IMPORT LOGIC
# ============================================================

def process_file(file_path: Path, dry_run: bool = False) -> Tuple[bool, str]:
    """
    Process a single markdown file.

    Returns:
        (success, status) where status is 'published', 'unchanged', 'skipped', 'error'
    """
    try:
        content = file_path.read_text()
    except Exception as e:
        print(f"  Error reading: {e}")
        return (False, 'error')

    # Parse frontmatter
    metadata, body = parse_frontmatter(content)

    # Determine document type from frontmatter or filename
    doc_type = metadata.get('type')
    if not doc_type:
        doc_type = infer_type_from_filename(file_path.name)

    # Normalize type aliases
    if doc_type == 'specification':
        doc_type = 'spec'

    # Get module (docs, evidence, artifacts, assets)
    module = get_module_for_type(doc_type)

    # Get publication path using doc_type (not directory structure)
    pub_path = get_publication_path(file_path, doc_type)

    # Check for existing publication
    existing = get_existing_publication(module, pub_path)

    if existing:
        existing_hash = compute_hash(existing.get('content', ''))
        new_hash = compute_hash(body)  # Hash body only, not frontmatter

        if existing_hash == new_hash:
            return (True, 'unchanged')

        version = existing.get('version', 0) + 1
    else:
        version = 1

    # Publish body only (frontmatter is stored as metadata, not in content)
    success = publish_document(module, pub_path, body, metadata, version, dry_run)

    if success:
        print(f"  ✓ {module}/{pub_path} v{version} ({doc_type})")
        return (True, 'published')
    else:
        return (False, 'error')


def import_all(dry_run: bool = False, limit: int = None):
    """Import all markdown files from docs/"""
    print("=" * 70)
    print("DOCS IMPORT: mentu-ai/docs/ → Supabase publications")
    print("=" * 70)
    print(f"Docs root: {DOCS_ROOT}")
    print(f"Workspace: {WORKSPACE_NAME} ({WORKSPACE_ID})")
    print(f"Dry run: {dry_run}")
    if limit:
        print(f"Limit: {limit} files")
    print("-" * 70)

    # Collect all markdown files
    files = list(DOCS_ROOT.rglob('*.md'))
    files.sort()

    if limit:
        files = files[:limit]

    print(f"\nFound {len(files)} markdown files\n")

    stats = {'published': 0, 'unchanged': 0, 'skipped': 0, 'error': 0}

    for i, file_path in enumerate(files, 1):
        rel_path = file_path.relative_to(DOCS_ROOT)
        print(f"[{i}/{len(files)}] {rel_path}")

        success, status = process_file(file_path, dry_run)
        stats[status] = stats.get(status, 0) + 1

    print("\n" + "=" * 70)
    print(f"COMPLETE: {stats['published']} published, "
          f"{stats['unchanged']} unchanged, "
          f"{stats['skipped']} skipped, "
          f"{stats['error']} errors")
    print("=" * 70)

    return stats['error'] == 0


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv

    limit = None
    if '--limit' in sys.argv:
        idx = sys.argv.index('--limit')
        if idx + 1 < len(sys.argv):
            limit = int(sys.argv[idx + 1])

    if not API_TOKEN:
        print("ERROR: MENTU_PROXY_TOKEN environment variable required")
        print("  export MENTU_PROXY_TOKEN='your-token-here'")
        sys.exit(1)

    success = import_all(dry_run, limit)
    sys.exit(0 if success else 1)
