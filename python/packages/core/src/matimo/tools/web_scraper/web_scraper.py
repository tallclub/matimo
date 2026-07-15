"""Web scraper tool — crawl a website and extract the main readable content of every
same-domain page reachable from a starting URL.

No headless browser: performs static HTTP GETs only, then runs a readability-style
algorithm (readability-lxml) per page to strip navigation/ads/boilerplate and return
clean plain text and/or Markdown (via markdownify). Pages that render their content
with client-side JavaScript will yield little or no text.

The crawl is bounded by maxPages/maxDepth/maxDurationMs, restricted to the starting
URL's hostname, paced by requestDelayMs, and honors robots.txt by default — this is a
same-domain crawler, not a general-purpose scraper.
"""
from __future__ import annotations

import asyncio
import re
from time import monotonic
from typing import Any
from urllib.parse import ParseResult, urljoin, urlparse

import httpx
import lxml.html as lxml_html
from lxml.html import HtmlElement
from markdownify import MarkdownConverter
from readability import Document

from matimo.errors import ErrorCode, MatimoError

DEFAULT_MAX_PAGES = 20
MAX_MAX_PAGES = 100
DEFAULT_MAX_DEPTH = 3
MAX_MAX_DEPTH = 10
DEFAULT_MAX_CONTENT_LENGTH = 50000
DEFAULT_MAX_SIZE_BYTES = 10485760
DEFAULT_TIMEOUT_MS = 15000
DEFAULT_REQUEST_DELAY_MS = 250
MAX_REQUEST_DELAY_MS = 5000
DEFAULT_MAX_DURATION_MS = 120000
MAX_MAX_DURATION_MS = 600000
ROBOTS_USER_AGENT = "matimo"
MAX_REDIRECTS = 5


def _is_blocked_url(url: str) -> bool:
    """SSRF guard mirroring is_blocked_url() in matimo.policy.default_policy.

    Blocks localhost, loopback, link-local/AWS metadata, and RFC1918 private
    ranges so outbound fetches are held to the same bar Matimo's policy engine
    applies to agent-proposed HTTP tools.
    """
    hostname = (urlparse(url).hostname or "").lower()
    if not hostname:
        return True
    if hostname in ("localhost", "127.0.0.1", "::1"):
        return True
    if hostname.startswith("169.254."):
        return True
    if hostname.startswith("10.") or hostname.startswith("192.168."):
        return True
    return bool(re.match(r"^172\.(1[6-9]|2\d|3[01])\.", hostname))


def _validate_url(url: str) -> ParseResult:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise MatimoError(
            "Invalid URL",
            ErrorCode.INVALID_PARAMETER,
            {"url": url, "reason": "url must be a valid http or https URL"},
        )
    if _is_blocked_url(url):
        raise MatimoError(
            "URL targets a blocked internal/metadata address",
            ErrorCode.INVALID_PARAMETER,
            {"url": url},
        )
    return parsed


def _clamp_number(
    value: object, fallback: float, min_value: float, max_value: float | None, label: str
) -> float:
    if value is None:
        return fallback
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise MatimoError(
            f"Parameter `{label}` must be a finite number", ErrorCode.INVALID_PARAMETER, {label: value}
        )
    numeric = float(value)
    if numeric != numeric or numeric in (float("inf"), float("-inf")):  # NaN/inf check
        raise MatimoError(
            f"Parameter `{label}` must be a finite number", ErrorCode.INVALID_PARAMETER, {label: value}
        )
    if max_value is not None:
        numeric = min(max_value, numeric)
    numeric = max(min_value, numeric)
    return numeric


def _truncate(text: str, max_length: float) -> tuple[str, bool]:
    if len(text) <= max_length:
        return text, False
    return text[: int(max_length)], True


class _StripLinksConverter(MarkdownConverter):
    """A markdownify converter that keeps link text but drops the [text](href) syntax."""

    def convert_a(self, el: Any, text: str, parent_tags: Any) -> str:  # noqa: ANN401
        return text


