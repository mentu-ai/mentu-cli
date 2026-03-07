// mentu workspace-init — Initialize a complete Mentu + Ralph + Claude Code workspace
//
// Orchestrates: cloud workspace creation, .mentu/ init, template scaffolding,
// Claude Code hooks wiring, .ralph/ setup, .env + .gitignore updates.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import type { Command } from 'commander';
import { MentuError } from '../types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkspaceInitOptions {
  name: string;
  actor?: string;
  buildCmd?: string;
  promise?: string;
  domains?: string;
  port?: string;
  tokenVar?: string;
  wsVar?: string;
  skipWorkspace?: boolean;
  force?: boolean;
}

interface WorkspaceInitOutput {
  workspace_id: string | null;
  created: string[];
  updated: string[];
  skipped: string[];
  project_root: string;
}

// ─── Output ──────────────────────────────────────────────────────────────────

function outputResult(result: WorkspaceInitOutput, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    console.log('Mentu workspace initialized');
    console.log('');
    if (result.workspace_id) {
      console.log(`Workspace ID: ${result.workspace_id}`);
      console.log('');
    }
    if (result.created.length > 0) {
      console.log('Created:');
      for (const f of result.created) {
        console.log(`  ${f}`);
      }
    }
    if (result.updated.length > 0) {
      console.log('');
      console.log('Updated:');
      for (const f of result.updated) {
        console.log(`  ${f}`);
      }
    }
    if (result.skipped.length > 0) {
      console.log('');
      console.log('Skipped (already exists):');
      for (const f of result.skipped) {
        console.log(`  ${f}`);
      }
    }
    console.log('');
    console.log('Next steps:');
    console.log('  1. Create initial git commit: git add -A && git commit -m "chore: init workspace"');
    console.log('  2. Customize CLAUDE.md with your project architecture');
    console.log('  3. Review .mcp.json — add project-specific MCP servers');
    console.log('  4. Run your build command to verify the project builds');
    console.log('  5. Create HANDOFFs with /craft or /craft-ralph');
    console.log('  6. Capture + commit: mentu capture "First task" → mentu commit --source mem_xxx "Task"');
  }
}

function outputError(error: MentuError, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(error.toJSON()));
  } else {
    console.error(`Error: ${error.message}`);
  }
  process.exit(1);
}

// ─── Auto-detection ──────────────────────────────────────────────────────────

function detectBuildCommand(cwd: string): string {
  const pkgManager = detectPackageManager(cwd);
  const pkg = readPackageJson(cwd);
  if (pkg?.scripts && typeof pkg.scripts === 'object') {
    const scripts = pkg.scripts as Record<string, string>;
    if (scripts.build) {
      return `${pkgManager} run build`;
    }
  }
  // Rust
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) return 'cargo build';
  // Swift
  if (fs.existsSync(path.join(cwd, 'Package.swift'))) return 'swift build';
  // Go
  if (fs.existsSync(path.join(cwd, 'go.mod'))) return 'go build ./...';

  return `${pkgManager} run build`;
}

