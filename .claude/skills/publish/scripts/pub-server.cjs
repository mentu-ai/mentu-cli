const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

// Configuration
const LEDGER_PATH = process.argv[2] || '.mentu/ledger.jsonl';
const PORT = process.env.PUB_PORT || 3456;
const BASE_PATH = process.env.PUB_BASE_PATH || '';
const SOURCE = process.env.PUB_SOURCE || 'ledger'; // 'ledger' or 'supabase'
const API_URL = process.env.MENTU_API_URL || 'https://mentu-proxy.affihub.workers.dev';
const API_TOKEN = process.env.MENTU_PROXY_TOKEN || '';
const DEFAULT_WORKSPACE_ID = process.env.MENTU_WORKSPACE_ID || '';

// Cache for Supabase fetches (5 minute TTL)
const cache = {
  pubs: {},        // keyed by workspace_id
  pubsTime: {},    // keyed by workspace_id
  workspaces: {},  // keyed by workspace name/id
  workspacesTime: 0
};
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================
// PHASE 2: Workspace Resolution
// ============================================================

// Resolve workspace from request (subdomain, path, header, or default)
function resolveWorkspaceId(req) {
  // Option 1: From X-Workspace-ID header
  const headerWorkspace = req.headers['x-workspace-id'];
  if (headerWorkspace) return headerWorkspace;

  // Option 2: From X-Workspace-Token header (lookup by token)
  const workspaceToken = req.headers['x-workspace-token'];
  if (workspaceToken) return { token: workspaceToken };

  // Option 3: From subdomain (e.g., rashid.mentu.rashidazarang.com)
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];
  if (subdomain && subdomain !== 'mentu' && subdomain !== 'localhost' && !subdomain.match(/^\d+$/)) {
    return { name: subdomain };
  }

  // Option 4: From path (e.g., /{workspace}/docs/...)
  // New structure: /{workspace}/{view}/{path}
  const pathMatch = req.url.match(/^\/([^\/]+)\/(docs|evidence|artifacts|assets|claude|mentu)/);
  if (pathMatch && !['api', 'health', 'static'].includes(pathMatch[1])) {
    return { name: pathMatch[1] };
  }

  // Default: Use environment variable
  return DEFAULT_WORKSPACE_ID;
}

