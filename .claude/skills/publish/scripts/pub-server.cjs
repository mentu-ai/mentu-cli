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

  // Option 4: From path (e.g., /docs/rashid/...)
  const pathMatch = req.url.match(/^\/p\/([^\/]+)/);
  if (pathMatch && pathMatch[1] !== 'mentu-ai') {
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
              workspace_display_name: row.workspace_display_name
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
    --slate-50: #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-500: #64748b;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --slate-900: #0f172a;
    --blue-500: #3b82f6;
    --blue-600: #2563eb;
    --green-500: #22c55e;
    --pink-500: #ec4899;
    --purple-500: #a855f7;
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body { 
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--slate-50);
    color: var(--slate-800);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  
  /* Navigation */
  nav {
    background: white;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--slate-200);
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
    color: var(--slate-900);
    text-decoration: none;
    letter-spacing: -0.025em;
  }
  nav .logo span { color: var(--blue-500); }
  nav .links { display: flex; gap: 2rem; align-items: center; }
  nav .links a { 
    color: var(--slate-500); 
    text-decoration: none; 
    font-weight: 500;
    font-size: 0.9375rem;
    transition: color 0.15s;
  }
  nav .links a:hover { color: var(--slate-900); }
  
  /* Hero */
  .hero {
    text-align: center;
    padding: 5rem 1.5rem;
    background: linear-gradient(to bottom, white, var(--slate-50));
  }
  .hero h1 {
    font-size: clamp(2.5rem, 5vw, 3.5rem);
    font-weight: 900;
    letter-spacing: -0.03em;
    color: var(--slate-900);
    margin-bottom: 1rem;
  }
  .hero p { 
    font-size: 1.25rem; 
    color: var(--slate-500);
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
    background: white;
    border-radius: 1rem;
    padding: 1.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.05);
    border: 1px solid var(--slate-100);
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .module-card:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  .module-card h2 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--slate-400);
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
    border-bottom: 1px solid var(--slate-100);
  }
  .module-card li:last-child { border-bottom: none; }
  .module-card a {
    color: var(--slate-700);
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    display: block;
    transition: color 0.15s;
  }
  .module-card a:hover { color: var(--blue-600); }
  .module-card .empty {
    color: var(--slate-400);
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
    flex-wrap: wrap;
    gap: 0.75rem;
    color: var(--slate-500);
    font-size: 0.875rem;
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--slate-200);
  }
  article .meta a { 
    color: var(--blue-500); 
    text-decoration: none;
    font-weight: 500;
  }
  article .meta a:hover { text-decoration: underline; }
  article .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: var(--slate-100);
    color: var(--slate-600);
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
    color: var(--slate-600);
  }
  article .sep { color: var(--slate-300); }
  
  /* Prose */
  .prose h1 { 
    font-size: 2.5rem; 
    font-weight: 800; 
    margin: 0 0 1.5rem; 
    color: var(--slate-900);
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .prose h2 { 
    font-size: 1.5rem; 
    font-weight: 700; 
    margin: 2.5rem 0 1rem; 
    color: var(--slate-900);
    letter-spacing: -0.015em;
  }
  .prose h3 { 
    font-size: 1.25rem; 
    font-weight: 600; 
    margin: 2rem 0 0.75rem; 
    color: var(--slate-900); 
  }
  .prose p { 
    margin: 1.25rem 0; 
    color: var(--slate-600);
    font-size: 1.0625rem;
    line-height: 1.75;
  }
  .prose ul, .prose ol { 
    margin: 1.25rem 0; 
    padding-left: 1.5rem; 
  }
  .prose li { 
    margin: 0.5rem 0; 
    color: var(--slate-600);
    line-height: 1.75;
  }
  .prose li::marker { color: var(--slate-400); }
  
  .prose code {
    background: var(--slate-100);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875em;
    color: var(--pink-500);
  }
  
  .prose pre {
    background: var(--slate-900);
    color: var(--slate-100);
    padding: 1.25rem 1.5rem;
    border-radius: 0.75rem;
    overflow-x: auto;
    margin: 1.75rem 0;
    font-size: 0.875rem;
    line-height: 1.75;
  }
  .prose pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }
  
  .prose strong { font-weight: 600; color: var(--slate-800); }
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
    color: var(--slate-600);
    font-style: italic;
  }
  
  .prose hr {
    border: none;
    border-top: 1px solid var(--slate-200);
    margin: 2.5rem 0;
  }
  
  .prose img {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 1.5rem 0;
  }
  
  /* Code Window */
  .code-window {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid var(--slate-200);
    overflow: hidden;
    margin: 1.75rem 0;
  }
  .code-window .titlebar {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--slate-100);
    background: var(--slate-50);
  }
  .code-window .dots {
    display: flex;
    gap: 0.5rem;
  }
  .code-window .dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: var(--slate-200);
  }
  .code-window .filename {
    flex: 1;
    text-align: center;
    font-size: 0.8125rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--slate-400);
  }
  .code-window pre {
    margin: 0;
    padding: 1.25rem;
    background: var(--slate-900);
    border-radius: 0;
    font-size: 0.875rem;
  }
  
  /* Mermaid */
  .mermaid {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin: 1.75rem 0;
    border: 1px solid var(--slate-200);
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
    border-bottom: 1px solid var(--slate-200);
  }
  .prose th {
    background: var(--slate-50);
    font-weight: 600;
    color: var(--slate-700);
  }
  .prose td { color: var(--slate-600); }
  .prose tr:hover td { background: var(--slate-50); }
  
  /* 404 */
  .not-found {
    text-align: center;
    padding: 8rem 1.5rem;
  }
  .not-found h1 {
    font-size: 8rem;
    font-weight: 900;
    color: var(--slate-200);
    line-height: 1;
  }
  .not-found p { color: var(--slate-500); margin: 1rem 0; }
  .not-found a { color: var(--blue-500); }
  
  /* Syntax Highlighting */
  .token-keyword { color: #f472b6; }
  .token-string { color: #a5f3fc; }
  .token-comment { color: #64748b; }
  .token-number { color: #fbbf24; }
  .token-function { color: #c4b5fd; }
  .token-const { color: #7dd3fc; }

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
    background: var(--slate-100);
    border: 1px solid var(--slate-200);
    border-radius: 0.5rem;
    padding: 0.375rem 2rem 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--slate-700);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .workspace-switcher select:hover {
    background: white;
    border-color: var(--blue-500);
  }
  .workspace-switcher::after {
    content: '';
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    border: 4px solid transparent;
    border-top-color: var(--slate-400);
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
    border: 2px solid var(--slate-200);
    border-radius: 0.75rem;
    background: white;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search-bar input:focus {
    outline: none;
    border-color: var(--blue-500);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .search-bar input::placeholder {
    color: var(--slate-400);
  }
  .search-results-count {
    text-align: center;
    color: var(--slate-500);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  /* Phase 4: Stats Badge */
  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--slate-400);
    margin-left: 0.5rem;
  }
  .stat-badge svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  /* Phase 4: Version History */
  .version-history {
    background: var(--slate-50);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1.5rem;
    border: 1px solid var(--slate-200);
  }
  .version-history h4 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--slate-500);
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
    border-bottom: 1px solid var(--slate-200);
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
    color: var(--slate-500);
    font-size: 0.8125rem;
  }
  .version-history .version-actor {
    color: var(--slate-400);
    font-size: 0.8125rem;
    margin-left: auto;
  }

  /* API Response Styles */
  .api-response {
    background: var(--slate-900);
    color: var(--slate-100);
    padding: 2rem;
    border-radius: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
    white-space: pre-wrap;
    overflow-x: auto;
  }
</style>
`;

function syntaxHighlight(code, lang) {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(["'`])((?:[^"'`\\]|\\.)*)(\1)/g, '<span class="token-string">$1$2$3</span>')
    .replace(/\b(const|let|var|function|async|await|return|export|default|import|from|if|else|for|while|class|extends|new|this|try|catch|throw)\b/g, '<span class="token-keyword">$1</span>')
    .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g, '<span class="token-const">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="token-number">$1</span>')
    .replace(/(\/\/.*$)/gm, '<span class="token-comment">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>');
}

function renderMarkdown(content) {
  if (!content) return '<p style="color:var(--slate-400);font-style:italic">No content</p>';
  
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
      <select onchange="window.location.href='${BASE_PATH}/p/' + this.value + '/'">
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

  // Match workspace-specific paths or root
  const indexMatch = pathname.match(/^\/(?:p\/([^\/]+)\/?)?$/);
  if (indexMatch || pathname === '/') {
    const workspaceName = indexMatch?.[1] || 'mentu-ai';
    const modules = ['docs', 'evidence', 'artifacts', 'assets'];

    // Get owner info from first publication (all have same workspace)
    const firstPub = Object.values(pubs)[0];
    const ownerName = firstPub?.owner_name || 'Mentu';
    const displayName = firstPub?.workspace_display_name || 'Publications';
    const totalCount = Object.keys(pubs).length;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <title>${displayName} Publications</title>
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
      <form method="get" action="${BASE_PATH}/p/${workspaceName}/">
        <input type="text" name="q" placeholder="Search publications..." value="${searchQuery.replace(/"/g, '&quot;')}" autocomplete="off">
      </form>
    </div>
    ${searchQuery ? `<p class="search-results-count">Found ${totalCount} result${totalCount !== 1 ? 's' : ''} for "${searchQuery}"</p>` : ''}
    <div class="modules">
      ${modules.map(mod => {
        const items = Object.entries(pubs).filter(([k]) => k.startsWith('/' + mod + '/'));
        return `<div class="module-card ${mod}">
          <h2>${mod}</h2>
          ${items.length === 0
            ? '<p class="empty">No publications yet</p>'
            : `<ul>${items.map(([k, v]) => {
                const pubStats = stats[v.id] || {};
                const viewCount = pubStats.view_count || 0;
                return `<li>
                  <a href="${BASE_PATH}/p/${workspaceName}${k}">${v.path}</a>
                  ${viewCount > 0 ? `<span class="stat-badge">${viewIcon} ${viewCount}</span>` : ''}
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

  const pubMatch = pathname.match(/^\/p\/([^\/]+)(\/.+)$/);
  if (pubMatch) {
    const workspaceName = pubMatch[1];
    const pubPath = pubMatch[2];
    const pub = pubs[pubPath];

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

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <title>${pub.path} – Mentu</title>
  ${HEAD}
</head>
<body>
  ${NAV}
  <article>
    <div class="meta">
      <a href="${BASE_PATH}/p/${workspaceName}/">← All publications</a>
      <span class="sep">|</span>
      <span class="badge ${pub.module}">${pub.module}</span>
      <span class="path">${pub.path}</span>
      <span class="sep">|</span>
      <span>v${pub.version}</span>
      ${viewCount > 0 ? `<span class="stat-badge">${viewIcon} ${viewCount} views</span>` : ''}
    </div>
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
