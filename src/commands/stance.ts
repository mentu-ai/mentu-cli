import type { Command } from 'commander';
import {
  getStance,
  buildStancePrompt,
  buildStanceReminder,
  getCrossRoleRule,
  DOMAIN_OWNERS,
  type ValidationDomain,
} from '../utils/stance.js';
import { isValidAuthorType, type AuthorType } from '../utils/author.js';

function outputResult(result: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (typeof result === 'string') {
    console.log(result);
  }
}

export function registerStanceCommand(program: Command): void {
  const stanceCmd = program
    .command('stance <role>')
    .description('Show cognitive stance for an author type (architect, auditor, executor)')
    .option('--failure <domain>', 'Show what to do when a domain fails (intent, safety, technical)')
    .option('--prompt', 'Output full prompt injection section')
    .option('--reminder', 'Output minimal reminder line')
    .action((role: string, options: { failure?: string; prompt?: boolean; reminder?: boolean }) => {
      const json = program.opts().json || false;

      // Validate role
      if (!isValidAuthorType(role)) {
        if (json) {
          console.log(JSON.stringify({ error: `Invalid role: ${role}. Use architect, auditor, or executor.` }));
        } else {
          console.error(`Invalid role: ${role}`);
          console.error('Valid roles: architect, auditor, executor');
        }
        process.exit(1);
      }

      const authorType = role as AuthorType;
      const stance = getStance(authorType);

      // --failure: Show cross-role guidance
      if (options.failure) {
        const domain = options.failure as ValidationDomain;
        if (!['intent', 'safety', 'technical'].includes(domain)) {
          if (json) {
            console.log(JSON.stringify({ error: `Invalid domain: ${domain}. Use intent, safety, or technical.` }));
          } else {
            console.error(`Invalid domain: ${domain}`);
            console.error('Valid domains: intent, safety, technical');
          }
          process.exit(1);
        }

        const domainOwner = DOMAIN_OWNERS[domain];
        const isOwned = domainOwner === authorType;

        if (isOwned) {
          // It's your failure
          const stanceText = stance[`when_${domain}_fails` as keyof typeof stance] as string;
          if (json) {
            outputResult({
              role: authorType,
              failure_domain: domain,
              is_owned: true,
              stance: stanceText,
              action: `fix_${domain}_issue`,
            }, json);
          } else {
            console.log(`## ${domain.toUpperCase()} Failure (YOUR DOMAIN)\n`);
            console.log(stanceText);
            console.log(`\nAction: Fix it. Don't explain.`);
          }
        } else {
          // Cross-role failure
          const rule = getCrossRoleRule(authorType, domain);
          if (json) {
            outputResult({
              role: authorType,
              failure_domain: domain,
              is_owned: false,
              domain_owner: domainOwner,
              stance: rule?.stance || stance[`when_${domain}_fails` as keyof typeof stance],
              action: rule?.action || 'consult_responsible_role',
            }, json);
          } else {
            console.log(`## ${domain.toUpperCase()} Failure (owned by ${domainOwner})\n`);
            console.log(rule?.stance || stance[`when_${domain}_fails` as keyof typeof stance]);
            console.log(`\nAction: ${rule?.action || 'Consult the responsible role'}`);
          }
        }
        return;
      }

      // --prompt: Full prompt injection
      if (options.prompt) {
        outputResult(buildStancePrompt(authorType), json);
        return;
      }

      // --reminder: Minimal one-liner
      if (options.reminder) {
        outputResult(buildStanceReminder(authorType), json);
        return;
      }

      // Default: Show stance overview
      if (json) {
        outputResult({
          role: authorType,
          owns: stance.owns,
          mantra: stance.mantra,
          when_intent_fails: stance.when_intent_fails,
          when_safety_fails: stance.when_safety_fails,
          when_technical_fails: stance.when_technical_fails,
        }, json);
      } else {
        console.log(`## ${authorType.toUpperCase()} Cognitive Stance\n`);
        console.log(`**Owns:** ${stance.owns}\n`);
        console.log(`**Mantra:**`);
        console.log(`> ${stance.mantra.split('\n').join('\n> ')}\n`);
        console.log(`**When failures occur:**`);
        console.log(`- Intent: ${stance.when_intent_fails.split('\n')[0]}`);
        console.log(`- Safety: ${stance.when_safety_fails.split('\n')[0]}`);
        console.log(`- Technical: ${stance.when_technical_fails.split('\n')[0]}`);
      }
    });
}
