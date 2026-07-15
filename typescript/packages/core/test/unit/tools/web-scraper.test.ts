import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { ToolLoader } from '../../../src/core/tool-loader';
import type { Parameter } from '../../../src/core/types';
import { MatimoError } from '../../../src/errors/matimo-error';
import webScraperTool, {
  isSuccessStatus,
  isRobotsOkStatus,
} from '../../../tools/web_scraper/web_scraper';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function htmlResponse(
  html: string,
  overrides: Partial<{
    status: number;
    headers: Record<string, string>;
    responseUrl: string;
  }> = {}
) {
  return {
    data: html,
    status: overrides.status ?? 200,
    headers: overrides.headers ?? { 'content-type': 'text/html; charset=utf-8' },
    request: { res: { responseUrl: overrides.responseUrl } },
  };
}

const ARTICLE_BODY = `
      <p>This is the first paragraph of a genuinely long and substantive piece of writing
      that Readability's heuristics should recognize as the main article content, since it
      needs enough text density and paragraph structure to beat out the boilerplate nav and
      footer sections that surround it in the page.</p>
      <p>Here is a second paragraph continuing the same thought, with a
      <a href="https://example.com/ref">reference link</a> included inline, and more
      substantive prose to ensure Readability's scoring favors this block of content over
      the surrounding chrome elements on the page.</p>
      <p>And a third paragraph for good measure, further building out the article body so
      that automatic content extraction confidently identifies this as the primary content
      region of the document rather than any of the navigational boilerplate.</p>`;

function articlePage(title: string, links: string[] = []): string {
  const linkTags = links.map((href) => `<a href="${href}">link to ${href}</a>`).join('\n');
  return `
<!DOCTYPE html>
<html>
  <head><title>${title}</title></head>
  <body>
    <nav>${linkTags}</nav>
    <article>
      <h1>${title}</h1>
      <p class="byline">By Jane Doe</p>
      ${ARTICLE_BODY}
    </article>
    <footer>Copyright 2024 Example Corp.</footer>
  </body>
</html>
`;
}

const NON_ARTICLE_HTML = `
<!DOCTYPE html>
<html>
  <head><title>Tiny Page</title></head>
  <body><p>Just one short line.</p></body>
</html>
`;

