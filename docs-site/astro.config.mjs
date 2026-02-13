import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.mentu.dev',
  integrations: [
    starlight({
      title: 'Mentu Docs',
      description: 'Documentation for the Mentu commitment ledger — an append-only protocol where commitments require evidence.',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mentu-ai' },
      ],
      editLink: {
        baseUrl: 'https://github.com/mentu-ai/mentu-docs/edit/main/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Quickstart', slug: 'quickstart' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'How Mentu Works', slug: 'concepts/how-mentu-works' },
            { label: 'State Machine', slug: 'concepts/state-machine' },
            { label: 'The Three Rules', slug: 'concepts/three-rules' },
            { label: 'Glossary', slug: 'concepts/glossary' },
          ],
        },
        {
          label: 'MCP Server',
          items: [
            { label: 'Overview', slug: 'mcp-server/overview' },
            { label: 'Configuration', slug: 'mcp-server/configuration' },
            { label: 'Tools', slug: 'mcp-server/tools' },
            { label: 'Resources', slug: 'mcp-server/resources' },
            { label: 'Prompts', slug: 'mcp-server/prompts' },
          ],
        },
        {
          label: 'Plugin',
          items: [
            { label: 'Overview', slug: 'plugin/overview' },
            { label: 'Installation', slug: 'plugin/installation' },
            { label: 'Commands', slug: 'plugin/commands' },
            { label: 'Agents', slug: 'plugin/agents' },
            { label: 'Autopilot', slug: 'plugin/autopilot' },
          ],
        },
        {
          label: 'SDK',
          items: [
            { label: 'Bug Reporter', slug: 'sdk/bug-reporter' },
            { label: 'Browser Widget', slug: 'sdk/browser-widget' },
            { label: 'Callbacks', slug: 'sdk/callbacks' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Authentication', slug: 'api/authentication' },
            { label: 'Operations', slug: 'api/operations' },
            { label: 'Commitments', slug: 'api/commitments' },
            { label: 'Memories', slug: 'api/memories' },
            { label: 'Status', slug: 'api/status' },
            { label: 'Errors', slug: 'api/errors' },
          ],
        },
        {
          label: 'Dashboard',
          items: [
            { label: 'Overview', slug: 'dashboard/overview' },
            { label: 'Setup', slug: 'dashboard/setup' },
            { label: 'Features', slug: 'dashboard/features' },
          ],
        },
        {
          label: 'Companion',
          items: [
            { label: 'Overview', slug: 'companion/overview' },
            { label: 'Setup', slug: 'companion/setup' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'First Bug Fix', slug: 'guides/first-bug-fix' },
            { label: 'GitHub Integration', slug: 'guides/github-integration' },
            { label: 'Multi-Workspace', slug: 'guides/multi-workspace' },
            { label: 'Custom Validators', slug: 'guides/custom-validators' },
          ],
        },
        {
          label: 'Protocol',
          items: [
            { label: 'Overview', slug: 'protocol/overview' },
            { label: 'Operation Envelope', slug: 'protocol/operation-envelope' },
            { label: 'State Transitions', slug: 'protocol/state-transitions' },
            { label: 'Genesis Key', slug: 'protocol/genesis-key' },
          ],
        },
      ],
    }),
  ],
});
