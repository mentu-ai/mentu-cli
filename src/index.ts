#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerCaptureCommand } from './commands/capture.js';
import { registerCommitCommand } from './commands/commit.js';
import { registerClaimCommand } from './commands/claim.js';
import { registerReleaseCommand } from './commands/release.js';
import { registerCloseCommand } from './commands/close.js';
import { registerAnnotateCommand } from './commands/annotate.js';
import { registerStatusCommand } from './commands/status.js';
import { registerLogCommand } from './commands/log.js';
import { registerShowCommand } from './commands/show.js';
import { registerConfigCommand } from './commands/config.js';
import { registerLinkCommand } from './commands/link.js';
import { registerGitHubLinkCommand } from './commands/github-link.js';
import { registerPushCommand } from './commands/push.js';
import { registerPullCommand } from './commands/pull.js';
import { registerServeCommand } from './commands/serve.js';
import { registerApiKeyCommand } from './commands/api-key.js';
import { registerLoginCommand } from './commands/login.js';
import { registerLogoutCommand } from './commands/logout.js';
import { registerWorkspaceCommand } from './commands/workspace.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerUnlinkCommand } from './commands/unlink.js';
import { registerActorCommand } from './commands/actor.js';
import { registerInitClaudeCommand } from './commands/init-claude.js';
import { registerClaudeStatusCommand } from './commands/claude-status.js';
import { registerTaskCommand } from './commands/task.js';
import { registerDismissCommand } from './commands/dismiss.js';
import { registerTriageCommand } from './commands/triage.js';
import { registerListCommand } from './commands/list.js';
import { registerSubmitCommand } from './commands/submit.js';
import { registerApproveCommand } from './commands/approve.js';
import { registerReopenCommand } from './commands/reopen.js';
import { registerReviewQueueCommand } from './commands/review-queue.js';
import { registerSearchCommand } from './commands/search.js';
import { registerAutopilotCommand } from './commands/autopilot.js';
import { getMentuVersion } from './utils/version.js';

const program = new Command();

program
  .name('mentu')
  .description('The Commitment Ledger')
  .version(getMentuVersion())
  .option('--json', 'Output as JSON')
  .option('--actor <id>', 'Override actor identity');

// Bridge global --actor into existing resolveActor() behavior.
program.hook('preAction', (thisCommand: Command) => {
  const { actor } = thisCommand.opts<{ actor?: string }>();
  if (actor) {
    process.env.MENTU_ACTOR = actor;
  }
});

// Register all commands
registerInitCommand(program);
registerCaptureCommand(program);
registerCommitCommand(program);
registerClaimCommand(program);
registerReleaseCommand(program);
registerCloseCommand(program);
registerAnnotateCommand(program);
registerStatusCommand(program);
registerLogCommand(program);
registerShowCommand(program);
registerConfigCommand(program);
registerLinkCommand(program);
registerGitHubLinkCommand(program);
registerPushCommand(program);
registerPullCommand(program);
registerServeCommand(program);
registerApiKeyCommand(program);
registerLoginCommand(program);
registerLogoutCommand(program);
registerWorkspaceCommand(program);
registerSyncCommand(program);
registerUnlinkCommand(program);
registerActorCommand(program);
registerInitClaudeCommand(program);
registerClaudeStatusCommand(program);
registerTaskCommand(program);
registerDismissCommand(program);
registerTriageCommand(program);
registerListCommand(program);
registerSubmitCommand(program);
registerApproveCommand(program);
registerReopenCommand(program);
registerReviewQueueCommand(program);
registerSearchCommand(program);
registerAutopilotCommand(program);

program.parse();
