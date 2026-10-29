import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Adds schema.org TechArticle JSON-LD to every docs page so answer engines can read title, summary and publisher.
export const onRequest = defineRouteMiddleware((context) => {
  const { entry, head } = context.locals.starlightRoute;
  const { title, description } = entry.data;
  const url = new URL(context.url.pathname, context.site).href;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    ...(description ? { description } : {}),
    url,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Matimo OSS documentation', url: 'https://matimo.dev/docs/' },
    publisher: { '@type': 'Organization', name: 'roaiq Technologies', url: 'https://roaiq.com' },
  };
  head.push({ tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(ld) });
});