// Fetch workspace info by ID, name, or token
async function fetchWorkspace(identifier) {
  return new Promise((resolve, reject) => {
    let filter = '';
    if (typeof identifier === 'string') {
      // Direct UUID
      filter = `id=eq.${identifier}`;
    } else if (identifier.name) {
      filter = `name=eq.${identifier.name}`;
    } else if (identifier.token) {
      // Token-based lookup would need a different approach
      filter = `id=eq.${DEFAULT_WORKSPACE_ID}`;
    }

    const url = new URL(`${API_URL}/rest/v1/workspaces`);
    url.searchParams.set('select', 'id,name,display_name,genesis_key');
    url.searchParams.set(filter.split('=')[0], filter.split('=').slice(1).join('='));

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          resolve(rows[0] || null);
        } catch (err) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// Fetch all workspaces (for switcher)
async function fetchAllWorkspaces() {
  if (cache.workspaces.all && (Date.now() - cache.workspacesTime) < CACHE_TTL) {
    return cache.workspaces.all;
  }

  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/rest/v1/workspaces`);
    url.searchParams.set('select', 'id,name,display_name');
    url.searchParams.set('order', 'display_name.asc');

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          cache.workspaces.all = rows;
          cache.workspacesTime = Date.now();
          resolve(rows);
        } catch (err) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// Load from local ledger file
function loadFromLedger() {
  try {
    const ledger = fs.readFileSync(LEDGER_PATH, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => JSON.parse(l));

    const pubs = {};
    ledger.filter(op => op.op === 'publish').forEach(op => {
      const key = `/${op.payload.module}/${op.payload.path}`;
      pubs[key] = { ...op.payload, ts: op.ts, actor: op.actor };
    });
    return pubs;
  } catch (err) {
    console.error('Error reading ledger:', err.message);
    return {};
  }
}

// ============================================================
// PHASE 4: Analytics - Track publication views
// ============================================================

async function trackView(publicationId, workspaceId, req) {
  if (!publicationId || !workspaceId) return;

  const body = JSON.stringify({
    publication_id: publicationId,
    workspace_id: workspaceId,
    viewer_ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
    user_agent: req.headers['user-agent'] || null,
    referer: req.headers['referer'] || null
  });

  const url = new URL(`${API_URL}/rest/v1/publication_views`);
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'X-Proxy-Token': API_TOKEN,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  };

  const req2 = https.request(options);
  req2.on('error', () => {}); // Silent fail for analytics
  req2.write(body);
  req2.end();
}

// Fetch publication stats
async function fetchPublicationStats(workspaceId) {
  return new Promise((resolve) => {
    const url = new URL(`${API_URL}/rest/v1/publication_stats`);
    url.searchParams.set('select', '*');
    if (workspaceId) {
      url.searchParams.set('workspace_id', `eq.${workspaceId}`);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          const stats = {};
          rows.forEach(row => {
            stats[row.publication_id] = {
              view_count: parseInt(row.view_count) || 0,
              last_viewed_at: row.last_viewed_at
            };
          });
          resolve(stats);
        } catch (err) {
          resolve({});
        }
      });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

// ============================================================
// PHASE 4: Version History
// ============================================================

async function fetchVersionHistory(module, path, workspaceId) {
  return new Promise((resolve) => {
    // Fetch all versions of a publication by module+path
    const url = new URL(`${API_URL}/rest/v1/publications_with_owner`);
    url.searchParams.set('select', 'publication_id,version,published_at,actor');
    url.searchParams.set('module', `eq.${module}`);
    url.searchParams.set('path', `eq.${path}`);
    if (workspaceId) {
      url.searchParams.set('workspace_id', `eq.${workspaceId}`);
    }
    url.searchParams.set('order', 'version.desc');

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// Fetch from Supabase via proxy (workspace-scoped)
function fetchFromSupabase(workspaceId) {
  return new Promise((resolve, reject) => {
    const cacheKey = workspaceId || 'default';

    // Check cache first
    if (cache.pubs[cacheKey] && (Date.now() - cache.pubsTime[cacheKey]) < CACHE_TTL) {
      return resolve(cache.pubs[cacheKey]);
    }

    const url = new URL(`${API_URL}/rest/v1/publications_with_owner`);
    url.searchParams.set('select', '*');
    url.searchParams.set('order', 'published_at.desc');
    if (workspaceId) {
      url.searchParams.set('workspace_id', `eq.${workspaceId}`);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'X-Proxy-Token': API_TOKEN,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          const pubs = {};
          rows.forEach(row => {
            const key = `/${row.module}/${row.path}`;
            pubs[key] = {
              id: row.publication_id,
              module: row.module,
              path: row.path,
              content: row.content,
              version: row.version,
              url: row.url,
              ts: row.published_at,
              actor: row.actor,
              source: row.source,
              owner_name: row.owner_name,
              workspace_name: row.workspace_name,
              workspace_display_name: row.workspace_display_name,
              // Metadata from frontmatter
              doc_type: row.doc_type,
              tier: row.tier,
              intent: row.intent,
              doc_status: row.doc_status,
              doc_version: row.doc_version,
              created_date: row.created_date,
              updated_date: row.updated_date,
              parent_doc: row.parent_doc,
              children_docs: row.children_docs,
              dependencies: row.dependencies,
              commitment_id: row.commitment_id
            };
          });
          // Update cache
          cache.pubs[cacheKey] = pubs;
          cache.pubsTime[cacheKey] = Date.now();
          resolve(pubs);
        } catch (err) {
          console.error('Error parsing Supabase response:', err.message);
          resolve({});
        }
      });
    });

    req.on('error', (err) => {
      console.error('Error fetching from Supabase:', err.message);
      // Fall back to cache or empty
      resolve(cache.pubs[cacheKey] || {});
    });

    req.end();
  });
}

// Load publications based on source configuration
async function loadPublications(workspaceId) {
  if (SOURCE === 'supabase') {
    return await fetchFromSupabase(workspaceId);
  }
  return loadFromLedger();
}

// ============================================================
// PHASE 4: Search functionality
// ============================================================

function searchPublications(pubs, query) {
  if (!query) return pubs;
  const q = query.toLowerCase();
  const results = {};

  Object.entries(pubs).forEach(([key, pub]) => {
    const searchable = [
      pub.path,
      pub.module,
      pub.content,
      pub.actor
    ].filter(Boolean).join(' ').toLowerCase();

    if (searchable.includes(q)) {
      results[key] = pub;
    }
  });

  return results;
}

const HEAD = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad:true, theme:'neutral', securityLevel:'loose'});</script>
<style>
  :root {
    /* Base palette - Zinc (matches mentu-web) */
    --zinc-50: #fafafa;
    --zinc-100: #f4f4f5;
    --zinc-200: #e4e4e7;
    --zinc-300: #d4d4d8;
    --zinc-400: #a1a1aa;
    --zinc-500: #71717a;
    --zinc-600: #52525b;
    --zinc-700: #3f3f46;
    --zinc-800: #27272a;
    --zinc-900: #18181b;
    --zinc-950: #09090b;
    --blue-50: #eff6ff;
    --blue-100: #dbeafe;
    --blue-200: #bfdbfe;
    --blue-400: #60a5fa;
    --blue-500: #3b82f6;
    --blue-600: #2563eb;
    --green-400: #4ade80;
    --green-500: #22c55e;
    --pink-500: #ec4899;
    --purple-400: #c084fc;
    --purple-500: #a855f7;

    /* Semantic tokens - Light Mode */
    --bg-primary: #ffffff;
    --bg-secondary: var(--zinc-50);
    --bg-tertiary: var(--zinc-100);
    --text-primary: #171717;
    --text-secondary: var(--zinc-600);
    --text-muted: var(--zinc-500);
    --border-primary: var(--zinc-200);
    --border-secondary: var(--zinc-100);

    /* Code block tokens - Light Mode */
    --code-bg: var(--zinc-50);
    --code-text: var(--zinc-800);
    --code-line-num: var(--zinc-400);
    --code-border: var(--zinc-200);
    --code-titlebar: #ffffff;

    /* Syntax highlighting - Light Mode */
    --syn-keyword: #8b5cf6;
    --syn-string: #059669;
    --syn-comment: #6b7280;
    --syn-number: #6366f1;
    --syn-function: #ea580c;
    --syn-const: #dc2626;
    --syn-property: #0891b2;
  }

  /* Dark Mode - matches mentu-web exactly */
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #18181b;
      --bg-tertiary: #27272a;
      --text-primary: #ededed;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --border-primary: #27272a;
      --border-secondary: #3f3f46;

      /* Code block tokens - Dark Mode */
      --code-bg: #18181b;
      --code-text: #ededed;
      --code-line-num: #52525b;
      --code-border: #27272a;
      --code-titlebar: #0a0a0a;

      /* Syntax highlighting - Dark Mode */
      --syn-keyword: #c084fc;
      --syn-string: #4ade80;
      --syn-comment: #71717a;
      --syn-number: #60a5fa;
      --syn-function: #fdba74;
      --syn-const: #f87171;
      --syn-property: #22d3ee;
    }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg-secondary);
    color: var(--text-primary);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  
  /* Navigation */
  nav {
    background: var(--bg-primary);
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--border-primary);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  nav .inner {
    max-width: 80rem;
    margin: 0 auto;
    height: 4rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  nav .logo {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-primary);
    text-decoration: none;
    letter-spacing: -0.025em;
  }
  nav .logo span { color: var(--blue-500); }
  nav .links { display: flex; gap: 2rem; align-items: center; }
  nav .links a {
    color: var(--text-muted);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.9375rem;
    transition: color 0.15s;
  }
  nav .links a:hover { color: var(--text-primary); }
  
  /* Hero */
  .hero {
    text-align: center;
    padding: 5rem 1.5rem;
    background: linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary));
  }
  .hero h1 {
    font-size: clamp(2.5rem, 5vw, 3.5rem);
    font-weight: 900;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }
  .hero p {
    font-size: 1.25rem;
    color: var(--text-muted);
    max-width: 36rem;
    margin: 0 auto;
  }
  
  /* Container */
  .container { 
    max-width: 80rem; 
    margin: 0 auto; 
    padding: 0 1.5rem; 
  }
  
  /* Module Grid */
  .modules {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    padding: 3rem 0 5rem;
  }
  .module-card {
    background: var(--bg-primary);
    border-radius: 1rem;
    padding: 1.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.05);
    border: 1px solid var(--border-secondary);
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .module-card:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    transform: translateY(-2px);
  }
  .module-card h2 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .module-card h2::before {
    content: '';
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }
  .module-card.docs h2::before { background: var(--blue-500); }
  .module-card.evidence h2::before { background: var(--green-500); }
  .module-card.artifacts h2::before { background: var(--purple-500); }
  .module-card.assets h2::before { background: var(--pink-500); }
  
  .module-card ul { list-style: none; }
  .module-card li {
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--border-secondary);
  }
  .module-card li:last-child { border-bottom: none; }
  .module-card a {
    color: var(--text-secondary);
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    display: block;
    transition: color 0.15s;
  }
  .module-card a:hover { color: var(--blue-500); }
  .module-card .empty {
    color: var(--text-muted);
    font-size: 0.875rem;
    font-style: italic;
  }
  
  /* Article */
  article {
    max-width: 52rem;
    margin: 0 auto;
    padding: 3rem 1.5rem 5rem;
  }
  article .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    padding-bottom: 1.5rem;
    margin-bottom: 0;
    border-bottom: 1px solid var(--border-primary);
  }
  article .meta-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  article .meta a {
    color: var(--blue-500);
    text-decoration: none;
    font-weight: 500;
  }
  .details-toggle {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }
  .details-toggle:hover {
    background: var(--border-primary);
    border-color: var(--border-secondary);
  }
  .details-toggle[aria-expanded="true"] {
    background: var(--blue-100);
    border-color: var(--blue-200);
    color: var(--blue-600);
  }
  .metadata-panel-wrapper {
    overflow: hidden;
    transition: max-height 0.2s ease-out, opacity 0.2s ease-out;
  }
  .metadata-panel-wrapper[aria-hidden="true"] {
    max-height: 0;
    opacity: 0;
    pointer-events: none;
  }
  .metadata-panel-wrapper[aria-hidden="false"] {
    max-height: 500px;
    opacity: 1;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }
  article .meta a:hover { text-decoration: underline; }
  article .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  article .badge::before {
    content: '';
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
  }
  article .badge.docs::before { background: var(--blue-500); }
  article .badge.evidence::before { background: var(--green-500); }
  article .badge.artifacts::before { background: var(--purple-500); }
  article .badge.assets::before { background: var(--pink-500); }
  
  article .path {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-secondary);
  }
  article .sep { color: var(--text-muted); }

  /* Prose - add top margin when metadata is hidden */
  .prose {
    margin-top: 2rem;
  }
  .prose h1 {
    font-size: 2.5rem;
    font-weight: 800;
    margin: 0 0 1.5rem;
    color: var(--text-primary);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .prose h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 2.5rem 0 1rem;
    color: var(--text-primary);
    letter-spacing: -0.015em;
  }
  .prose h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 2rem 0 0.75rem;
    color: var(--text-primary);
  }
  .prose p {
    margin: 1.25rem 0;
    color: var(--text-secondary);
    font-size: 1.0625rem;
    line-height: 1.75;
  }
  .prose ul, .prose ol {
    margin: 1.25rem 0;
    padding-left: 1.5rem;
  }
  .prose li {
    margin: 0.5rem 0;
    color: var(--text-secondary);
    line-height: 1.75;
  }
  .prose li::marker { color: var(--text-muted); }

  .prose code {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875em;
    color: var(--syn-const);
  }

  .prose pre {
    background: var(--code-bg);
    color: var(--code-text);
    padding: 1.25rem 1.5rem;
    border-radius: 0.75rem;
    overflow-x: auto;
    margin: 1.75rem 0;
    font-size: 0.875rem;
    line-height: 1.75;
    border: 1px solid var(--code-border);
  }
  .prose pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  .prose strong { font-weight: 600; color: var(--text-primary); }
  .prose em { font-style: italic; }

  .prose a {
    color: var(--blue-500);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose a:hover { color: var(--blue-600); }

  .prose blockquote {
    border-left: 3px solid var(--blue-500);
    padding-left: 1rem;
    margin: 1.5rem 0;
    color: var(--text-secondary);
    font-style: italic;
  }

  .prose hr {
    border: none;
    border-top: 1px solid var(--border-primary);
    margin: 2.5rem 0;
  }

  .prose img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 1.5rem 0;
  }
  
  /* Code Window - Adaptive light/dark theme with line numbers */
  .code-window {
    background: var(--code-bg);
    border-radius: 0.75rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    border: 1px solid var(--code-border);
    overflow: hidden;
    margin: 1.75rem 0;
  }
  .code-window .titlebar {
    display: flex;
    align-items: center;
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--code-border);
    background: var(--code-titlebar);
  }
  .code-window .dots {
    display: flex;
    gap: 0.375rem;
  }
  .code-window .dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: var(--text-muted);
    opacity: 0.5;
  }
  .code-window .filename {
    flex: 1;
    text-align: center;
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-muted);
  }
  .code-window pre {
    margin: 0;
    padding: 1rem 1.25rem;
    background: var(--code-bg);
    border-radius: 0;
    font-size: 0.8125rem;
    line-height: 1.7;
    counter-reset: line;
    overflow-x: auto;
  }
  .code-window code {
    display: block;
    color: var(--code-text);
  }
  .code-window .line {
    display: block;
    padding-left: 3rem;
    position: relative;
    min-height: 1.7em;
  }
  .code-window .line::before {
    counter-increment: line;
    content: counter(line);
    position: absolute;
    left: 0;
    width: 2rem;
    text-align: right;
    color: var(--code-line-num);
    font-size: 0.75rem;
    user-select: none;
  }
  
  /* Mermaid */
  .mermaid {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin: 1.75rem 0;
    border: 1px solid var(--border-primary);
    text-align: center;
  }
  
  /* Tables */
  .prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.75rem 0;
    font-size: 0.9375rem;
  }
  .prose th, .prose td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-primary);
  }
  .prose th {
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-secondary);
  }
  .prose td { color: var(--text-secondary); }
  .prose tr:hover td { background: var(--bg-secondary); }
  
  /* 404 */
  .not-found {
    text-align: center;
    padding: 8rem 1.5rem;
  }
  .not-found h1 {
    font-size: 8rem;
    font-weight: 900;
    color: var(--border-primary);
    line-height: 1;
  }
  .not-found p { color: var(--text-muted); margin: 1rem 0; }
  .not-found a { color: var(--blue-500); }
  
  /* Syntax Highlighting - Uses semantic tokens for dark/light */
  .token-keyword { color: var(--syn-keyword); }
  .token-string { color: var(--syn-string); }
  .token-comment { color: var(--syn-comment); }
  .token-number { color: var(--syn-number); }
  .token-function { color: var(--syn-function); }
  .token-const { color: var(--syn-const); }
  .token-property { color: var(--syn-property); }
  .token-variable { color: var(--text-secondary); }

  /* Phase 3: Workspace Switcher */
  .workspace-switcher {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: 1rem;
  }
  .workspace-switcher select {
    appearance: none;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    padding: 0.375rem 2rem 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .workspace-switcher select:hover {
    background: var(--bg-primary);
    border-color: var(--blue-500);
  }
  .workspace-switcher::after {
    content: '';
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    border: 4px solid transparent;
    border-top-color: var(--text-muted);
    pointer-events: none;
  }

  /* Phase 4: Search */
  .search-bar {
    max-width: 30rem;
    margin: 0 auto 2rem;
  }
  .search-bar input {
    width: 100%;
    padding: 0.875rem 1.25rem;
    font-size: 1rem;
    border: 2px solid var(--border-primary);
    border-radius: 0.75rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-bar input:focus {
    outline: none;
    border-color: var(--blue-500);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .search-bar input::placeholder {
    color: var(--text-muted);
  }
  .search-results-count {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  /* Phase 4: Stats Badge */
  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-left: 0.5rem;
  }
  .stat-badge svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  /* Phase 4: Version History */
  .version-history {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1.5rem;
    border: 1px solid var(--border-primary);
  }
  .version-history h4 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  .version-history ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .version-history li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border-primary);
  }
  .version-history li:last-child {
    border-bottom: none;
  }
  .version-history .version-num {
    font-weight: 600;
    color: var(--blue-500);
    font-family: 'JetBrains Mono', monospace;
  }
  .version-history .version-date {
    color: var(--text-muted);
    font-size: 0.8125rem;
  }
  .version-history .version-actor {
    color: var(--text-muted);
    font-size: 0.8125rem;
    margin-left: auto;
  }

  /* Metadata Badges */
  .meta-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }
  .meta-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  /* Intent is the primary pillar - what's the purpose? */
  .meta-badge.intent-execute { background: #fef3c7; color: #92400e; }
  .meta-badge.intent-reference { background: #e0e7ff; color: #3730a3; }
  .meta-badge.intent-launch { background: #dcfce7; color: #166534; }
  .meta-badge.intent { background: #f3e8ff; color: #7c3aed; }
  /* Tier T1 = critical (visible), T2/T3 = silent */
  .meta-badge.tier-t1 { background: #fee2e2; color: #991b1b; }

  /* Metadata Panel (Detail View) - minimal pillars */
  .metadata-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }
  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }
  .metadata-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .metadata-item .label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }
  .metadata-item .value {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .metadata-item .value.mono {
    font-family: 'JetBrains Mono', monospace;
  }
  .metadata-item .value a {
    color: var(--blue-500);
    text-decoration: none;
  }
  .metadata-item .value a:hover {
    text-decoration: underline;
  }
  .metadata-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-secondary);
  }
  .metadata-section h5 {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin: 0 0 0.75rem 0;
  }
  .metadata-links {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .metadata-links a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--blue-500);
    text-decoration: none;
    font-size: 0.8125rem;
  }
  .metadata-links a:hover {
    text-decoration: underline;
  }
  .metadata-links .arrow {
    color: var(--text-muted);
  }

  /* API Response Styles */
  .api-response {
    background: var(--code-bg);
    color: var(--code-text);
    padding: 2rem;
    border-radius: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    white-space: pre-wrap;
    overflow-x: auto;
    border: 1px solid var(--code-border);
  }
</style>
`;

function syntaxHighlight(code, lang) {
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments first (preserve them)
    .replace(/(\/\/.*$)/gm, '<span class="token-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>')
    // Strings
    .replace(/(["'`])((?:[^"'`\\]|\\.)*)(\1)/g, '<span class="token-string">$1$2$3</span>')
    // Keywords
    .replace(/\b(const|let|var|function|async|await|return|export|default|import|from|if|else|for|while|class|extends|new|this|try|catch|throw|type|interface)\b/g, '<span class="token-keyword">$1</span>')
    // Constants
    .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g, '<span class="token-const">$1</span>')
    // Function/method calls
    .replace(/\.([a-zA-Z_][a-zA-Z0-9_]*)\(/g, '.<span class="token-function">$1</span>(')
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\(/g, '<span class="token-function">$1</span>(')
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="token-number">$1</span>');

  // Wrap each line in a span for line numbers
  const lines = highlighted.split('\n');
  return lines.map(line => `<span class="line">${line}</span>`).join('\n');
}

function renderMarkdown(content) {
  if (!content) return '<p style="color:var(--text-muted);font-style:italic">No content</p>';
  
  let html = content;
  
  // Mermaid diagrams
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, '<div class="mermaid">$1</div>');
  
  // Code blocks with syntax highlighting
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const filename = lang || 'code';
    return `<div class="code-window">
      <div class="titlebar">
        <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        <div class="filename">${filename}</div>
      </div>
      <pre><code>${syntaxHighlight(code.trim(), lang)}</code></pre>
    </div>`;
  });
  
  // Tables
  html = html.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
    const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
    const bodyRows = rows.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });
  
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold, italic, strikethrough
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images (must come before links!)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul>$&</ul>');
  
  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<(h[1-6]|ul|ol|table|div|blockquote|hr|pre)/g, '<$1');
  html = html.replace(/<\/(h[1-6]|ul|ol|table|div|blockquote|hr|pre)>\s*<\/p>/g, '</$1>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

function getNav() {
  return `
<nav>
  <div class="inner">
    <a href="/" class="logo">mentu<span>.</span></a>
    <div class="links">
      <a href="/knowledge-base/">Knowledge Base</a>
      <a href="${BASE_PATH}/">Publications</a>
      <a href="/overview/">Overview</a>
      <a href="https://github.com/mentu-ai" target="_blank">GitHub</a>
    </div>
  </div>
</nav>`;
}

// Helper: Generate workspace switcher HTML
async function getWorkspaceSwitcher(currentWorkspaceId, currentWorkspaceName) {
  const workspaces = await fetchAllWorkspaces();
  if (workspaces.length <= 1) return '';

  return `
    <div class="workspace-switcher">
      <select onchange="window.location.href='${BASE_PATH}/' + this.value + '/'">
        ${workspaces.map(ws => `
          <option value="${ws.name}" ${ws.id === currentWorkspaceId ? 'selected' : ''}>
            ${ws.display_name || ws.name}
          </option>
        `).join('')}
      </select>
    </div>
  `;
}

// Helper: Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Helper: View count icon SVG
const viewIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;

const server = http.createServer(async (req, res) => {
  const NAV = getNav();

  // Strip BASE_PATH from URL for routing
  let url = req.url;
  if (BASE_PATH && url.startsWith(BASE_PATH)) {
    url = url.slice(BASE_PATH.length) || '/';
  }

  // Parse URL for query params
  const urlParts = url.split('?');
  const pathname = urlParts[0];
  const queryString = urlParts[1] || '';
  const params = new URLSearchParams(queryString);
  const searchQuery = params.get('q') || '';

  // ============================================================
  // PHASE 2: API Endpoints
  // ============================================================

  // API: Get workspace info
  if (pathname === '/api/workspace') {
    const workspaceIdent = resolveWorkspaceId(req);
    const workspaceId = typeof workspaceIdent === 'string' ? workspaceIdent : null;
    const workspace = workspaceId ? await fetchWorkspace(workspaceId) : null;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      workspace_id: workspaceId,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        display_name: workspace.display_name,
        owner: workspace.genesis_key?.identity?.owner || null
      } : null
    }));
    return;
  }

  // API: Get all workspaces (for switcher)
  if (pathname === '/api/workspaces') {
    const workspaces = await fetchAllWorkspaces();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(workspaces));
    return;
  }

  // API: Get publication stats
  if (pathname === '/api/stats') {
    const workspaceIdent = resolveWorkspaceId(req);
    const workspaceId = typeof workspaceIdent === 'string' ? workspaceIdent : DEFAULT_WORKSPACE_ID;
    const stats = await fetchPublicationStats(workspaceId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
  }

  // API: Get version history for a publication
  if (pathname.startsWith('/api/versions/')) {
    const parts = pathname.replace('/api/versions/', '').split('/');
    const module = parts[0];
    const path = parts.slice(1).join('/');
    const workspaceIdent = resolveWorkspaceId(req);
    const workspaceId = typeof workspaceIdent === 'string' ? workspaceIdent : DEFAULT_WORKSPACE_ID;
    const versions = await fetchVersionHistory(module, path, workspaceId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(versions));
    return;
  }

  // API: Restart server (hot reload)
  if (pathname === '/api/restart' || pathname === '/_restart') {
    const token = url.searchParams.get('token') || req.headers['x-restart-token'];
    // Simple auth: must match API token or be from localhost
    const isLocal = req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1';
    if (isLocal || token === API_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'restarting', pid: process.pid }));
      setTimeout(() => process.exit(0), 100); // Exit cleanly, let supervisor restart
      return;
    }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  // ============================================================
  // PHASE 2: Resolve workspace from request
  // ============================================================

  const workspaceIdent = resolveWorkspaceId(req);
  let workspaceId = DEFAULT_WORKSPACE_ID;

  if (typeof workspaceIdent === 'string') {
    workspaceId = workspaceIdent;
  } else if (workspaceIdent.name) {
    const ws = await fetchWorkspace(workspaceIdent);
    if (ws) workspaceId = ws.id;
  }

  // Load publications for resolved workspace
  let pubs = await loadPublications(workspaceId);

  // Apply search filter if query present
  if (searchQuery) {
    pubs = searchPublications(pubs, searchQuery);
  }

  // Fetch stats for publications
  const stats = SOURCE === 'supabase' ? await fetchPublicationStats(workspaceId) : {};

  // Get workspace switcher
  const workspaceSwitcher = SOURCE === 'supabase' ? await getWorkspaceSwitcher(workspaceId) : '';

  // ============================================================
  // Index Page (with search)
  // ============================================================

  // Root redirects to default workspace
  if (pathname === '/') {
    res.writeHead(302, { 'Location': `${BASE_PATH}/mentu-ai/` });
    res.end();
    return;
  }

  // Match workspace index: /{workspace}/
  const indexMatch = pathname.match(/^\/([^\/]+)\/?$/);
  if (indexMatch && !['api', 'health', 'static'].includes(indexMatch[1])) {
    const workspaceName = indexMatch[1];

    // Fetch workspace by name to get publications
    const wsData = await fetchWorkspace({ name: workspaceName });
    if (wsData) {
      workspaceId = wsData.id;
      pubs = await loadPublications(workspaceId);
      if (searchQuery) pubs = searchPublications(pubs, searchQuery);
    }

    const views = ['docs', 'evidence', 'artifacts', 'assets'];

    // Get owner info from workspace or first publication
    const firstPub = Object.values(pubs)[0];
    const ownerName = firstPub?.owner_name || wsData?.genesis_key?.identity?.owner || 'Mentu';
    const displayName = wsData?.display_name || firstPub?.workspace_display_name || workspaceName;
    const totalCount = Object.keys(pubs).length;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <title>${displayName} - Mentu Publications</title>
  ${HEAD}
</head>
<body>
  ${NAV}
  <div class="hero">
    <h1>${displayName}</h1>
    <p>Publications by ${ownerName}${workspaceSwitcher}</p>
  </div>
  <div class="container">
    <div class="search-bar">
      <form method="get" action="${BASE_PATH}/${workspaceName}/">
        <input type="text" name="q" placeholder="Search publications..." value="${searchQuery.replace(/"/g, '&quot;')}" autocomplete="off">
      </form>
    </div>
    ${searchQuery ? `<p class="search-results-count">Found ${totalCount} result${totalCount !== 1 ? 's' : ''} for "${searchQuery}"</p>` : ''}
    <div class="modules">
      ${views.map(view => {
        const items = Object.entries(pubs).filter(([k]) => k.startsWith('/' + view + '/'));
        return `<div class="module-card ${view}">
          <h2>${view}</h2>
          ${items.length === 0
            ? '<p class="empty">No publications yet</p>'
            : `<ul>${items.map(([k, v]) => {
                // Minimal, first-principled: Intent (why) + T1 critical only
                const intentClass = v.intent ? `intent-${v.intent.toLowerCase()}` : 'intent';
                const isT1 = v.tier && v.tier.toUpperCase() === 'T1';
                return `<li>
                  <a href="${BASE_PATH}/${workspaceName}${k}">${v.path}</a>
                  ${(v.intent || isT1) ? `<div class="meta-badges">
                    ${v.intent ? `<span class="meta-badge ${intentClass}">${v.intent}</span>` : ''}
                    ${isT1 ? `<span class="meta-badge tier-t1">T1</span>` : ''}
                  </div>` : ''}
                </li>`;
              }).join('')}</ul>`
          }
        </div>`;
      }).join('')}
    </div>
  </div>
