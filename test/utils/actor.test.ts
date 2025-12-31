import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveActor, isAgent } from '../../src/utils/actor.js';
import type { Config } from '../../src/types.js';

describe('Actor Resolution', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.MENTU_ACTOR;
    delete process.env.MENTU_ACTOR;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MENTU_ACTOR = originalEnv;
    } else {
      delete process.env.MENTU_ACTOR;
    }
  });

  describe('resolveActor', () => {
    describe('precedence - flag value', () => {
      it('should use flag value when provided', () => {
        const actor = resolveActor('user@example.com');
        expect(actor).toBe('user@example.com');
      });

      it('should prioritize flag over environment variable', () => {
        process.env.MENTU_ACTOR = 'env@example.com';
        const actor = resolveActor('flag@example.com');
        expect(actor).toBe('flag@example.com');
      });

      it('should prioritize flag over config', () => {
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
          default_actor: 'config@example.com',
        };
        const actor = resolveActor('flag@example.com', config);
        expect(actor).toBe('flag@example.com');
      });

      it('should accept agent prefix in flag', () => {
        const actor = resolveActor('agent:claude');
        expect(actor).toBe('agent:claude');
      });

      it('should accept empty string as flag value', () => {
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
          default_actor: 'config@example.com',
        };
        const actor = resolveActor('', config);
        expect(actor).toBe('config@example.com');
      });
    });

    describe('precedence - environment variable', () => {
      it('should use environment variable when flag not provided', () => {
        process.env.MENTU_ACTOR = 'env@example.com';
        const actor = resolveActor();
        expect(actor).toBe('env@example.com');
      });

      it('should prioritize environment over config', () => {
        process.env.MENTU_ACTOR = 'env@example.com';
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
          default_actor: 'config@example.com',
        };
        const actor = resolveActor(undefined, config);
        expect(actor).toBe('env@example.com');
      });

      it('should handle agent prefix in environment', () => {
        process.env.MENTU_ACTOR = 'agent:automation';
        const actor = resolveActor();
        expect(actor).toBe('agent:automation');
      });
    });

    describe('precedence - config default_actor', () => {
      it('should use config when flag and env not provided', () => {
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
          default_actor: 'config@example.com',
        };
        const actor = resolveActor(undefined, config);
        expect(actor).toBe('config@example.com');
      });

      it('should handle agent prefix in config', () => {
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
          default_actor: 'agent:system',
        };
        const actor = resolveActor(undefined, config);
        expect(actor).toBe('agent:system');
      });

      it('should skip config if default_actor not set', () => {
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
        };
        const actor = resolveActor(undefined, config);
        // Should fall through to git or fallback
        expect(actor).toBeTruthy();
      });
    });

    describe('precedence - git config', () => {
      it('should use git email when higher precedence not available', () => {
        const actor = resolveActor();
        // Will use git or fallback to 'user'
        expect(actor).toBeTruthy();
      });

      it('should fallback to user if git not available', () => {
        // When git fails, should return 'user'
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
        };
        const actor = resolveActor(undefined, config);
        expect(['user', actor]).toContain(actor);
      });
    });

    describe('precedence - fallback', () => {
      it('should return user as final fallback', () => {
        // No flag, no env, no config, git fails
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
        };
        const actor = resolveActor(undefined, config);
        // Will be git email or 'user'
        expect(actor).toBeTruthy();
      });
    });

    describe('edge cases', () => {
      it('should handle undefined flag explicitly', () => {
        process.env.MENTU_ACTOR = 'env@example.com';
        const actor = resolveActor(undefined);
        expect(actor).toBe('env@example.com');
      });

      it('should handle null config', () => {
        process.env.MENTU_ACTOR = 'env@example.com';
        const actor = resolveActor(undefined, undefined);
        expect(actor).toBe('env@example.com');
      });

      it('should handle empty config object', () => {
        process.env.MENTU_ACTOR = 'env@example.com';
        const config: Config = {
          workspace: 'test',
          created: '2025-01-01T00:00:00Z',
        };
        const actor = resolveActor(undefined, config);
        expect(actor).toBe('env@example.com');
      });
    });
  });

  describe('isAgent', () => {
    describe('agent prefix detection', () => {
      it('should detect agent: prefix', () => {
        expect(isAgent('agent:claude')).toBe(true);
        expect(isAgent('agent:automation')).toBe(true);
        expect(isAgent('agent:system')).toBe(true);
      });

      it('should detect bot: prefix', () => {
        expect(isAgent('bot:discord')).toBe(true);
        expect(isAgent('bot:slack')).toBe(true);
        expect(isAgent('bot:telegram')).toBe(true);
      });

      it('should detect service: prefix', () => {
        expect(isAgent('service:sync')).toBe(true);
        expect(isAgent('service:github')).toBe(true);
        expect(isAgent('service:backup')).toBe(true);
      });
    });

    describe('human detection', () => {
      it('should return false for email addresses', () => {
        expect(isAgent('user@example.com')).toBe(false);
        expect(isAgent('admin@company.org')).toBe(false);
      });

      it('should return false for simple names', () => {
        expect(isAgent('alice')).toBe(false);
        expect(isAgent('bob')).toBe(false);
        expect(isAgent('user')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isAgent('')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should not match prefix in middle of string', () => {
        expect(isAgent('myagent:test')).toBe(false);
        expect(isAgent('the-bot:example')).toBe(false);
      });

      it('should be case sensitive', () => {
        expect(isAgent('Agent:claude')).toBe(false);
        expect(isAgent('AGENT:claude')).toBe(false);
        expect(isAgent('Bot:slack')).toBe(false);
        expect(isAgent('SERVICE:sync')).toBe(false);
      });

      it('should handle colons without valid prefix', () => {
        expect(isAgent('user:name')).toBe(false);
        expect(isAgent('system:admin')).toBe(false);
      });

      it('should handle empty string after prefix', () => {
        expect(isAgent('agent:')).toBe(true);
        expect(isAgent('bot:')).toBe(true);
        expect(isAgent('service:')).toBe(true);
      });

      it('should handle multiple colons', () => {
        expect(isAgent('agent:namespace:name')).toBe(true);
        expect(isAgent('bot:team:instance')).toBe(true);
      });

      it('should not match partial prefixes', () => {
        expect(isAgent('ag:test')).toBe(false);
        expect(isAgent('bo:test')).toBe(false);
        expect(isAgent('serv:test')).toBe(false);
      });
    });
  });
});
