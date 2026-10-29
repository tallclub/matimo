# docs.matimo.dev redirects

`docs.matimo.dev` served the old Jekyll site. After cutover it must send visitors to the matching `matimo.dev/docs/*` page.
GitHub Pages cannot send an HTTP 301, so pick one:

1. **Edge redirect (preferred).** If DNS is on Cloudflare or a registrar with redirect rules, import
   `docs-matimo-dev.csv` (source path, target URL, 301). Add a catch-all from `docs.matimo.dev/*` to `https://matimo.dev/docs/`.
2. **Pages stub.** Publish `stub/` as its own small repo with Pages and the custom domain `docs.matimo.dev`
   (the `CNAME` file is included). Every path serves the same page, which redirects by lookup, falls back to
   the docs home, and carries a meta refresh and canonical link. This is a client-side redirect, so it passes
   less link equity than a 301.

Regenerate after docs change: `pnpm build && node scripts/gen-redirects.mjs`.

Nine old pages have no new equivalent (compliance snapshots, the security audit, the competitive analysis,
the Python SDK plan and two MCP maintenance pages). They fall back to `/docs/`.

One site can hold only one custom domain on GitHub Pages. `matimo.dev` goes on this repo's Pages deployment, so
`docs.matimo.dev` must be removed from the repo's Pages settings and `docs/CNAME` deleted when the Jekyll `docs/` is retired.
