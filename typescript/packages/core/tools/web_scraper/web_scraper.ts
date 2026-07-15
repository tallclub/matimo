/**
 * Web Scraper Tool - Crawl a website and extract the main readable content of every
 * same-domain page reachable from a starting URL.
 * Pattern: Function-based tool (same as extract_from_file / convert_to_file)
 *
 * No headless browser: performs static HTTP GETs only, then runs Mozilla's
 * Readability algorithm (via jsdom) per page to strip navigation/ads/boilerplate
 * and return clean plain text and/or Markdown (via turndown). Pages that render
 * their content with client-side JavaScript will yield little or no text.
 *
 * jsdom is constructed without `runScripts` or `resources: 'usable'`, so no
 * inline/external script ever executes and no secondary resources are fetched
 * — each page's DOM is built from its already-downloaded HTML string only.
 *
 * The crawl is bounded by maxPages/maxDepth/maxDurationMs, restricted to the
 * starting URL's hostname, paced by requestDelayMs, and honors robots.txt by
 * default — this is a same-domain crawler, not a general-purpose scraper.
 */

import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { MatimoError, ErrorCode, getGlobalMatimoLogger } from '@matimo/core/runtime';

type OutputFormat = 'text' | 'markdown' | 'both';
type Logger = ReturnType<typeof getGlobalMatimoLogger>;

interface WebScraperParams {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  format?: OutputFormat;
  includeLinks?: boolean;
  maxContentLength?: number;
  maxSizeBytes?: number;
  timeout?: number;
  requestDelayMs?: number;
  respectRobotsTxt?: boolean;
  maxDurationMs?: number;
}

interface PageMetadata {
  statusCode: number;
  contentType: string;
  byline?: string;
  length: number;
}

interface PageResult {
  url: string;
  resolvedUrl: string;
  depth: number;
  title: string;
  text?: string;
  markdown?: string;
  excerpt: string;
  truncated: boolean;
  metadata: PageMetadata;
}

interface CrawlError {
  url: string;
  error: string;
}

interface WebScraperResult {
  success: boolean;
  startUrl: string;
  domain: string;
  pagesCrawled: number;
  truncatedCrawl: boolean;
  skippedByRobots: number;
  pages: PageResult[];
  errors: CrawlError[];
}

const DEFAULT_MAX_PAGES = 20;
const MAX_MAX_PAGES = 100;
const DEFAULT_MAX_DEPTH = 3;
const MAX_MAX_DEPTH = 10;
const DEFAULT_MAX_CONTENT_LENGTH = 50000;
const DEFAULT_MAX_SIZE_BYTES = 10485760;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_REQUEST_DELAY_MS = 250;
const MAX_REQUEST_DELAY_MS = 5000;
const DEFAULT_MAX_DURATION_MS = 120000;
const MAX_MAX_DURATION_MS = 600000;
const ROBOTS_USER_AGENT = 'matimo';

/**
 * SSRF guard. Mirrors isBlockedUrl() in packages/core/src/policy/default-policy.ts
 * (and the identical guard in extract_from_file.ts) so this tool's outbound
 * fetches are held to the same bar Matimo's policy engine uses for agent-proposed
 * HTTP tools (blocks localhost, loopback, link-local/AWS metadata, and RFC1918
 * private ranges).
 */
function isBlockedUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MatimoError('Invalid URL', ErrorCode.INVALID_PARAMETER, {
      url,
      reason: 'url must be a valid http or https URL',
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new MatimoError('Unsupported URL protocol', ErrorCode.INVALID_PARAMETER, {
      url,
      protocol: parsed.protocol,
      reason: 'Only http and https URLs are supported',
    });
  }

  if (isBlockedUrl(url)) {
    throw new MatimoError(
      'URL targets a blocked internal/metadata address',
      ErrorCode.INVALID_PARAMETER,
      { url }
    );
  }

  return parsed;
}

/** Clamp a user-supplied numeric parameter into [min, max], falling back to `fallback` when absent. */
function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  label: string
): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new MatimoError(`Parameter \`${label}\` must be a finite number`, ErrorCode.INVALID_PARAMETER, {
      [label]: value,
    });
  }
  return Math.min(max, Math.max(min, value));
}

