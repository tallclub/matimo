"""Unit tests for the web_scraper core tool (YAML definition + run() crawl logic).

Mirrors: typescript/packages/core/test/unit/tools/web-scraper.test.ts
"""
from __future__ import annotations

import importlib.util
import types
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
import yaml

from matimo.errors import MatimoError

TOOL_DIR = Path(__file__).parent.parent.parent / "src" / "matimo" / "tools" / "web_scraper"
DEFINITION_PATH = TOOL_DIR / "definition.yaml"
MODULE_PATH = TOOL_DIR / "web_scraper.py"


def _load_module() -> types.ModuleType:
    """Import web_scraper.py directly from disk, mirroring FunctionExecutor's loader."""
    spec = importlib.util.spec_from_file_location("matimo_tool_web_scraper", MODULE_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def mod() -> types.ModuleType:
    return _load_module()


@pytest.fixture()
def definition() -> dict[str, Any]:
    return yaml.safe_load(DEFINITION_PATH.read_text())  # type: ignore[no-any-return]


ARTICLE_BODY = """
      <p>This is the first paragraph of a genuinely long and substantive piece of writing
      that readability heuristics should recognize as the main article content, since it
      needs enough text density and paragraph structure to beat out the boilerplate nav and
      footer sections that surround it in the page.</p>
      <p>Here is a second paragraph continuing the same thought, with a
      <a href="https://example.com/ref">reference link</a> included inline, and more
      substantive prose to ensure the scoring favors this block of content over the
      surrounding chrome elements on the page.</p>
      <p>And a third paragraph for good measure, further building out the article body so
      that automatic content extraction confidently identifies this as the primary content
      region of the document rather than any of the navigational boilerplate.</p>"""


def article_page(title: str, links: list[str] | None = None) -> str:
    link_tags = "\n".join(f'<a href="{href}">link to {href}</a>' for href in (links or []))
    return f"""<!DOCTYPE html>
<html>
  <head><title>{title}</title><meta name="author" content="Jane Doe"></head>
  <body>
    <nav>{link_tags}</nav>
    <article>
      <h1>{title}</h1>
      {ARTICLE_BODY}
    </article>
    <footer>Copyright 2024 Example Corp.</footer>
  </body>
</html>
"""


NON_ARTICLE_HTML = """<!DOCTYPE html>
<html>
  <head><title>Tiny Page</title></head>
  <body><p>Just one short line.</p></body>
</html>
"""

EMPTY_HTML = "<!DOCTYPE html><html><head><title>Empty</title></head><body></body></html>"


def mock_site(responder: Callable[[httpx.Request], httpx.Response]) -> None:
    respx.route(host="example.com").mock(side_effect=responder)


def robots_and_single_page(html: str) -> Callable[[httpx.Request], httpx.Response]:
    def responder(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, text=html, headers={"content-type": "text/html; charset=utf-8"})

    return responder


# ── YAML definition ──────────────────────────────────────────────────────


class TestDefinition:
    def test_definition_valid(self, definition: dict[str, Any]) -> None:
        assert definition["name"] == "web_scraper"
        assert definition["version"] == "2.0.0"
        assert definition["execution"]["type"] == "function"
        assert definition["execution"]["code"] == "./web_scraper.py"
        assert definition["requires_approval"] is True

    def test_parameters(self, definition: dict[str, Any]) -> None:
        params = definition["parameters"]
        assert params["url"]["required"] is True
        assert params["maxPages"]["required"] is False
        assert params["maxDepth"]["required"] is False
        assert params["format"]["enum"] == ["text", "markdown", "both"]
        assert params["respectRobotsTxt"]["required"] is False
        assert params["requestDelayMs"]["required"] is False
        assert params["maxDurationMs"]["required"] is False

    def test_examples_present(self, definition: dict[str, Any]) -> None:
        assert len(definition["examples"]) >= 1


# ── URL validation ─────────────────────────────────────────────────────────


class TestUrlValidation:
    pytestmark = pytest.mark.asyncio

    async def test_missing_url_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError, match="required"):
            await mod.run({"url": ""})

    async def test_malformed_url_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError, match="Invalid URL"):
            await mod.run({"url": "not a url"})

    async def test_non_http_protocol_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError, match="Invalid URL"):
            await mod.run({"url": "ftp://example.com/file"})

    @pytest.mark.parametrize(
        "url",
        [
            "http://localhost/admin",
            "http://127.0.0.1/secret",
            "http://[::1]/secret",
            "http://169.254.169.254/latest/meta-data",
            "http://10.0.0.5/internal",
            "http://192.168.1.1/router",
            "http://172.16.0.1/internal",
            "http://172.31.255.255/internal",
        ],
    )
    async def test_blocks_ssrf_targets(self, mod: types.ModuleType, url: str) -> None:
        with pytest.raises(MatimoError, match="blocked internal/metadata address"):
            await mod.run({"url": url})


