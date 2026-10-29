// website/public/llms.txt is the source of truth. This derives the two legacy copies
// (repo-root llms.txt with repo-relative links, docs/llms.txt with docs.matimo.dev links)
// until the Jekyll docs are retired. Run: node scripts/sync-llms.mjs
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');
const map = {
  'getting-started/quick-start': 'getting-started/QUICK_START',
  'getting-started/your-first-tool': 'getting-started/YOUR_FIRST_TOOL',
  'api-reference/sdk': 'api-reference/SDK',
  'api-reference/policy-and-lifecycle': 'api-reference/POLICY_AND_LIFECYCLE',
  'api-reference/meta-tools': 'api-reference/META_TOOLS',
  'api-reference/approval-system': 'api-reference/APPROVAL-SYSTEM',
  'tool-development/tool-specification': 'tool-development/TOOL_SPECIFICATION',
  'tool-development/yaml-tools': 'tool-development/YAML_TOOLS',
  'tool-development/adding-tools': 'tool-development/ADDING_TOOLS',
  'mcp-server': 'MCP',
  'framework-integrations/langchain': 'framework-integrations/LANGCHAIN',
  'framework-integrations/crewai': 'framework-integrations/CREWAI',
  'framework-integrations/agno': 'framework-integrations/AGNO',
  'skills/skills': 'skills/SKILLS',
  'architecture/overview': 'architecture/OVERVIEW',
  releases: 'RELEASES',
  roadmap: 'ROADMAP',
  composio: 'COMPOSIO',
  'why-matimo': 'why-matimo',
  'blog/2026-10-01-matimo-0-2-0-tool-governance': 'blog/2026-10-01-matimo-0-2-0-tool-governance',
};
const GH = 'https://github.com/tallclub/matimo/blob/main/';
const out = (fn) => src.replace(/https:\/\/matimo\.dev\/docs\/([a-z0-9\-\/]+?)\/(#[a-z0-9\-]+)?(?=[)\s])/g, (m, slug, hash = '') => (map[slug] ? fn(map[slug], hash) : m));
// docs.matimo.dev (Jekyll, live until cutover)
let docs = out((p, h) => `https://docs.matimo.dev/${p}${h}`);
// The two machine-readable files do not exist on the Jekyll site; point them at matimo.dev.
fs.writeFileSync(new URL('../../docs/llms.txt', import.meta.url), docs);
// repo root: relative links into the repo
let root = out((p, h) => `${GH.replace(/^.*$/, '')}./docs/${p}.md${h}`);
root = root.replaceAll(GH, './');
fs.writeFileSync(new URL('../../llms.txt', import.meta.url), root);
console.log('synced docs/llms.txt and llms.txt');