/** Truncate `text` to `maxLength` characters. Returns the (possibly unchanged) text and a truncated flag. */
function truncate(text: string, maxLength: number): { value: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { value: text, truncated: false };
  }
  return { value: text.slice(0, maxLength), truncated: true };
}

function buildTurndown(includeLinks: boolean): TurndownService {
  const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  if (!includeLinks) {
    turndownService.addRule('stripLinks', {
      filter: 'a',
      replacement: (content) => content,
    });
  }
  return turndownService;
}

// ── robots.txt ───────────────────────────────────────────────────────────

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

const ALLOW_ALL: RobotsRules = { disallow: [], allow: [] };

/** Minimal robots.txt parser: groups by User-agent, collects Disallow/Allow paths for the matching group. */
function parseRobotsTxt(text: string, userAgent: string): RobotsRules {
  type Group = { agents: string[]; rules: { type: 'allow' | 'disallow'; path: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (key === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === 'disallow' || key === 'allow') && current) {
      current.rules.push({ type: key, path: value });
    }
  }

  const ua = userAgent.toLowerCase();
  const group = groups.find((g) => g.agents.includes(ua)) ?? groups.find((g) => g.agents.includes('*'));
  if (!group) {
    return ALLOW_ALL;
  }
  return {
    disallow: group.rules.filter((r) => r.type === 'disallow' && r.path.length > 0).map((r) => r.path),
    allow: group.rules.filter((r) => r.type === 'allow').map((r) => r.path),
  };
}

/** Longest-prefix-match wins (standard robots.txt semantics); no match means allowed. */
function isAllowedByRobots(rules: RobotsRules, pathname: string): boolean {
  let bestLength = -1;
  let bestIsAllow = true;

  for (const path of rules.disallow) {
    if (pathname.startsWith(path) && path.length > bestLength) {
      bestLength = path.length;
      bestIsAllow = false;
    }
  }
  for (const path of rules.allow) {
    if (pathname.startsWith(path) && path.length > bestLength) {
      bestLength = path.length;
      bestIsAllow = true;
    }
  }
  return bestIsAllow;
}

/** Exported for direct unit testing — axios invokes this internally, so it's otherwise unreachable under mocks. */
export function isRobotsOkStatus(status: number): boolean {
  return status === 200;
}

async function fetchRobotsRules(
  origin: string,
  timeout: number,
  logger: Logger
): Promise<RobotsRules> {
  try {
    const response = await axios.get<string>(`${origin}/robots.txt`, {
      responseType: 'text',
      timeout: Math.min(timeout, 5000),
      validateStatus: isRobotsOkStatus,
      headers: { 'User-Agent': `Matimo/1.0 (AI Agent Tool SDK; ${ROBOTS_USER_AGENT})` },
    });
    return parseRobotsTxt(response.data, ROBOTS_USER_AGENT);
  } catch (error) {
    logger.debug('web_scraper: no usable robots.txt found, proceeding without restrictions', {
      origin,
      error: error instanceof Error ? error.message : String(error),
    });
    return ALLOW_ALL;
  }
}

// ── Single-page fetch + extraction ──────────────────────────────────────

interface FetchedPage {
  resolvedUrl: string;
  statusCode: number;
  contentType: string;
  dom: JSDOM;
}

/** Exported for direct unit testing — axios invokes this internally, so it's otherwise unreachable under mocks. */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