describe('Web Scraper Tool', () => {
  const coreToolsPath = path.join(__dirname, '../../../tools');
  let toolLoader: ToolLoader;

  beforeAll(() => {
    toolLoader = new ToolLoader();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** robots.txt always 404s; the single page under test returns `html`. */
  function mockRobotsNotFoundThenPage(
    html: string,
    overrides: Partial<{
      status: number;
      headers: Record<string, string>;
      responseUrl: string;
    }> = {}
  ) {
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/robots.txt')) {
        const err = Object.assign(new Error('Request failed with status code 404'), {
          response: { status: 404 },
        });
        throw err;
      }
      return htmlResponse(html, overrides);
    });
  }

  // ── Tool Definition ─────────────────────────────────────────────────────

  describe('Tool Definition', () => {
    it('should have a valid web_scraper definition file', () => {
      const defPath = path.join(coreToolsPath, 'web_scraper', 'definition.yaml');
      expect(fs.existsSync(defPath)).toBe(true);
    });

    it('should load web_scraper tool with correct metadata', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('web_scraper');

      expect(tool).toBeDefined();
      expect(tool!.name).toBe('web_scraper');
      expect(tool!.version).toBe('2.0.0');
      expect(tool!.requires_approval).toBe(true);
    });

    it('should have function-type execution', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('web_scraper');
      expect(tool!.execution.type).toBe('function');
    });

    it('should declare the expected parameters', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('web_scraper');
      const params = tool!.parameters as Record<string, Parameter>;

      expect(params.url.required).toBe(true);
      expect(params.maxPages.required).toBe(false);
      expect(params.maxDepth.required).toBe(false);
      expect(params.format.enum).toEqual(['text', 'markdown', 'both']);
      expect(params.includeLinks.required).toBe(false);
      expect(params.respectRobotsTxt.required).toBe(false);
      expect(params.requestDelayMs.required).toBe(false);
      expect(params.maxDurationMs.required).toBe(false);
    });

    it('should have examples', async () => {
      const tools = await toolLoader.loadToolsFromDirectory(coreToolsPath);
      const tool = tools.get('web_scraper');
      expect((tool as unknown as { examples: unknown[] }).examples.length).toBeGreaterThan(0);
    });
  });

  // ── URL validation ───────────────────────────────────────────────────────

  describe('URL validation', () => {
    it('rejects a missing url', async () => {
      await expect(webScraperTool({ url: '' })).rejects.toThrow(MatimoError);
    });

    it('rejects a malformed url', async () => {
      await expect(webScraperTool({ url: 'not a url' })).rejects.toThrow('Invalid URL');
    });

    it('rejects non-http(s) protocols', async () => {
      await expect(webScraperTool({ url: 'ftp://example.com/file' })).rejects.toThrow(
        'Unsupported URL protocol'
      );
    });

    it.each([
      'http://localhost/admin',
      'http://127.0.0.1/secret',
      'http://[::1]/secret',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.5/internal',
      'http://192.168.1.1/router',
      'http://172.16.0.1/internal',
      'http://172.31.255.255/internal',
    ])('blocks SSRF target %s', async (url) => {
      await expect(webScraperTool({ url })).rejects.toThrow(
        'URL targets a blocked internal/metadata address'
      );
    });

    it('does not call axios.get when the URL is blocked', async () => {
      await expect(webScraperTool({ url: 'http://localhost/x' })).rejects.toThrow(MatimoError);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  // ── Parameter validation ─────────────────────────────────────────────────

  describe('Parameter validation', () => {
    it('rejects a non-finite maxPages', async () => {
      await expect(webScraperTool({ url: 'https://example.com/a', maxPages: NaN })).rejects.toThrow(
        '`maxPages`'
      );
    });

    it('clamps maxPages above the hard cap instead of erroring', async () => {
      // With maxDepth 0, only the starting page is ever fetched regardless of maxPages.
      mockRobotsNotFoundThenPage(NON_ARTICLE_HTML);
      const result = await webScraperTool({
        url: 'https://example.com/a',
        maxPages: 99999,
        maxDepth: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Single-page crawl (maxDepth 0) ──────────────────────────────────────

  describe('Single page (maxDepth 0)', () => {
    it('fetches only the starting page and does not follow links', async () => {
      mockRobotsNotFoundThenPage(articlePage('Home', ['https://example.com/other']));

      const result = await webScraperTool({ url: 'https://example.com/', maxDepth: 0 });

      expect(result.success).toBe(true);
      expect(result.pagesCrawled).toBe(1);
      expect(result.pages[0].depth).toBe(0);
      expect(result.pages[0].title).toContain('Home');
      // Only the robots.txt request + the single page fetch, no follow-up for /other
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('extracts plain text by default', async () => {
      mockRobotsNotFoundThenPage(articlePage('Article'), {
        responseUrl: 'https://example.com/article',
      });

      const result = await webScraperTool({ url: 'https://example.com/article', maxDepth: 0 });
      const page = result.pages[0];

      expect(page.text).toContain('first paragraph');
      expect(page.text).not.toContain('<p>');
      expect(page.markdown).toBeUndefined();
      expect(page.metadata.statusCode).toBe(200);
      expect(page.metadata.byline).toBeDefined();
    });

    it('extracts markdown when format is markdown, stripping links by default', async () => {
      mockRobotsNotFoundThenPage(articlePage('Article'));

      const result = await webScraperTool({
        url: 'https://example.com/article',
        maxDepth: 0,
        format: 'markdown',
      });
      const page = result.pages[0];

      expect(page.text).toBeUndefined();
      expect(page.markdown).toContain('first paragraph');
      expect(page.markdown).not.toContain('<p>');
      expect(page.markdown).not.toContain('](');
    });

    it('preserves links in markdown when includeLinks is true', async () => {
      mockRobotsNotFoundThenPage(articlePage('Article'));

      const result = await webScraperTool({
        url: 'https://example.com/article',
        maxDepth: 0,
        format: 'markdown',
        includeLinks: true,
      });

      expect(result.pages[0].markdown).toContain('[reference link](https://example.com/ref)');
    });

    it('returns both text and markdown when format is both', async () => {
      mockRobotsNotFoundThenPage(articlePage('Article'));

      const result = await webScraperTool({
        url: 'https://example.com/article',
        maxDepth: 0,
        format: 'both',
      });

      expect(result.pages[0].text).toBeDefined();
      expect(result.pages[0].markdown).toBeDefined();
    });

    it('falls back to body text when Readability finds no article', async () => {
      mockRobotsNotFoundThenPage(NON_ARTICLE_HTML);

      const result = await webScraperTool({ url: 'https://example.com/tiny', maxDepth: 0 });

      expect(result.pages[0].text).toContain('Just one short line.');
    });

    it('truncates page content beyond maxContentLength', async () => {
      mockRobotsNotFoundThenPage(articlePage('Article'));

      const result = await webScraperTool({
        url: 'https://example.com/article',
        maxDepth: 0,
        maxContentLength: 20,
      });

      expect(result.pages[0].text!.length).toBe(20);
      expect(result.pages[0].truncated).toBe(true);
      // truncatedCrawl reflects the crawl stopping early (maxPages/maxDepth/maxDurationMs),
      // which is independent of a single page's content being truncated — with maxDepth 0
      // and no further links to visit, the crawl itself completes fully.
      expect(result.truncatedCrawl).toBe(false);
    });
  });

  // ── Multi-page crawling ──────────────────────────────────────────────────

  describe('Multi-page crawling', () => {
    it('follows same-domain links up to maxDepth and dedupes revisits', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(
            articlePage('Home', ['https://example.com/page-a', 'https://example.com/page-b']),
            { responseUrl: 'https://example.com/' }
          );
        }
        if (url === 'https://example.com/page-a') {
          // Links back to home (already visited) and forward to page-c
          return htmlResponse(
            articlePage('Page A', ['https://example.com/', 'https://example.com/page-c'])
          );
        }
        if (url === 'https://example.com/page-b') {
          return htmlResponse(articlePage('Page B'));
        }
        if (url === 'https://example.com/page-c') {
          return htmlResponse(articlePage('Page C'));
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      const result = await webScraperTool({
        url: 'https://example.com/',
        maxDepth: 2,
        maxPages: 10,
        requestDelayMs: 0,
      });

      const urls = result.pages.map((p) => p.url).sort();
      expect(urls).toEqual([
        'https://example.com/',
        'https://example.com/page-a',
        'https://example.com/page-b',
        'https://example.com/page-c',
      ]);
      expect(result.pagesCrawled).toBe(4);
      expect(result.truncatedCrawl).toBe(false);
      // Home is only ever fetched once despite page-a linking back to it.
      const homeFetches = mockedAxios.get.mock.calls.filter(
        ([callUrl]) => callUrl === 'https://example.com/'
      );
      expect(homeFetches.length).toBe(1);
    });

    it('does not follow links to other hostnames', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(articlePage('Home', ['https://other-domain.com/page']), {
            responseUrl: 'https://example.com/',
          });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      const result = await webScraperTool({ url: 'https://example.com/', requestDelayMs: 0 });

      expect(result.pagesCrawled).toBe(1);
      expect(result.pages[0].url).toBe('https://example.com/');
    });

    it('stops once maxPages is reached and reports truncatedCrawl', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(
            articlePage('Home', [
              'https://example.com/page-a',
              'https://example.com/page-b',
              'https://example.com/page-c',
            ]),
            { responseUrl: 'https://example.com/' }
          );
        }
        return htmlResponse(articlePage('Some Page'));
      });

      const result = await webScraperTool({
        url: 'https://example.com/',
        maxPages: 2,
        requestDelayMs: 0,
      });

      expect(result.pagesCrawled).toBe(2);
      expect(result.truncatedCrawl).toBe(true);
    });

    it('records per-page errors without aborting the whole crawl', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(articlePage('Home', ['https://example.com/broken']), {
            responseUrl: 'https://example.com/',
          });
        }
        if (url === 'https://example.com/broken') {
          throw new Error('ECONNRESET');
        }
        // articlePage()'s body always includes an inline same-domain reference link;
        // resolve it to a trivial page so it doesn't also show up as an error here.
        if (url === 'https://example.com/ref') {
          return htmlResponse(NON_ARTICLE_HTML);
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      const result = await webScraperTool({ url: 'https://example.com/', requestDelayMs: 0 });

      expect(result.success).toBe(true);
      expect(result.pagesCrawled).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe('https://example.com/broken');
    });

    it('throws when even the starting page cannot be fetched', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        throw new Error('ECONNREFUSED');
      });

      await expect(webScraperTool({ url: 'https://example.com/' })).rejects.toThrow(
        'Failed to crawl any page starting from the given URL'
      );
    });
  });

  // ── robots.txt ───────────────────────────────────────────────────────────

  describe('robots.txt handling', () => {
    it('rejects the starting URL when robots.txt disallows it', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          return {
            data: 'User-agent: *\nDisallow: /private\n',
            status: 200,
            headers: {},
          };
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      await expect(webScraperTool({ url: 'https://example.com/private/page' })).rejects.toThrow(
        'robots.txt disallows crawling this URL'
      );
    });

    it('skips discovered links disallowed by robots.txt without failing the crawl', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          return {
            data: 'User-agent: *\nDisallow: /private\n',
            status: 200,
            headers: {},
          };
        }
        if (url === 'https://example.com/') {
          return htmlResponse(
            articlePage('Home', ['https://example.com/private/page', 'https://example.com/public']),
            { responseUrl: 'https://example.com/' }
          );
        }
        if (url === 'https://example.com/public') {
          return htmlResponse(articlePage('Public Page'));
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      const result = await webScraperTool({ url: 'https://example.com/', requestDelayMs: 0 });

      expect(result.pagesCrawled).toBe(2);
      expect(result.pages.some((p) => p.url.includes('/private'))).toBe(false);
      expect(result.skippedByRobots).toBe(1);
    });

    it('proceeds without restriction when robots.txt is unreachable', async () => {
      mockRobotsNotFoundThenPage(NON_ARTICLE_HTML);

      const result = await webScraperTool({ url: 'https://example.com/', maxDepth: 0 });
      expect(result.success).toBe(true);
    });

    it('skips the robots.txt fetch entirely when respectRobotsTxt is false', async () => {
      mockedAxios.get.mockImplementationOnce(async () => htmlResponse(NON_ARTICLE_HTML));

      const result = await webScraperTool({
        url: 'https://example.com/',
        maxDepth: 0,
        respectRobotsTxt: false,
      });

      expect(result.success).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(String(mockedAxios.get.mock.calls[0][0])).not.toContain('robots.txt');
    });
  });

  // ── Redirect SSRF guard ──────────────────────────────────────────────────

  describe('Redirect handling', () => {
    it('blocks a redirect that lands on an internal address', async () => {
      mockedAxios.get.mockImplementation(async (url: string, config?: unknown) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        const beforeRedirect = (config as Record<string, unknown> | undefined)?.beforeRedirect as
          | ((opts: Record<string, string>) => void)
          | undefined;
        expect(beforeRedirect).toBeDefined();
        beforeRedirect!({ protocol: 'http:', hostname: '169.254.169.254', path: '/' });
        return htmlResponse(NON_ARTICLE_HTML);
      });

      await expect(webScraperTool({ url: 'https://example.com/redirect-me' })).rejects.toThrow(
        'Failed to crawl any page starting from the given URL'
      );
    });
  });

  // ── HTTP status predicates (invoked internally by axios; unreachable under a full mock) ──

  describe('Status predicates', () => {
    it('isSuccessStatus accepts only 2xx', () => {
      expect(isSuccessStatus(200)).toBe(true);
      expect(isSuccessStatus(299)).toBe(true);
      expect(isSuccessStatus(199)).toBe(false);
      expect(isSuccessStatus(300)).toBe(false);
      expect(isSuccessStatus(404)).toBe(false);
    });

    it('isRobotsOkStatus accepts only 200', () => {
      expect(isRobotsOkStatus(200)).toBe(true);
      expect(isRobotsOkStatus(204)).toBe(false);
      expect(isRobotsOkStatus(404)).toBe(false);
    });
  });

  // ── Readability fallback, link-discovery edge cases, pacing, and duration cap ──

  describe('Additional crawl edge cases', () => {
    it('falls back to raw body text when Readability finds no article at all', async () => {
      const EMPTY_HTML =
        '<!DOCTYPE html><html><head><title>Empty</title></head><body></body></html>';
      mockRobotsNotFoundThenPage(EMPTY_HTML);

      const result = await webScraperTool({ url: 'https://example.com/empty', maxDepth: 0 });

      expect(result.success).toBe(true);
      expect(result.pages[0].text).toBe('');
    });

    it('skips a link with an unparseable href without failing the crawl', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(
            `<!DOCTYPE html><html><head><title>Home</title></head><body>
              <nav>
                <a href="http://[not-a-valid-host">broken link</a>
                <a href="https://example.com/valid-page">valid link</a>
              </nav>
              <article>${ARTICLE_BODY}</article>
            </body></html>`,
            { responseUrl: 'https://example.com/' }
          );
        }
        if (url === 'https://example.com/valid-page') {
          return htmlResponse(articlePage('Valid Page'));
        }
        if (url === 'https://example.com/ref') {
          return htmlResponse(NON_ARTICLE_HTML);
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      });

      const result = await webScraperTool({ url: 'https://example.com/', requestDelayMs: 0 });

      expect(result.success).toBe(true);
      expect(result.pages.some((p) => p.url === 'https://example.com/valid-page')).toBe(true);
    });

    it('applies requestDelayMs between page fetches', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(articlePage('Home', ['https://example.com/page-a']), {
            responseUrl: 'https://example.com/',
          });
        }
        if (url === 'https://example.com/ref') {
          return htmlResponse(NON_ARTICLE_HTML);
        }
        return htmlResponse(articlePage('Page A'));
      });

      const result = await webScraperTool({ url: 'https://example.com/', requestDelayMs: 1 });

      expect(result.pagesCrawled).toBeGreaterThanOrEqual(2);
    });

    it('stops early once maxDurationMs is exceeded and reports truncatedCrawl', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          throw Object.assign(new Error('404'), { response: { status: 404 } });
        }
        if (url === 'https://example.com/') {
          return htmlResponse(articlePage('Home', ['https://example.com/page-a']), {
            responseUrl: 'https://example.com/',
          });
        }
        return htmlResponse(articlePage('Page A'));
      });

      const realNow = Date.now.bind(Date);
      let callCount = 0;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        // Calls 1-2 (startTime capture + first in-loop deadline check) look like "just
        // started"; from call 3 onward (the second page's deadline check) time appears
        // to have jumped far past maxDurationMs, forcing an early stop.
        return callCount <= 2 ? realNow() : realNow() + 10 * 60 * 1000;
      });

      try {
        const result = await webScraperTool({
          url: 'https://example.com/',
          maxDurationMs: 1000,
          requestDelayMs: 0,
        });

        expect(result.pagesCrawled).toBe(1);
        expect(result.truncatedCrawl).toBe(true);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });

  // ── robots.txt group matching and Allow/Disallow precedence ──────────────

  describe('robots.txt group matching and precedence', () => {
    it('allows everything when robots.txt has no matching user-agent group', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          return { data: 'User-agent: SomeOtherBot\nDisallow: /\n', status: 200, headers: {} };
        }
        return htmlResponse(NON_ARTICLE_HTML);
      });

      const result = await webScraperTool({ url: 'https://example.com/anything', maxDepth: 0 });
      expect(result.success).toBe(true);
    });

    it('lets a more specific Allow rule override a broader Disallow', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (String(url).endsWith('/robots.txt')) {
          return {
            data: 'User-agent: *\nDisallow: /blog\nAllow: /blog/public\n',
            status: 200,
            headers: {},
          };
        }
        return htmlResponse(NON_ARTICLE_HTML);
      });

      const result = await webScraperTool({
        url: 'https://example.com/blog/public/post',
        maxDepth: 0,
      });
      expect(result.success).toBe(true);
    });
  });
});
