// Builds the docs.matimo.dev -> matimo.dev/docs redirect map from the old Jekyll file list.
// Run from website/ after `pnpm build` (targets are checked against dist/).
//   node scripts/gen-redirects.mjs
// Writes redirects/docs-matimo-dev.csv (for a registrar or CDN redirect rule) and
// redirects/stub/{index.html,404.html} (a client-side fallback for a GitHub Pages stub site).
import { readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const OLD = join('..', 'docs');
const DIST = 'dist';
const NEW = 'https://matimo.dev';

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (['node_modules', '_site', 'assets', 'notebooks'].includes(f)) return [];
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });

// Old pages whose name changed, or that live at a different depth on the new site.
const special = {
  'MCP.md': '/docs/mcp-server/',
  'index.md': '/docs/',
  'mcp/INDEX.md': '/docs/mcp/',
  'mcp/QUICK_REFERENCE.md': '/docs/mcp/quick-reference/',
  'mcp/SETUP_GUIDE.md': '/docs/mcp/setup-guide/',
  'skills/TFIDF_SEMANTIC_SEARCH.md': '/docs/skills/tfidf-semantic-search/',
};

const slug = (s) => s.replace(/\.md$/, '').replace(/_/g, '-').toLowerCase();
const exists = (p) => existsSync(join(DIST, p.replace(/^\//, ''), 'index.html'));

const rows = [];
const unmapped = [];
for (const file of walk(OLD)) {
  const rel = relative(OLD, file).replace(/\\/g, '/');
  if (rel === 'llms.txt') continue;
  const target = special[rel] ?? '/docs/' + slug(rel) + '/';
  const base = '/' + rel.replace(/\.md$/, '');
  if (!exists(target)) {
    unmapped.push(rel);
    continue;
  }
  // Jekyll serves pages as NAME.html; also accept the extensionless and trailing-slash forms.
  const olds = rel === 'index.md' ? ['/', '/index.html'] : [base + '.html', base, base + '/'];
  for (const o of olds) rows.push([o, target]);
}

const fallback = '/docs/';
mkdirSync('redirects/stub', { recursive: true });
writeFileSync(
  'redirects/docs-matimo-dev.csv',
  'source_path,target_url,status\n' +
    rows.map(([s, t]) => `${s},${NEW}${t},301`).join('\n') +
    '\n',
);

// Client-side fallback: GitHub Pages cannot send a 301, so the stub serves the same page for every
// path (404.html) and redirects by lookup, falling back to the docs home. Search engines follow the
// meta refresh and canonical link.
const lower = Object.fromEntries(rows.map(([s, t]) => [s.toLowerCase().replace(/\/$/, '') || '/', t]));
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Matimo docs have moved</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${NEW}${fallback}">
<meta http-equiv="refresh" content="3;url=${NEW}${fallback}">
<style>body{font:16px/1.5 system-ui,sans-serif;background:#08080b;color:#ececf1;margin:3rem auto;max-width:36rem;padding:0 1rem}a{color:#ff7aa8}</style>
</head>
<body>
<h1>Matimo docs have moved</h1>
<p>The documentation now lives at <a id="go" href="${NEW}${fallback}">${NEW}/docs/</a>. You will be redirected.</p>
<script>
(function () {
  var map = ${JSON.stringify(lower)};
  var p = location.pathname.toLowerCase().replace(/\\/$/, '') || '/';
  var t = map[p] || ${JSON.stringify(fallback)};
  var url = ${JSON.stringify(NEW)} + t + location.hash;
  document.getElementById('go').href = url;
  location.replace(url);
})();
</script>
</body>
</html>
`;
writeFileSync('redirects/stub/404.html', html);
writeFileSync('redirects/stub/index.html', html);
writeFileSync('redirects/stub/CNAME', 'docs.matimo.dev\n');

console.log(`mapped ${rows.length} URLs from ${walk(OLD).length - 1 - unmapped.length} pages`);
console.log('no new page (fall back to /docs/):');
for (const u of unmapped) console.log('  ' + u);