# ── Parameter validation ─────────────────────────────────────────────────


class TestParameterValidation:
    pytestmark = pytest.mark.asyncio

    async def test_non_numeric_max_pages_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError, match="maxPages"):
            await mod.run({"url": "https://example.com/a", "maxPages": "lots"})

    @respx.mock
    async def test_clamps_max_pages_above_hard_cap(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(NON_ARTICLE_HTML))
        result = await mod.run({"url": "https://example.com/a", "maxPages": 99999, "maxDepth": 0})
        assert result["success"] is True


# ── Single page crawl (maxDepth 0) ──────────────────────────────────────


class TestSinglePage:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_fetches_only_starting_page(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(article_page("Home", ["https://example.com/other"])))
        result = await mod.run({"url": "https://example.com/", "maxDepth": 0})

        assert result["success"] is True
        assert result["pagesCrawled"] == 1
        assert result["pages"][0]["depth"] == 0
        assert "Home" in result["pages"][0]["title"]

    @respx.mock
    async def test_extracts_plain_text_by_default(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(article_page("Article")))
        result = await mod.run({"url": "https://example.com/article", "maxDepth": 0})
        page = result["pages"][0]

        assert "first paragraph" in page["text"]
        assert "<p>" not in page["text"]
        assert "markdown" not in page
        assert page["metadata"]["statusCode"] == 200
        assert page["metadata"]["byline"] == "Jane Doe"

    @respx.mock
    async def test_extracts_markdown_strips_links_by_default(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(article_page("Article")))
        result = await mod.run({"url": "https://example.com/article", "maxDepth": 0, "format": "markdown"})
        page = result["pages"][0]

        assert "text" not in page
        assert "first paragraph" in page["markdown"]
        assert "](" not in page["markdown"]

    @respx.mock
    async def test_preserves_links_when_include_links_true(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(article_page("Article")))
        result = await mod.run(
            {
                "url": "https://example.com/article",
                "maxDepth": 0,
                "format": "markdown",
                "includeLinks": True,
            }
        )
        assert "[reference link](https://example.com/ref)" in result["pages"][0]["markdown"]

    @respx.mock
    async def test_both_formats_returns_text_and_markdown(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(article_page("Article")))
        result = await mod.run({"url": "https://example.com/article", "maxDepth": 0, "format": "both"})
        page = result["pages"][0]
        assert page["text"]
        assert page["markdown"]

    @respx.mock
    async def test_falls_back_to_body_text_when_no_article_found(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(EMPTY_HTML))
        result = await mod.run({"url": "https://example.com/empty", "maxDepth": 0})
        assert result["pages"][0]["text"] == ""

    @respx.mock
    async def test_falls_back_to_body_text_for_tiny_page(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(NON_ARTICLE_HTML))
        result = await mod.run({"url": "https://example.com/tiny", "maxDepth": 0})
        assert "Just one short line." in result["pages"][0]["text"]

    @respx.mock
    async def test_truncates_content_beyond_max_content_length(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(article_page("Article")))
        result = await mod.run(
            {"url": "https://example.com/article", "maxDepth": 0, "maxContentLength": 20}
        )
        page = result["pages"][0]
        assert len(page["text"]) == 20
        assert page["truncated"] is True
        # truncatedCrawl reflects the crawl stopping early, independent of per-page
        # content truncation; with maxDepth 0 the crawl completes fully.
        assert result["truncatedCrawl"] is False


