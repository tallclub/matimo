"""SSRF address classification and connect-time guard (mirrors ssrf.test.ts / ssrf-guard.test.ts)."""
from __future__ import annotations

import socket

import httpx
import pytest

from matimo.errors import ErrorCode, MatimoError
from matimo.policy.content_validator import is_ssrf_target
from matimo.policy.ssrf import (
    assert_public_url,
    is_blocked_address,
    is_blocked_hostname,
    is_blocked_url,
    ssrf_event_hooks,
)

BLOCKED_IPS = [
    "127.0.0.1", "127.0.0.2", "0.0.0.0", "10.1.2.3", "100.64.0.1", "100.127.255.255",  # noqa: S104
    "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.0.1", "198.18.0.1",
    "224.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1",
    "::ffff:169.254.169.254", "64:ff9b::7f00:1", "2002:7f00:1::", "fd00:ec2::254",
    "fc00::1", "fe80::1", "fe80::1%eth0", "ff02::1",
]
ALLOWED_IPS = [
    "8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255", "100.128.0.1",
    "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8",
]


@pytest.mark.parametrize("ip", BLOCKED_IPS)
def test_blocks_internal_addresses(ip: str) -> None:
    assert is_blocked_address(ip) is True


@pytest.mark.parametrize("ip", ALLOWED_IPS)
def test_allows_public_addresses(ip: str) -> None:
    assert is_blocked_address(ip) is False


def test_address_check_ignores_hostnames() -> None:
    assert is_blocked_address("example.com") is False


@pytest.mark.parametrize(
    "host",
    ["localhost", "localhost.", "LOCALHOST", "app.localhost", "svc.internal",
     "metadata.google.internal", "printer.local", "[::1]", "[::]", "127.0.0.2",
     "0", "127.1", "2130706433", "0x7f.1"],
)
def test_blocks_internal_hostnames(host: str) -> None:
    assert is_blocked_hostname(host) is True


@pytest.mark.parametrize("host", ["example.com", "api.slack.com", "localhost.example.com", "8.8.8.8", "3com.com"])
def test_allows_public_hostnames(host: str) -> None:
    assert is_blocked_hostname(host) is False


@pytest.mark.parametrize(
    "url",
    ["http://127.0.0.2/", "http://[::ffff:127.0.0.1]/", "http://[::ffff:169.254.169.254]/",
     "http://[fe80::1]/", "http://[fd00:ec2::254]/", "http://100.64.0.1/", "http://localhost./",
     "http://[::]/", "http://0/"],
)
def test_ssrf_target_regressions(url: str) -> None:
    assert is_ssrf_target(url) is True


def test_is_blocked_url_fail_modes() -> None:
    assert is_blocked_url("") is False
    assert is_blocked_url("not a url", fail_closed=True) is True
    assert is_blocked_url("not a url") is False
    assert is_blocked_url("https://example.com/x") is False


def _resolve_to(monkeypatch: pytest.MonkeyPatch, *addresses: str) -> None:
    async def fake_getaddrinfo(host: str, port: int | None, **_: object) -> list[tuple]:  # type: ignore[type-arg]
        return [
            (socket.AF_INET6 if ":" in a else socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, port or 0))
            for a in addresses
        ]

    import asyncio

    loop_cls = type(asyncio.new_event_loop())
    monkeypatch.setattr(loop_cls, "getaddrinfo", lambda self, *a, **k: fake_getaddrinfo(*a, **k))


@pytest.mark.asyncio
async def test_rejects_name_resolving_to_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    _resolve_to(monkeypatch, "127.0.0.1")
    with pytest.raises(MatimoError) as exc:
        await assert_public_url("http://127.0.0.1.nip.io/")
    assert exc.value.code == ErrorCode.POLICY_DENIED


@pytest.mark.asyncio
async def test_rejects_when_any_answer_is_internal(monkeypatch: pytest.MonkeyPatch) -> None:
    _resolve_to(monkeypatch, "93.184.216.34", "169.254.169.254")
    with pytest.raises(MatimoError):
        await assert_public_url("https://mixed.example.com/")


@pytest.mark.asyncio
async def test_allows_public_resolution(monkeypatch: pytest.MonkeyPatch) -> None:
    _resolve_to(monkeypatch, "93.184.216.34")
    await assert_public_url("https://example.com/")


@pytest.mark.asyncio
async def test_private_dns_escape_hatch(monkeypatch: pytest.MonkeyPatch) -> None:
    _resolve_to(monkeypatch, "10.0.0.5")
    monkeypatch.setenv("MATIMO_ALLOW_PRIVATE_DNS", "true")
    await assert_public_url("https://corp-api.example.com/")
    with pytest.raises(MatimoError):  # literal internal names stay blocked
        await assert_public_url("http://svc.internal/")


@pytest.mark.asyncio
async def test_redirect_hop_to_internal_address_is_blocked(monkeypatch: pytest.MonkeyPatch) -> None:
    _resolve_to(monkeypatch, "93.184.216.34")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "example.com":
            return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data"})
        raise AssertionError("internal address must never be requested")

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), follow_redirects=True, event_hooks=ssrf_event_hooks()
    ) as client:
        with pytest.raises(MatimoError) as exc:
            await client.get("https://example.com/")
    assert exc.value.code == ErrorCode.POLICY_DENIED
