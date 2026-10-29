// Shared by the llms-full.txt and docs/llms.txt endpoints. Reads the docs markdown at build time
// so the machine-readable copy can never drift from the published pages.
const files = import.meta.glob('/src/content/docs/docs/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const SITE = 'https://matimo.dev';

// Order matters: this is the reading order an LLM sees in llms-full.txt.
export const CORE = [
  'why-matimo',
  'getting-started/installation',
  'getting-started/quick-start',
  'getting-started/your-first-tool',
  'api-reference/sdk',
  'api-reference/policy-and-lifecycle',
  'api-reference/approval-system',
  'api-reference/meta-tools',
  'mcp-server',
  'skills/skills',
  'tool-development/tool-specification',
  'tool-development/yaml-tools',
  'user-guide/authentication',
  'user-guide/sdk-patterns',
  'user-guide/tool-discovery',
  'framework-integrations/langchain',
  'framework-integrations/crewai',
  'framework-integrations/agno',
  'composio',
  'blog/2026-10-01-matimo-0-2-0-tool-governance',
  'troubleshooting/faq',
];

export function page(slug: string) {
  const raw = files[`/src/content/docs/docs/${slug}.md`];
  if (raw === undefined) throw new Error(`llms: missing docs page ${slug}`);
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = m ? m[1] : '';
  const title = (fm.match(/^title:\s*["']?(.*?)["']?\s*$/m) || [, slug])[1];
  const body = m ? raw.slice(m[0].length) : raw;
  // Point in-page doc links at the raw Markdown twins so an agent following a link stays in plain text.
  const md = body
    .trim()
    .replace(/\]\(\/docs\/([a-z0-9\-\/]+?)\/?(#[^)]*)?\)/g, (m, p, h = '') =>
      files[`/src/content/docs/docs/${p}.md`] === undefined ? m : `](${SITE}/docs/${p}.md${h})`,
    );
  return { slug, title, body: md, url: `${SITE}/docs/${slug}/` };
}

export function allSlugs() {
  return Object.keys(files)
    .map((k) => k.replace('/src/content/docs/docs/', '').replace(/\.md$/, ''))
    .sort();
}
