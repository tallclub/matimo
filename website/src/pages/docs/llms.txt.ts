import { allSlugs, page, SITE } from '../../lib-llms';

export function GET() {
  const lines = allSlugs()
    .filter((s) => s !== 'index')
    .map(page)
    .map((p) => `- [${p.title}](${SITE}/docs/${p.slug}.md)`);
  const body = `# Matimo documentation
> Index of every page in the Matimo OSS docs (${SITE}/docs/). Summary and guidance for AI agents: ${SITE}/llms.txt . Core pages concatenated in one file: ${SITE}/llms-full.txt .

## Pages (raw Markdown)

${lines.join('\n')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