def _html_to_markdown(html: str, include_links: bool) -> str:
    converter = MarkdownConverter() if include_links else _StripLinksConverter()
    return converter.convert(html).strip()


# ── robots.txt ───────────────────────────────────────────────────────────


def _parse_robots_txt(text: str, user_agent: str) -> tuple[list[str], list[str]]:
    """Minimal robots.txt parser: groups by User-agent, collects Disallow/Allow paths."""
    groups: list[tuple[list[str], list[tuple[str, str]]]] = []
    current: tuple[list[str], list[tuple[str, str]]] | None = None

    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()

        if key == "user-agent":
            if current is None or current[1]:
                current = ([], [])
                groups.append(current)
            current[0].append(value.lower())
        elif key in ("disallow", "allow") and current is not None:
            current[1].append((key, value))

    ua = user_agent.lower()
    group = next((g for g in groups if ua in g[0]), None)
    if group is None:
        group = next((g for g in groups if "*" in g[0]), None)
    if group is None:
        return [], []

    disallow = [path for rule_type, path in group[1] if rule_type == "disallow" and path]
    allow = [path for rule_type, path in group[1] if rule_type == "allow"]
    return disallow, allow


def _is_allowed_by_robots(disallow: list[str], allow: list[str], pathname: str) -> bool:
    """Longest-prefix-match wins (standard robots.txt semantics); no match means allowed."""
    best_length = -1
    best_is_allow = True

    for path in disallow:
        if pathname.startswith(path) and len(path) > best_length:
            best_length = len(path)
            best_is_allow = False
    for path in allow:
        if pathname.startswith(path) and len(path) > best_length:
            best_length = len(path)
            best_is_allow = True

    return best_is_allow


async def _fetch_robots_rules(origin: str, timeout_s: float) -> tuple[list[str], list[str]]:
    try:
        async with httpx.AsyncClient(timeout=min(timeout_s, 5.0)) as client:
            response = await client.get(
                f"{origin}/robots.txt",
                headers={"User-Agent": f"Matimo/1.0 (AI Agent Tool SDK; {ROBOTS_USER_AGENT})"},
            )
        if response.status_code != 200:
            return [], []
        return _parse_robots_txt(response.text, ROBOTS_USER_AGENT)
    except httpx.HTTPError:
        return [], []


# ── Single-page fetch + extraction ──────────────────────────────────────


async def _fetch_page(url: str, max_size_bytes: float, timeout_s: float) -> tuple[str, str, int, str]:
    """Fetch `url`, manually following redirects while re-checking each hop for SSRF.

    Returns (resolved_url, html, status_code, content_type).
    """
    current_url = url
    async with httpx.AsyncClient(follow_redirects=False, timeout=timeout_s) as client:
        for _ in range(MAX_REDIRECTS + 1):
            try:
                response = await client.get(
                    current_url,
                    headers={
                        "User-Agent": "Matimo/1.0 (AI Agent Tool SDK; web_scraper)",
                        "Accept": "text/html,application/xhtml+xml",
                    },
                )
            except httpx.HTTPError as exc:
                raise MatimoError(
                    f"Failed to fetch URL: {exc}", ErrorCode.EXECUTION_FAILED, {"url": url}
                ) from exc

            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise MatimoError(
                        "Redirect response is missing a Location header",
                        ErrorCode.EXECUTION_FAILED,
                        {"url": url},
                    )
                next_url = urljoin(current_url, location)
                if _is_blocked_url(next_url):
                    raise MatimoError(
                        "Redirect targets a blocked internal/metadata address",
                        ErrorCode.INVALID_PARAMETER,
                        {"url": url, "redirectTarget": next_url},
                    )
                current_url = next_url
                continue

            if response.status_code < 200 or response.status_code >= 300:
                raise MatimoError(
                    f"Failed to fetch URL: HTTP {response.status_code}",
                    ErrorCode.EXECUTION_FAILED,
                    {"url": url, "statusCode": response.status_code},
                )

            content = response.content
            if len(content) > max_size_bytes:
                raise MatimoError(
                    "Response too large",
                    ErrorCode.EXECUTION_FAILED,
                    {"url": url, "size": len(content), "maxSizeBytes": max_size_bytes},
                )

            return current_url, response.text, response.status_code, response.headers.get("content-type", "")

    raise MatimoError("Too many redirects", ErrorCode.EXECUTION_FAILED, {"url": url})


