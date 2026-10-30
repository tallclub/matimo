import { allSlugs, page } from '../../lib-llms';

// Raw Markdown for every docs page: /docs/mcp-server.md, /docs/api-reference/sdk.md, /docs/index.md
export function getStaticPaths() {
  return allSlugs().map((slug) => ({ params: { slug } }));
}

export function GET({ params }: { params: { slug: string } }) {
  const p = page(params.slug);
  return new Response(`# ${p.title}\n\nSource: ${p.url}\n\n${p.body}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
