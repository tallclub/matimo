// Crawlers often probe /sitemap.xml first. The sitemap integration writes sitemap-index.xml, so mirror it here.
export const GET = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://matimo.dev/sitemap-0.xml</loc></sitemap></sitemapindex>\n`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