def _extract_content(
    html: str, resolved_url: str
) -> tuple[str, str, str | None, str, str, HtmlElement]:
    """Extract (title, excerpt, byline, extracted_html, plain_text, raw_tree) from `html`."""
    tree = lxml_html.fromstring(html)

    title = ""
    title_el = tree.find(".//title")
    if title_el is not None and title_el.text:
        title = title_el.text.strip()

    byline: str | None = None
    summary_html = ""
    doc_title = ""

    try:
        doc = Document(html, url=resolved_url)
        summary_html = doc.summary(html_partial=True)
        doc_title = (doc.title() or "").strip()
        byline = (doc.author() or "").strip() or None
    except Exception:  # noqa: BLE001 - readability-lxml can raise on malformed input
        summary_html = ""

    summary_text = ""
    if summary_html:
        summary_text = (lxml_html.fromstring(summary_html).text_content() or "").strip()

    if summary_text:
        title = doc_title or title
        extracted_html = summary_html
        plain_text = summary_text
    else:
        body = tree.find(".//body")
        target = body if body is not None else tree
        plain_text = (target.text_content() or "").strip()
        extracted_html = lxml_html.tostring(target, encoding="unicode")

    plain_text = re.sub(r"[ \t]+\n", "\n", plain_text)
    plain_text = re.sub(r"\n{3,}", "\n\n", plain_text).strip()

    excerpt = plain_text[:200].strip()

    return title, excerpt, byline, extracted_html, plain_text, tree


def _discover_same_domain_links(tree: HtmlElement, base_url: str, domain: str) -> list[str]:
    """Discover same-hostname links from a page's full (pre-extraction) DOM."""
    links: dict[str, None] = {}

    for anchor in tree.iter("a"):
        href = anchor.get("href")
        if not href:
            continue
        try:
            resolved = urljoin(base_url, href)
            parsed = urlparse(resolved)
        except ValueError:
            continue
        if parsed.scheme not in ("http", "https"):
            continue
        if (parsed.hostname or "").lower() != domain:
            continue
        links[resolved.split("#", 1)[0]] = None

    return list(links.keys())


# ── Crawl orchestration ─────────────────────────────────────────────────