function detectPackageManager(cwd: string): string {
  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectPort(cwd: string): string {
  const pkg = readPackageJson(cwd);
  if (pkg?.scripts && typeof pkg.scripts === 'object') {
    const scripts = pkg.scripts as Record<string, string>;
    const devScript = scripts.dev || scripts.start || '';
    // Match --port NNNN or -p NNNN
    const portMatch = devScript.match(/(?:--port|-p)\s+(\d+)/);
    if (portMatch) return portMatch[1];
  }
  return '3000';
}

function readPackageJson(cwd: string): Record<string, unknown> | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ─── Template Helpers ────────────────────────────────────────────────────────

function replaceVars(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Recursively copy template files from srcDir to destDir, replacing {{VAR}}s.
 *
 * Directory mapping:
 *   templates/workspace/claude/  → .claude/
 *   templates/workspace/ralph/   → .ralph/
 *   templates/workspace/docs/    → docs/
 *   templates/workspace/scripts/ → scripts/
 *   templates/workspace/ralph.yml → ralph.yml
 *   templates/workspace/mentu-manifest.yaml → .mentu/manifest.yaml
 *   templates/workspace/claude.md → CLAUDE.md
 *   templates/workspace/mcp.json → .mcp.json
 */
function copyTemplates(
  srcDir: string,
  destDir: string,
  vars: Record<string, string>,
  force: boolean
): { created: string[]; skipped: string[] } {
  const created: string[] = [];
  const skipped: string[] = [];

  if (!fs.existsSync(srcDir)) {
    return { created, skipped };
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);

    if (entry.isDirectory()) {
      // Map template subdirs to project dirs
      const dirMappings: Record<string, string> = {
        claude: '.claude',
        ralph: '.ralph',
      };
      const mappedName = dirMappings[entry.name] || entry.name;
      const destSubdir = path.join(destDir, mappedName);
      const sub = copyTemplates(srcPath, destSubdir, vars, force);
      created.push(...sub.created);
      skipped.push(...sub.skipped);
    } else if (entry.isFile()) {
      // Special case file mappings
      const fileMappings: Record<string, string> = {
        'mentu-manifest.yaml': path.join('.mentu', 'manifest.yaml'),
        'claude.md': 'CLAUDE.md',
        'mcp.json': '.mcp.json',
      };

      let destPath: string;
      if (fileMappings[entry.name]) {
        destPath = path.join(destDir, fileMappings[entry.name]);
      } else {
        destPath = path.join(destDir, entry.name);
      }

      // Skip if exists and not --force
      if (fs.existsSync(destPath) && !force) {
        const rel = path.relative(destDir, destPath);
        skipped.push(rel);
        continue;
      }

      // Ensure parent dir exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      // Read, replace vars, write
      const content = fs.readFileSync(srcPath, 'utf-8');
      const processed = replaceVars(content, vars);
      fs.writeFileSync(destPath, processed, 'utf-8');

      // Make hooks executable
      if (destPath.endsWith('.py') || destPath.endsWith('.sh')) {
        fs.chmodSync(destPath, 0o755);
      }

      const rel = path.relative(destDir, destPath);
      created.push(rel);
    }
  }

  return { created, skipped };
}

// ─── Gitignore ───────────────────────────────────────────────────────────────

const GITIGNORE_ENTRIES = `
# Environment (credentials — NEVER commit)
.env
.env.*
!.env.example

# Mentu
.mentu/ledger.jsonl
.mentu/config.yaml
.mentu/sync-state.json
.mentu/active_commitment

# Ralph
.ralph/autopilot-state.json
.ralph/PROMPT.md
.ralph/logs/
.ralph/diagnostics/
.ralph/*.lock
.ralph/events-*.jsonl
.ralph/history.jsonl
.ralph/current-*
.ralph/loops.json
.ralph/agent/tasks.jsonl
.ralph/agent/tasks.jsonl.lock

# Review
.review-screenshots/
docs/evidence/
.claude/ralph-loop.local.md
`;

function updateGitignore(projectRoot: string): boolean {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    // Check if already has mentu entries
    if (content.includes('.mentu/ledger.jsonl')) {
      return false;
    }
    fs.appendFileSync(gitignorePath, GITIGNORE_ENTRIES, 'utf-8');
  } else {
    fs.writeFileSync(gitignorePath, GITIGNORE_ENTRIES.trimStart(), 'utf-8');
  }
  return true;
}

// ─── .env ────────────────────────────────────────────────────────────────────

function updateEnvFile(
  projectRoot: string,
  tokenVar: string,
  wsVar: string,
  workspaceId: string | null
): boolean {
  const envPath = path.join(projectRoot, '.env');
  let content = '';

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  let updated = false;

  if (!content.includes(tokenVar)) {
    content += `\n# Mentu\n${tokenVar}=""\n`;
    updated = true;
  }

  if (!content.includes(wsVar)) {
    const wsValue = workspaceId || '';
    content += `${wsVar}="${wsValue}"\n`;
    updated = true;
  } else if (workspaceId) {
    // Update existing ws var if it's empty
    const regex = new RegExp(`^${wsVar}="?"?\\s*"?$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${wsVar}="${workspaceId}"`);
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(envPath, content, 'utf-8');
  }
  return updated;
}

// ─── Settings.json Merge ─────────────────────────────────────────────────────

