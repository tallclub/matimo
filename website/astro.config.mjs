import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { gaHead } from './src/analytics.mjs';

export default defineConfig({
  site: 'https://matimo.dev',
  integrations: [
    starlight({
      plugins: [starlightLinksValidator({ errorOnRelativeLinks: false })],
      title: 'Matimo',
      description:
        'Open-source tool governance for AI agents: risk-checked calls, human approval for risky ones, and a tamper-evident audit log. TypeScript and Python. MIT licensed.',
      logo: { src: './src/assets/logo.png', alt: 'Matimo' },
      favicon: '/favicon.png',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/tallclub/matimo' },
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/3JPt4mxWDV' },
      ],
      head: [
        ...gaHead(process.env.PUBLIC_GA_ID),
        { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'Matimo for LLMs (llms.txt)' } },
        { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', href: '/llms-full.txt', title: 'Matimo full documentation for LLMs' } },
      ],
      editLink: { baseUrl: 'https://github.com/tallclub/matimo/edit/main/website/' },
      customCss: [
        '@fontsource-variable/inter',
        '@fontsource-variable/jetbrains-mono',
        './src/styles/theme.css',
      ],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
      },
      sidebar: [
        {
          label: 'Architecture',
          items: [
            { label: 'System overview', slug: 'docs/architecture/overview' },
            { label: 'OAuth2 and credentials', slug: 'docs/architecture/oauth' },
          ],
        },
        {
          label: 'Start here',
          items: [
            { label: 'Overview', slug: 'docs' },
            { label: 'Why Matimo', slug: 'docs/why-matimo' },
            { label: 'Installation', slug: 'docs/getting-started/installation' },
            { label: 'Quick start', slug: 'docs/getting-started/quick-start' },
            { label: 'Your first tool', slug: 'docs/getting-started/your-first-tool' },
          ],
        },
        {
          label: 'Use cases',
          items: [
            { label: 'Overview', slug: 'docs/use-cases' },
            { label: 'Require approval for risky calls', slug: 'docs/use-cases/approve-risky-calls' },
            { label: 'Serve tools over MCP', slug: 'docs/use-cases/serve-tools-over-mcp' },
            { label: 'Let an agent write tools', slug: 'docs/use-cases/agent-writes-tools' },
          ],
        },
        { label: 'Guides', items: [{ autogenerate: { directory: 'docs/user-guide' } }] },
        { label: 'Framework integrations', items: [{ autogenerate: { directory: 'docs/framework-integrations' } }] },
        { label: 'MCP', items: [{ label: 'MCP server', slug: 'docs/mcp-server' }, { label: 'Contributor guides', items: [{ autogenerate: { directory: 'docs/mcp' } }] }] },
        { label: 'Tool development', items: [{ autogenerate: { directory: 'docs/tool-development' } }] },
        { label: 'Skills', items: [{ autogenerate: { directory: 'docs/skills' } }] },
        { label: 'API reference', items: [{ autogenerate: { directory: 'docs/api-reference' } }] },
        {
          label: 'Resources',
          items: [
            { label: 'FAQ', slug: 'docs/troubleshooting/faq' },
            { label: 'Composio catalog', slug: 'docs/composio' },
            { label: 'Releases', slug: 'docs/releases' },
            { label: 'Roadmap', slug: 'docs/roadmap' },
            { label: 'Commit guidelines', slug: 'docs/community/commit-guidelines' },
            { label: 'Matimo 0.2.0 release post', slug: 'docs/blog/2026-10-01-matimo-0-2-0-tool-governance' },
          ],
        },
      ],
    }),
  ],
});