async def run(params: dict[str, Any]) -> dict[str, Any]:
    """Entry point invoked by Matimo's FunctionExecutor."""
    url = params.get("url")
    if not isinstance(url, str) or not url.strip():
        raise MatimoError("Parameter `url` is required", ErrorCode.INVALID_PARAMETER, {"url": url})

    parsed_start = _validate_url(url)
    domain = (parsed_start.hostname or "").lower()

    max_pages = _clamp_number(params.get("maxPages"), DEFAULT_MAX_PAGES, 1, MAX_MAX_PAGES, "maxPages")
    max_depth = _clamp_number(params.get("maxDepth"), DEFAULT_MAX_DEPTH, 0, MAX_MAX_DEPTH, "maxDepth")
    format_ = params.get("format") or "text"
    include_links = bool(params.get("includeLinks") or False)
    max_content_length = _clamp_number(
        params.get("maxContentLength"), DEFAULT_MAX_CONTENT_LENGTH, 1, None, "maxContentLength"
    )
    max_size_bytes = _clamp_number(
        params.get("maxSizeBytes"), DEFAULT_MAX_SIZE_BYTES, 1, None, "maxSizeBytes"
    )
    timeout_ms = _clamp_number(params.get("timeout"), DEFAULT_TIMEOUT_MS, 1, None, "timeout")
    request_delay_ms = _clamp_number(
        params.get("requestDelayMs"), DEFAULT_REQUEST_DELAY_MS, 0, MAX_REQUEST_DELAY_MS, "requestDelayMs"
    )
    respect_robots_param = params.get("respectRobotsTxt")
    respect_robots = True if respect_robots_param is None else bool(respect_robots_param)
    max_duration_ms = _clamp_number(
        params.get("maxDurationMs"), DEFAULT_MAX_DURATION_MS, 1000, MAX_MAX_DURATION_MS, "maxDurationMs"
    )

    timeout_s = timeout_ms / 1000.0

    if respect_robots:
        origin = f"{parsed_start.scheme}://{parsed_start.netloc}"
        disallow, allow = await _fetch_robots_rules(origin, timeout_s)
    else:
        disallow, allow = [], []

    if respect_robots and not _is_allowed_by_robots(disallow, allow, parsed_start.path or "/"):
        raise MatimoError(
            "robots.txt disallows crawling this URL", ErrorCode.EXECUTION_FAILED, {"url": url}
        )

    start_time = monotonic()
    visited: set[str] = set()
    queue: list[tuple[str, int]] = [(url, 0)]
    pages: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    skipped_by_robots = 0
    truncated_crawl = False

    while queue:
        if len(pages) >= max_pages:
            truncated_crawl = truncated_crawl or bool(queue)
            break
        if (monotonic() - start_time) * 1000 >= max_duration_ms:
            truncated_crawl = True
            break

        current_url, depth = queue.pop(0)
        if current_url in visited:
            continue
        visited.add(current_url)

        if respect_robots and not _is_allowed_by_robots(
            disallow, allow, urlparse(current_url).path or "/"
        ):
            skipped_by_robots += 1
            continue

        try:
            if pages and request_delay_ms > 0:
                await asyncio.sleep(request_delay_ms / 1000.0)

            resolved_url, html, status_code, content_type = await _fetch_page(
                current_url, max_size_bytes, timeout_s
            )
            title, excerpt, byline, extracted_html, plain_text, tree = _extract_content(html, resolved_url)

            page: dict[str, Any] = {
                "url": current_url,
                "resolvedUrl": resolved_url,
                "depth": depth,
                "title": title,
                "excerpt": excerpt,
                "truncated": False,
                "metadata": {
                    "statusCode": status_code,
                    "contentType": content_type,
                    "byline": byline,
                    "length": len(plain_text),
                },
            }

            page_truncated = False
            if format_ in ("text", "both"):
                text_value, text_truncated = _truncate(plain_text, max_content_length)
                page["text"] = text_value
                page_truncated = page_truncated or text_truncated
            if format_ in ("markdown", "both"):
                markdown_raw = _html_to_markdown(extracted_html, include_links)
                markdown_value, markdown_truncated = _truncate(markdown_raw, max_content_length)
                page["markdown"] = markdown_value
                page_truncated = page_truncated or markdown_truncated
            page["truncated"] = page_truncated

            pages.append(page)

            resolved_hostname = (urlparse(resolved_url).hostname or "").lower()
            if depth < max_depth and resolved_hostname == domain:
                for link in _discover_same_domain_links(tree, resolved_url, domain):
                    if link not in visited:
                        queue.append((link, depth + 1))
        except Exception as exc:  # noqa: BLE001 - collect per-page failures, keep crawling
            errors.append({"url": current_url, "error": str(exc)})

    if not pages:
        raise MatimoError(
            "Failed to crawl any page starting from the given URL",
            ErrorCode.EXECUTION_FAILED,
            {"startUrl": url, "errors": errors},
        )

    truncated_crawl = truncated_crawl or bool(queue)

    return {
        "success": True,
        "startUrl": url,
        "domain": domain,
        "pagesCrawled": len(pages),
        "truncatedCrawl": truncated_crawl,
        "skippedByRobots": skipped_by_robots,
        "pages": pages,
        "errors": errors,
    }