</body>
</html>`);
    return;
  }

  // ============================================================
  // Publication Detail Page (with version history + analytics)
  // ============================================================

  // Match: /{workspace}/{view}/{path}
  const pubMatch = pathname.match(/^\/([^\/]+)\/(docs|evidence|artifacts|assets)\/(.+)$/);
  if (pubMatch) {
    const workspaceName = pubMatch[1];
    const viewType = pubMatch[2];
    const pubPath = pubMatch[3];
    const pubKey = `/${viewType}/${pubPath}`;

    // Fetch workspace by name to get publications
    const wsData = await fetchWorkspace({ name: workspaceName });
    if (wsData) {
      workspaceId = wsData.id;
      pubs = await loadPublications(workspaceId);
    }

    const pub = pubs[pubKey];

    if (pub) {
      // Track view (async, don't wait)
      if (SOURCE === 'supabase') {
        trackView(pub.id, workspaceId, req);
      }

      // Fetch version history
      const versions = SOURCE === 'supabase'
        ? await fetchVersionHistory(pub.module, pub.path, workspaceId)
        : [];

      const pubStats = stats[pub.id] || {};
      const viewCount = pubStats.view_count || 0;
      const displayName = wsData?.display_name || workspaceName;

      // Minimal metadata: Intent (why), Tier (if T1), Type (what)
      const hasMetadata = pub.intent || pub.tier || pub.doc_type || pub.parent_doc || pub.children_docs;
      const intentClass = pub.intent ? `intent-${pub.intent.toLowerCase()}` : 'intent';
      const isT1 = pub.tier && pub.tier.toUpperCase() === 'T1';

      const metadataPanel = hasMetadata ? `
        <div class="metadata-panel">
          <div class="metadata-grid">
            ${pub.intent ? `<div class="metadata-item"><span class="label">Intent</span><span class="value"><span class="meta-badge ${intentClass}">${pub.intent}</span></span></div>` : ''}
            ${pub.doc_type ? `<div class="metadata-item"><span class="label">Type</span><span class="value">${pub.doc_type}</span></div>` : ''}
            ${isT1 ? `<div class="metadata-item"><span class="label">Tier</span><span class="value"><span class="meta-badge tier-t1">T1 Critical</span></span></div>` : ''}
            ${pub.doc_version ? `<div class="metadata-item"><span class="label">Version</span><span class="value mono">${pub.doc_version}</span></div>` : ''}
          </div>
          ${(pub.parent_doc || pub.children_docs || pub.dependencies) ? `
          <div class="metadata-section">
            <h5>Lineage</h5>
            <div class="metadata-links">
              ${pub.parent_doc ? `<a href="${BASE_PATH}/${workspaceName}/docs/${pub.parent_doc.toLowerCase().replace(/^(prd|handoff|prompt|result|audit|intent|spec)-/i, (m, p) => p.toLowerCase() + '/')}"><span class="arrow">↑</span> ${pub.parent_doc}</a>` : ''}
              ${pub.children_docs && pub.children_docs.length ? pub.children_docs.map(c => `<a href="${BASE_PATH}/${workspaceName}/docs/${c.toLowerCase().replace(/^(prd|handoff|prompt|result|audit|intent|spec)-/i, (m, p) => p.toLowerCase() + '/')}"><span class="arrow">↓</span> ${c}</a>`).join('') : ''}
              ${pub.dependencies && pub.dependencies.length ? pub.dependencies.map(d => `<a href="${BASE_PATH}/${workspaceName}/docs/${d.toLowerCase().replace(/^(prd|handoff|prompt|result|audit|intent|spec)-/i, (m, p) => p.toLowerCase() + '/')}"><span class="arrow">→</span> ${d}</a>`).join('') : ''}
            </div>
          </div>
          ` : ''}
        </div>
      ` : '';

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <title>${pub.path} – ${displayName}</title>
  ${HEAD}
</head>
<body>
  ${NAV}
  <article>
    <div class="meta">
      <div class="meta-left">
        <a href="${BASE_PATH}/${workspaceName}/">← ${displayName}</a>
        <span class="sep">|</span>
        <span class="badge ${pub.module}">${pub.module}</span>
        <span class="path">${pub.path}</span>
        <span class="sep">|</span>
        <span>v${pub.version}</span>
        ${viewCount > 0 ? `<span class="stat-badge">${viewIcon} ${viewCount} views</span>` : ''}
      </div>
      ${hasMetadata ? `<button class="details-toggle" onclick="toggleDetails()" aria-expanded="false">Details</button>` : ''}
    </div>
    <div class="metadata-panel-wrapper" aria-hidden="true">
      ${metadataPanel}
    </div>
    <script>
      function toggleDetails() {
        const wrapper = document.querySelector('.metadata-panel-wrapper');
        const btn = document.querySelector('.details-toggle');
        const isHidden = wrapper.getAttribute('aria-hidden') === 'true';
        wrapper.setAttribute('aria-hidden', !isHidden);
        btn.setAttribute('aria-expanded', isHidden);
        btn.textContent = isHidden ? 'Hide' : 'Details';
      }
    </script>
    <div class="prose">
      ${renderMarkdown(pub.content)}
    </div>
    ${versions.length > 1 ? `
    <div class="version-history">
      <h4>Version History</h4>
      <ul>
        ${versions.map(v => `
          <li>
            <span class="version-num">v${v.version}</span>
            <span class="version-date">${formatDate(v.published_at)}</span>
            <span class="version-actor">${v.actor}</span>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}
  </article>
</body>
</html>`);
      return;
    }
  }

  // ============================================================
  // 404 Page
  // ============================================================

  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head><title>404 – Mentu</title>${HEAD}</head>
<body>
  ${NAV}
  <div class="not-found">
    <h1>404</h1>
    <p>Publication not found: <code>${pathname}</code></p>
    <p><a href="${BASE_PATH}/">Back to publications</a></p>
  </div>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log('Mentu Publication Server: http://localhost:' + PORT);
  console.log('  Source:', SOURCE === 'supabase' ? 'Supabase API' : 'Local ledger');
  if (BASE_PATH) console.log('  Base path:', BASE_PATH);
});