async function fetchPage(
  url: string,
  maxSizeBytes: number,
  timeout: number
): Promise<FetchedPage> {
  let response;
  try {
    response = await axios.get<string>(url, {
      responseType: 'text',
      timeout,
      maxContentLength: maxSizeBytes,
      maxBodyLength: maxSizeBytes,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Matimo/1.0 (AI Agent Tool SDK; web_scraper)',
        Accept: 'text/html,application/xhtml+xml',
      },
      validateStatus: isSuccessStatus,
      // Guard against a redirect chain landing on a blocked/internal address.
      beforeRedirect: (redirectOptions) => {
        const redirectTarget = `${redirectOptions.protocol}//${redirectOptions.hostname}${redirectOptions.path}`;
        if (isBlockedUrl(redirectTarget)) {
          throw new MatimoError(
            'Redirect targets a blocked internal/metadata address',
            ErrorCode.INVALID_PARAMETER,
            { url, redirectTarget }
          );
        }
      },
    });
  } catch (error) {
    if (error instanceof MatimoError) {
      throw error;
    }
    const axiosError = error as { response?: { status?: number }; message?: string };
    throw new MatimoError(
      `Failed to fetch URL: ${axiosError.message ?? String(error)}`,
      ErrorCode.EXECUTION_FAILED,
      { url, statusCode: axiosError.response?.status }
    );
  }

  const resolvedUrl: string = (response.request?.res?.responseUrl as string | undefined) ?? url;
  const contentType = String(response.headers?.['content-type'] ?? '');
  const dom = new JSDOM(response.data, { url: resolvedUrl });

  return { resolvedUrl, statusCode: response.status, contentType, dom };
}

interface ExtractedContent {
  title: string;
  excerpt: string;
  byline?: string;
  extractedHtml: string;
  plainText: string;
}

function extractContent(dom: JSDOM): ExtractedContent {
  let title = dom.window.document.title?.trim() ?? '';
  let excerpt = '';
  let byline: string | undefined;
  let extractedHtml = '';
  let plainText = '';

  const reader = new Readability(dom.window.document.cloneNode(true) as Document);
  const article = reader.parse();

  if (article) {
    title = article.title?.trim() || title;
    excerpt = article.excerpt?.trim() ?? '';
    byline = article.byline?.trim() || undefined;
    extractedHtml = article.content ?? '';
    plainText = (article.textContent ?? '').trim();
  } else {
    const body = dom.window.document.body;
    plainText = (body?.textContent ?? '').trim();
    extractedHtml = body?.innerHTML ?? '';
  }

  plainText = plainText.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return { title, excerpt, byline, extractedHtml, plainText };
}

/** Discover same-hostname links from a page's full (pre-Readability) DOM. */
function discoverSameDomainLinks(dom: JSDOM, baseUrl: string, domain: string): string[] {
  const anchors = Array.from(dom.window.document.querySelectorAll('a[href]'));
  const links = new Set<string>();

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
    if (resolved.hostname.toLowerCase() !== domain) continue;
    resolved.hash = '';
    links.add(resolved.toString());
  }

  return Array.from(links);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Crawl orchestration ─────────────────────────────────────────────────