function mergeClaudeSettings(projectRoot: string): boolean {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  } else {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  }

  let changed = false;

  // Ensure hooks section
  if (!settings.hooks || typeof settings.hooks !== 'object') {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;

  // SessionStart hook
  const sessionStartHook = {
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/mentu_session_start.py',
      timeout: 15,
    }],
  };

  if (!hooks.SessionStart) {
    hooks.SessionStart = [];
  }
  const sessionHooks = hooks.SessionStart as Record<string, unknown>[];
  const hasSessionHook = sessionHooks.some((h) =>
    JSON.stringify(h).includes('mentu_session_start')
  );
  if (!hasSessionHook) {
    sessionHooks.push(sessionStartHook);
    changed = true;
  }

  // PostToolUse hooks (evidence capture + bridge to Ralph memories)
  const postToolHook = {
    matcher: 'Edit|Write',
    hooks: [
      {
        type: 'command',
        command: 'python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/mentu_post_tool.py',
        timeout: 15,
      },
      {
        type: 'command',
        command: 'python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/mentu_evidence_to_memory.py',
        timeout: 15,
      },
    ],
  };

  if (!hooks.PostToolUse) {
    hooks.PostToolUse = [];
  }
  const postHooks = hooks.PostToolUse as Record<string, unknown>[];
  const hasPostHook = postHooks.some((h) =>
    JSON.stringify(h).includes('mentu_post_tool')
  );
  if (!hasPostHook) {
    postHooks.push(postToolHook);
    changed = true;
  }

  // Ensure bridge hook is registered (may be missing from older installations)
  const hasBridgeHook = postHooks.some((h) =>
    JSON.stringify(h).includes('mentu_evidence_to_memory')
  );
  if (!hasBridgeHook) {
    const editWriteEntry = postHooks.find((h) =>
      JSON.stringify(h).includes('mentu_post_tool')
    ) as Record<string, unknown> | undefined;
    if (editWriteEntry && Array.isArray(editWriteEntry.hooks)) {
      editWriteEntry.hooks.push({
        type: 'command',
        command: 'python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/mentu_evidence_to_memory.py',
        timeout: 15,
      });
      changed = true;
    }
  }

  // Permissions
  if (!settings.permissions || typeof settings.permissions !== 'object') {
    settings.permissions = {};
  }
  const permissions = settings.permissions as Record<string, unknown>;
  if (!Array.isArray(permissions.allow)) {
    permissions.allow = [];
  }
  const allowList = permissions.allow as string[];
  if (!allowList.includes('Bash(mentu:*)')) {
    allowList.push('Bash(mentu:*)');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return changed;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function workspaceInit(options: WorkspaceInitOptions, json: boolean): Promise<void> {
  const projectRoot = process.cwd();
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  // 1. Validate — must be in a git repo
  try {
    execSync('git rev-parse --git-dir', { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    throw new MentuError('E_INVALID_OP', 'Not a git repository. Run this from a project root.');
  }

  // Check for existing .mentu/ unless --force
  const mentuDir = path.join(projectRoot, '.mentu');
  if (fs.existsSync(mentuDir) && !options.force) {
    throw new MentuError(
      'E_WORKSPACE_EXISTS',
      '.mentu/ already exists. Use --force to overwrite.'
    );
  }

  // 2. Auto-detect build command and port
  const buildCmd = options.buildCmd || detectBuildCommand(projectRoot);
  const port = options.port || detectPort(projectRoot);
  const actor = options.actor || `agent:claude-${options.name}`;

  // 3. Create cloud workspace (unless --skip-workspace)
  let workspaceId: string | null = null;

  if (!options.skipWorkspace) {
    if (!json) {
      console.log(`Creating cloud workspace "${options.name}"...`);
    }

    try {
      const result = execSync(
        `mentu workspace create "${options.name}" --json`,
        { cwd: projectRoot, encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const parsed = JSON.parse(result.trim());
      if (parsed.error) {
        // Non-fatal: workspace may already exist
        if (!json) {
          console.log(`  Warning: ${parsed.error}`);
          console.log('  Trying to connect to existing workspace...');
        }
        // Try to connect instead
        try {
          const connectResult = execSync(
            `mentu workspace connect "${options.name}" --json`,
            { cwd: projectRoot, encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
          );
          const connectParsed = JSON.parse(connectResult.trim());
          workspaceId = connectParsed.workspace?.id || null;
        } catch {
          // Non-fatal
        }
      } else {
        workspaceId = parsed.id || null;
      }
    } catch {
      if (!json) {
        console.log('  Warning: Could not create cloud workspace (are you logged in?)');
        console.log('  Run "mentu login" then "mentu workspace connect" later.');
      }
    }
  }

  // 4. Initialize .mentu/ via mentu init
  if (!json) {
    console.log('Initializing .mentu/ workspace...');
  }

  try {
    const initArgs = [
      'mentu init --force --silent',
      `--workspace "${options.name}"`,
      `--actor "${actor}"`,
    ].join(' ');

    execSync(initArgs, { cwd: projectRoot, encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
  } catch {
    // Fallback: create manually if mentu init fails (e.g., running from dev)
    fs.mkdirSync(mentuDir, { recursive: true });
    const ledgerPath = path.join(mentuDir, 'ledger.jsonl');
    if (!fs.existsSync(ledgerPath)) {
      fs.writeFileSync(ledgerPath, '', 'utf-8');
    }
  }

  // 5. Copy templates
  if (!json) {
    console.log('Copying workspace templates...');
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // From dist/commands/ or src/commands/ → package root → templates/workspace/
  const packageRoot = path.resolve(__dirname, '..', '..');
  const templateDir = path.join(packageRoot, 'templates', 'workspace');

  const templateVars: Record<string, string> = {
    PROJECT_NAME: options.name,
    PROJECT_TITLE: options.name.charAt(0).toUpperCase() + options.name.slice(1),
    WORKSPACE_ID: workspaceId || `\${${options.wsVar || 'MENTU_WORKSPACE_ID'}}`,
    ACTOR: actor,
    BUILD_CMD: buildCmd,
    COMPLETION_PROMISE: options.promise || 'COMPLETE',
    TOKEN_ENV_VAR: options.tokenVar || 'MENTU_API_TOKEN',
    WS_ENV_VAR: options.wsVar || 'MENTU_WORKSPACE_ID',
    PROJECT_DOMAINS: options.domains || 'localhost',
    DEV_PORT: port,
  };

  const templateResult = copyTemplates(templateDir, projectRoot, templateVars, !!options.force);
  created.push(...templateResult.created);
  skipped.push(...templateResult.skipped);

  // 6. Wire .claude/settings.json
  if (!json) {
    console.log('Wiring Claude Code settings...');
  }

  const settingsChanged = mergeClaudeSettings(projectRoot);
  if (settingsChanged) {
    updated.push('.claude/settings.json');
  }

  // 7. Create additional directories
  const extraDirs = [
    path.join(projectRoot, '.ralph', 'logs'),
    path.join(projectRoot, '.ralph', 'specs'),
    path.join(projectRoot, '.ralph', 'diagnostics', 'logs'),
    path.join(projectRoot, '.mentu', 'feature_lists'),
    path.join(projectRoot, 'docs', 'handoffs'),
  ];

  for (const dir of extraDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      const rel = path.relative(projectRoot, dir) + '/';
      created.push(rel);
    }
  }

  // 8. Update .env
  const envUpdated = updateEnvFile(
    projectRoot,
    options.tokenVar || 'MENTU_API_TOKEN',
    options.wsVar || 'MENTU_WORKSPACE_ID',
    workspaceId
  );
  if (envUpdated) {
    updated.push('.env');
  }

  // 9. Update .gitignore
  const gitignoreUpdated = updateGitignore(projectRoot);
  if (gitignoreUpdated) {
    updated.push('.gitignore');
  }

  // 10. Output result
  const result: WorkspaceInitOutput = {
    workspace_id: workspaceId,
    created,
    updated,
    skipped,
    project_root: projectRoot,
  };

  outputResult(result, json);
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerWorkspaceInitCommand(program: Command): void {
  program
    .command('workspace-init')
    .description('Initialize a complete Mentu + Ralph + Claude Code workspace')
    .requiredOption('--name <name>', 'Workspace name')
    .option('--actor <id>', 'Actor identity (default: agent:claude-{name})')
    .option('--build-cmd <cmd>', 'Build command (default: auto-detect)')
    .option('--promise <keyword>', 'Completion keyword', 'COMPLETE')
    .option('--domains <list>', 'Comma-separated domain list', 'localhost')
    .option('--port <number>', 'Dev server port (default: auto-detect)')
    .option('--token-var <env-var>', 'Token env var name', 'MENTU_API_TOKEN')
    .option('--ws-var <env-var>', 'Workspace ID env var name', 'MENTU_WORKSPACE_ID')
    .option('--skip-workspace', 'Skip cloud workspace creation')
    .option('--force', 'Overwrite existing files')
    .action(async (options: WorkspaceInitOptions) => {
      const json = program.opts().json || false;

      try {
        await workspaceInit(options, json);
      } catch (err) {
        if (err instanceof MentuError) {
          outputError(err, json);
        } else {
          const error = new MentuError(
            'E_INVALID_OP',
            err instanceof Error ? err.message : 'Unknown error'
          );
          outputError(error, json);
        }
      }
    });
}
