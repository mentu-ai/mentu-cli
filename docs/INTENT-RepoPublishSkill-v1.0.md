---
id: INTENT-RepoPublishSkill-v1.0
type: intent
origin: architect
created: 2026-01-02
architect:
  actor: agent:claude-architect
  session: mentu-bridge-publication
  context: Post-publication of mentu-bridge, need to standardize publishing across ecosystem
---

# Strategic Intent: Repo-Publish Skill

## What

Create a reusable publishing skill that standardizes how repositories are prepared and published to GitHub across the entire Mentu ecosystem. The skill should be available in all repositories under Workspaces governance and invokable via a simple command.

## Why

During the mentu-bridge publication, we established a successful pattern:
- Pre-publish audits (secrets, cruft, documentation review)
- Identity enforcement (always publish as owner, never as agent)
- Organization routing (mentu-ai, talisman-engineering, rashidazarang)
- Post-publish verification and Mentu ledger recording

This pattern should be codified once and propagated everywhere. Without standardization:
- Each publication requires rediscovering best practices
- Inconsistent README formats across repositories
- Risk of secrets or cruft leaking to public repos
- No audit trail of publications

## Constraints

- Must NOT store any secrets or credentials in skill files
- Must NOT auto-push without human review of the final state
- Must respect existing .mentu folders (read manifest, never overwrite)
- Must work in repositories that don't have mentu-ai as a dependency
- Must be lightweight (no npm dependencies in the skill itself)
- Organization routing must be explicit, never guessed

## Expected Outcome

From any repository in the Workspaces ecosystem, an agent or human can invoke:

```
/repo-publish <repo-name>
```

And receive:
1. Pre-flight checklist (secrets audit, documentation review, cruft removal)
2. Organization selection guidance based on repo type
3. Standard commands for GitHub repo creation
4. Post-publish verification steps
5. Mentu ledger recording of the publication

All publications follow the same quality bar established with mentu-bridge.

## Open Questions

- Should the skill auto-detect organization from manifest.yaml metadata?
- Should there be a dry-run mode that shows what would be published without pushing?
- How should the skill handle repos that are already published but need updates?