export default async function webScraper(params: WebScraperParams): Promise<WebScraperResult> {
  const logger = getGlobalMatimoLogger();

  if (typeof params.url !== 'string' || params.url.trim().length === 0) {
    throw new MatimoError('Parameter `url` is required', ErrorCode.INVALID_PARAMETER, {
      url: params.url,
    });
  }

  const startUrlParsed = validateUrl(params.url);
  const domain = startUrlParsed.hostname.toLowerCase();

  const maxPages = clampNumber(params.maxPages, DEFAULT_MAX_PAGES, 1, MAX_MAX_PAGES, 'maxPages');
  const maxDepth = clampNumber(params.maxDepth, DEFAULT_MAX_DEPTH, 0, MAX_MAX_DEPTH, 'maxDepth');
  const format: OutputFormat = params.format ?? 'text';
  const includeLinks = params.includeLinks ?? false;
  const maxContentLength = clampNumber(
    params.maxContentLength,
    DEFAULT_MAX_CONTENT_LENGTH,
    1,
    Number.MAX_SAFE_INTEGER,
    'maxContentLength'
  );
  const maxSizeBytes = clampNumber(
    params.maxSizeBytes,
    DEFAULT_MAX_SIZE_BYTES,
    1,
    Number.MAX_SAFE_INTEGER,
    'maxSizeBytes'
  );
  const timeout = clampNumber(params.timeout, DEFAULT_TIMEOUT, 1, Number.MAX_SAFE_INTEGER, 'timeout');
  const requestDelayMs = clampNumber(
    params.requestDelayMs,
    DEFAULT_REQUEST_DELAY_MS,
    0,
    MAX_REQUEST_DELAY_MS,
    'requestDelayMs'
  );
  const respectRobotsTxt = params.respectRobotsTxt ?? true;
  const maxDurationMs = clampNumber(
    params.maxDurationMs,
    DEFAULT_MAX_DURATION_MS,
    1000,
    MAX_MAX_DURATION_MS,
    'maxDurationMs'
  );

  const robotsRules = respectRobotsTxt
    ? await fetchRobotsRules(startUrlParsed.origin, timeout, logger)
    : ALLOW_ALL;

  if (respectRobotsTxt && !isAllowedByRobots(robotsRules, startUrlParsed.pathname)) {
    throw new MatimoError('robots.txt disallows crawling this URL', ErrorCode.EXECUTION_FAILED, {
      url: params.url,
    });
  }

  const startTime = Date.now();
  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrlParsed.toString(), depth: 0 }];
  const pages: PageResult[] = [];
  const errors: CrawlError[] = [];
  let skippedByRobots = 0;
  let truncatedCrawl = false;

  const turndownService = format === 'markdown' || format === 'both' ? buildTurndown(includeLinks) : null;

  while (queue.length > 0) {
    if (pages.length >= maxPages) {
      truncatedCrawl = truncatedCrawl || queue.length > 0;
      break;
    }
    if (Date.now() - startTime >= maxDurationMs) {
      truncatedCrawl = true;
      logger.debug('web_scraper: maxDurationMs exceeded, stopping crawl early', { domain });
      break;
    }

    const next = queue.shift();
    if (!next) break;
    const { url, depth } = next;
    const normalized = url;

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    if (respectRobotsTxt && !isAllowedByRobots(robotsRules, new URL(url).pathname)) {
      skippedByRobots++;
      continue;
    }

    try {
      if (pages.length > 0 && requestDelayMs > 0) {
        await sleep(requestDelayMs);
      }

      logger.debug('web_scraper fetching page', { url, depth });
      const fetched = await fetchPage(url, maxSizeBytes, timeout);
      const extracted = extractContent(fetched.dom);

      const pageResult: PageResult = {
        url,
        resolvedUrl: fetched.resolvedUrl,
        depth,
        title: extracted.title,
        excerpt: extracted.excerpt,
        truncated: false,
        metadata: {
          statusCode: fetched.statusCode,
          contentType: fetched.contentType,
          byline: extracted.byline,
          length: extracted.plainText.length,
        },
      };

      let pageTruncated = false;
      if (format === 'text' || format === 'both') {
        const { value, truncated } = truncate(extracted.plainText, maxContentLength);
        pageResult.text = value;
        pageTruncated = pageTruncated || truncated;
      }
      if (turndownService) {
        const rawMarkdown = turndownService.turndown(extracted.extractedHtml).trim();
        const { value, truncated } = truncate(rawMarkdown, maxContentLength);
        pageResult.markdown = value;
        pageTruncated = pageTruncated || truncated;
      }
      pageResult.truncated = pageTruncated;

      pages.push(pageResult);

      const resolvedHostname = new URL(fetched.resolvedUrl).hostname.toLowerCase();
      if (depth < maxDepth && resolvedHostname === domain) {
        const links = discoverSameDomainLinks(fetched.dom, fetched.resolvedUrl, domain);
        for (const link of links) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    } catch (error) {
      const message = error instanceof MatimoError ? error.message : String(error);
      logger.error('web_scraper: failed to fetch/extract a page during crawl', { url, error: message });
      errors.push({ url, error: message });
    }
  }

  if (pages.length === 0) {
    throw new MatimoError('Failed to crawl any page starting from the given URL', ErrorCode.EXECUTION_FAILED, {
      startUrl: params.url,
      errors,
    });
  }

  truncatedCrawl = truncatedCrawl || queue.length > 0;

  logger.info('web_scraper crawl complete', {
    startUrl: params.url,
    domain,
    pagesCrawled: pages.length,
    truncatedCrawl,
    skippedByRobots,
    errorCount: errors.length,
  });

  return {
    success: true,
    startUrl: params.url,
    domain,
    pagesCrawled: pages.length,
    truncatedCrawl,
    skippedByRobots,
    pages,
    errors,
  };
}