# ── Multi-page crawling ──────────────────────────────────────────────────


class TestMultiPageCrawling:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_follows_links_and_dedupes_revisits(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/":
                return httpx.Response(
                    200,
                    text=article_page("Home", ["https://example.com/page-a", "https://example.com/page-b"]),
                    headers={"content-type": "text/html"},
                )
            if path == "/page-a":
                return httpx.Response(
                    200,
                    text=article_page("Page A", ["https://example.com/", "https://example.com/page-c"]),
                    headers={"content-type": "text/html"},
                )
            if path in ("/page-b", "/page-c"):
                title = "Page B" if path == "/page-b" else "Page C"
                return httpx.Response(200, text=article_page(title), headers={"content-type": "text/html"})
            # articlePage()'s body always includes an inline same-domain reference link
            # (/ref); leave it unhandled here so it's recorded as a per-page crawl error
            # rather than a real page, mirroring the TS test's equivalent fixture.
            raise httpx.ConnectError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        result = await mod.run(
            {"url": "https://example.com/", "maxDepth": 2, "maxPages": 10, "requestDelayMs": 0}
        )

        urls = sorted(p["url"] for p in result["pages"])
        assert urls == [
            "https://example.com/",
            "https://example.com/page-a",
            "https://example.com/page-b",
            "https://example.com/page-c",
        ]
        assert result["pagesCrawled"] == 4
        assert result["truncatedCrawl"] is False

    @respx.mock
    async def test_does_not_follow_other_hostnames(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            if str(request.url) == "https://example.com/":
                return httpx.Response(
                    200,
                    text=article_page("Home", ["https://other-domain.com/page"]),
                    headers={"content-type": "text/html"},
                )
            raise AssertionError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/", "requestDelayMs": 0})
        assert result["pagesCrawled"] == 1

    @respx.mock
    async def test_stops_at_max_pages_and_reports_truncated(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            if request.url.path == "/":
                return httpx.Response(
                    200,
                    text=article_page(
                        "Home",
                        [
                            "https://example.com/page-a",
                            "https://example.com/page-b",
                            "https://example.com/page-c",
                        ],
                    ),
                    headers={"content-type": "text/html"},
                )
            return httpx.Response(200, text=article_page("Some Page"), headers={"content-type": "text/html"})

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/", "maxPages": 2, "requestDelayMs": 0})
        assert result["pagesCrawled"] == 2
        assert result["truncatedCrawl"] is True

    @respx.mock
    async def test_records_per_page_errors_without_aborting(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/":
                return httpx.Response(
                    200,
                    text=article_page("Home", ["https://example.com/broken"]),
                    headers={"content-type": "text/html"},
                )
            if path == "/broken":
                raise httpx.ConnectError("ECONNRESET")
            if path == "/ref":
                return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})
            raise AssertionError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/", "requestDelayMs": 0})

        assert result["success"] is True
        assert result["pagesCrawled"] == 2
        assert len(result["errors"]) == 1
        assert result["errors"][0]["url"] == "https://example.com/broken"

    @respx.mock
    async def test_raises_when_starting_page_cannot_be_fetched(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            raise httpx.ConnectError("ECONNREFUSED")

        mock_site(responder)

        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/"})


# ── robots.txt handling ───────────────────────────────────────────────────


class TestRobotsTxt:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_rejects_start_url_disallowed_by_robots(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
            raise AssertionError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        with pytest.raises(MatimoError, match="robots.txt disallows"):
            await mod.run({"url": "https://example.com/private/page"})

    @respx.mock
    async def test_skips_disallowed_links_without_failing(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
            if path == "/":
                return httpx.Response(
                    200,
                    text=article_page(
                        "Home", ["https://example.com/private/page", "https://example.com/public"]
                    ),
                    headers={"content-type": "text/html"},
                )
            if path == "/public":
                return httpx.Response(200, text=article_page("Public"), headers={"content-type": "text/html"})
            # articlePage()'s body always includes an inline same-domain reference link
            # (/ref); leave it unhandled so it's recorded as a per-page crawl error
            # rather than a real page, mirroring the TS test's equivalent fixture.
            raise httpx.ConnectError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/", "requestDelayMs": 0})

        assert result["pagesCrawled"] == 2
        assert not any("/private" in p["url"] for p in result["pages"])
        assert result["skippedByRobots"] == 1

    @respx.mock
    async def test_proceeds_when_robots_unreachable(self, mod: types.ModuleType) -> None:
        mock_site(robots_and_single_page(NON_ARTICLE_HTML))
        result = await mod.run({"url": "https://example.com/", "maxDepth": 0})
        assert result["success"] is True

    @respx.mock
    async def test_skips_robots_fetch_when_disabled(self, mod: types.ModuleType) -> None:
        route = respx.get("https://example.com/").mock(
            return_value=httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})
        )
        result = await mod.run({"url": "https://example.com/", "maxDepth": 0, "respectRobotsTxt": False})
        assert result["success"] is True
        assert route.called
        assert route.call_count == 1

    @respx.mock
    async def test_allows_all_when_no_matching_group(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: SomeOtherBot\nDisallow: /\n")
            return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})

        mock_site(responder)
        result = await mod.run({"url": "https://example.com/anything", "maxDepth": 0})
        assert result["success"] is True

    @respx.mock
    async def test_allow_overrides_broader_disallow(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(
                    200, text="User-agent: *\nDisallow: /blog\nAllow: /blog/public\n"
                )
            return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})

        mock_site(responder)
        result = await mod.run({"url": "https://example.com/blog/public/post", "maxDepth": 0})
        assert result["success"] is True


# ── Redirect handling ────────────────────────────────────────────────────


class TestRedirects:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_follows_safe_redirect(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/redirect-me":
                return httpx.Response(302, headers={"location": "https://example.com/final"})
            if path == "/final":
                return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})
            raise AssertionError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/redirect-me", "maxDepth": 0})
        assert result["success"] is True
        assert result["pages"][0]["resolvedUrl"] == "https://example.com/final"

    @respx.mock
    async def test_blocks_redirect_to_internal_address(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data"})

        mock_site(responder)

        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/redirect-me"})

    @respx.mock
    async def test_too_many_redirects_raises(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            n = request.url.path.strip("/")
            next_n = int(n) + 1 if n.isdigit() else 1
            return httpx.Response(302, headers={"location": f"https://example.com/{next_n}"})

        mock_site(responder)

        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/0"})


# ── Additional edge cases ─────────────────────────────────────────────────


class TestAdditionalEdgeCases:
    pytestmark = pytest.mark.asyncio

    @respx.mock
    async def test_skips_unparseable_href_without_failing(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/":
                html = f"""<!DOCTYPE html><html><head><title>Home</title></head><body>
                  <nav>
                    <a href="http://[not-a-valid-host">broken link</a>
                    <a href="https://example.com/valid-page">valid link</a>
                  </nav>
                  <article>{ARTICLE_BODY}</article>
                </body></html>"""
                return httpx.Response(200, text=html, headers={"content-type": "text/html"})
            if path == "/valid-page":
                return httpx.Response(200, text=article_page("Valid Page"), headers={"content-type": "text/html"})
            if path == "/ref":
                return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})
            raise AssertionError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/", "requestDelayMs": 0})
        assert result["success"] is True
        assert any(p["url"] == "https://example.com/valid-page" for p in result["pages"])

    @respx.mock
    async def test_applies_request_delay_between_fetches(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/":
                return httpx.Response(
                    200,
                    text=article_page("Home", ["https://example.com/page-a"]),
                    headers={"content-type": "text/html"},
                )
            if path == "/ref":
                return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})
            return httpx.Response(200, text=article_page("Page A"), headers={"content-type": "text/html"})

        mock_site(responder)

        result = await mod.run({"url": "https://example.com/", "requestDelayMs": 1})
        assert result["pagesCrawled"] >= 2

    @respx.mock
    async def test_stops_early_once_max_duration_exceeded(
        self, mod: types.ModuleType, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/":
                return httpx.Response(
                    200,
                    text=article_page("Home", ["https://example.com/page-a"]),
                    headers={"content-type": "text/html"},
                )
            return httpx.Response(200, text=article_page("Page A"), headers={"content-type": "text/html"})

        mock_site(responder)

        real_monotonic: Callable[[], float] = mod.monotonic
        call_count = {"n": 0}

        def fake_monotonic() -> float:
            call_count["n"] += 1
            return real_monotonic() if call_count["n"] <= 2 else real_monotonic() + 600

        monkeypatch.setattr(mod, "monotonic", fake_monotonic)

        result = await mod.run(
            {"url": "https://example.com/", "maxDurationMs": 1000, "requestDelayMs": 0}
        )

        assert result["pagesCrawled"] == 1
        assert result["truncatedCrawl"] is True


class TestFetchPageErrorBranches:
    pytestmark = pytest.mark.asyncio

    async def test_non_finite_max_pages_raises(self, mod: types.ModuleType) -> None:
        with pytest.raises(MatimoError, match="maxPages"):
            await mod.run({"url": "https://example.com/a", "maxPages": float("nan")})

    @respx.mock
    async def test_robots_txt_fetch_error_treated_as_allow_all(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                raise httpx.ConnectError("robots unreachable")
            return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})

        mock_site(responder)
        result = await mod.run({"url": "https://example.com/", "maxDepth": 0})
        assert result["success"] is True

    @respx.mock
    async def test_malformed_robots_line_is_ignored(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="not-a-directive-without-colon\nUser-agent: *\nDisallow:\n")
            return httpx.Response(200, text=NON_ARTICLE_HTML, headers={"content-type": "text/html"})

        mock_site(responder)
        result = await mod.run({"url": "https://example.com/", "maxDepth": 0})
        assert result["success"] is True

    @respx.mock
    async def test_redirect_missing_location_header_raises(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            return httpx.Response(302)  # no Location header

        mock_site(responder)
        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/"})

    @respx.mock
    async def test_non_2xx_status_raises(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            return httpx.Response(500)

        mock_site(responder)
        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/"})

    @respx.mock
    async def test_response_too_large_raises(self, mod: types.ModuleType) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            return httpx.Response(200, text=article_page("Big"), headers={"content-type": "text/html"})

        mock_site(responder)
        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/", "maxSizeBytes": 10})

    @respx.mock
    async def test_redirect_to_blocked_address_via_empty_host_is_also_blocked(
        self, mod: types.ModuleType
    ) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404)
            return httpx.Response(302, headers={"location": "http:///no-host"})

        mock_site(responder)
        with pytest.raises(MatimoError, match="Failed to crawl any page"):
            await mod.run({"url": "https://example.com/"})

    @respx.mock
    async def test_ignores_anchor_without_href_and_non_http_scheme_links(
        self, mod: types.ModuleType
    ) -> None:
        def responder(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/robots.txt":
                return httpx.Response(404)
            if path == "/":
                html = f"""<!DOCTYPE html><html><head><title>Home</title></head><body>
                  <nav>
                    <a>no href at all</a>
                    <a href="mailto:someone@example.com">mailto link</a>
                    <a href="javascript:void(0)">js link</a>
                    <a href="https://example.com/valid-page">valid link</a>
                  </nav>
                  <article>{ARTICLE_BODY}</article>
                </body></html>"""
                return httpx.Response(200, text=html, headers={"content-type": "text/html"})
            if path == "/valid-page":
                return httpx.Response(200, text=article_page("Valid Page"), headers={"content-type": "text/html"})
            raise httpx.ConnectError(f"Unexpected fetch in test: {request.url}")

        mock_site(responder)
        result = await mod.run({"url": "https://example.com/", "requestDelayMs": 0})
        assert any(p["url"] == "https://example.com/valid-page" for p in result["pages"])
