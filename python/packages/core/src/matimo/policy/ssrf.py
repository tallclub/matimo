"""SSRF address classification and connect-time guard.

Single source of truth for "is this an internal address?", shared by the content
validator, the default policy, the HTTP executor and the network tools.
Mirrors: packages/core/src/policy/ssrf.ts and executors/ssrf-guard.ts
"""
from __future__ import annotations

import asyncio
import ipaddress
import os
import socket
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

from matimo.errors import ErrorCode, MatimoError

if TYPE_CHECKING:
    import httpx

ALLOW_PRIVATE_DNS_ENV = "MATIMO_ALLOW_PRIVATE_DNS"

_BLOCKED_SUFFIXES = (".localhost", ".internal", ".local", ".localdomain")
_NAT64_PREFIX = bytes.fromhex("0064ff9b0000000000000000")


def _embedded_ipv4(addr: ipaddress.IPv6Address) -> ipaddress.IPv4Address | None:
    """Return the IPv4 address an IPv6 address wraps, if it wraps one."""
    if addr.ipv4_mapped is not None:
        return addr.ipv4_mapped
    if addr.sixtofour is not None:
        return addr.sixtofour
    packed = addr.packed
    if packed[:12] == _NAT64_PREFIX or packed[:12] == b"\x00" * 12:
        return ipaddress.IPv4Address(packed[12:])
    return None


def is_blocked_address(ip: str) -> bool:
    """True when an IP literal (v4 or v6, no brackets) is an internal address."""
    try:
        addr = ipaddress.ip_address(ip.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(addr, ipaddress.IPv6Address):
        if addr.teredo is not None:
            return True
        embedded = _embedded_ipv4(addr)
        if embedded is not None:
            addr = embedded
    return addr.is_multicast or addr.is_reserved or not addr.is_global


def _legacy_ipv4(host: str) -> str | None:
    """Normalise shorthand IPv4 (`0`, `127.1`, `2130706433`, `0x7f.1`) the way browsers
    and WHATWG URL parsers do, so it cannot dodge the check."""
    if not host or not host[0].isdigit():
        return None
    try:
        return socket.inet_ntoa(socket.inet_aton(host))
    except OSError:
        return None


def is_blocked_hostname(hostname: str) -> bool:
    """True when a hostname targets an internal address or an internal-only name.

    Brackets and trailing dots are normalised so `[::1]` and `localhost.` cannot
    dodge the check.
    """
    host = hostname.lower()
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    host = host.rstrip(".")
    if not host:
        return False
    try:
        ipaddress.ip_address(host.split("%", 1)[0])
    except ValueError:
        legacy = _legacy_ipv4(host)
        if legacy is not None:
            return is_blocked_address(legacy)
        return host == "localhost" or host.endswith(_BLOCKED_SUFFIXES)
    return is_blocked_address(host)


def is_blocked_url(url: str, fail_closed: bool = False) -> bool:
    """True when a full URL targets an internal address or name.

    `fail_closed` decides what an unparseable or host-less URL means: tools about
    to fetch it should refuse (True); policy checks that see unresolved templates
    should not (False, the default).
    """
    if not url:
        return False
    try:
        host = urlparse(url).hostname
    except ValueError:
        return fail_closed
    if not host:
        return fail_closed
    return is_blocked_hostname(host)


async def assert_public_url(url: str) -> None:
    """Raise POLICY_DENIED unless `url` is safe to connect to.

    Checks the literal host, then resolves it and rejects the request when ANY
    answer is internal (DNS rebinding, `127.0.0.1.nip.io`). Not pinned to the
    checked address: a resolver that flips between this check and connect can
    still win a narrow race; the TypeScript SDK pins via a custom lookup.
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if is_blocked_hostname(host):
        raise MatimoError(
            f"Execution blocked: URL targets an internal address: {host}",
            ErrorCode.POLICY_DENIED,
            {"hostname": host},
        )
    if os.environ.get(ALLOW_PRIVATE_DNS_ENV) == "true":
        return
    try:
        ipaddress.ip_address(host)
        return  # literal, already classified above
    except ValueError:
        pass
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            host, parsed.port, type=socket.SOCK_STREAM
        )
    except socket.gaierror:
        return  # let the HTTP client report its own resolution error
    for info in infos:
        address = str(info[4][0])
        if is_blocked_address(address):
            raise MatimoError(
                f"Execution blocked: {host} resolves to an internal address",
                ErrorCode.POLICY_DENIED,
                {"hostname": host, "address": address},
            )


async def _request_hook(request: httpx.Request) -> None:
    await assert_public_url(str(request.url))


def ssrf_event_hooks() -> dict[str, list[Any]]:
    """httpx `event_hooks` that re-validate every request, including redirect hops."""
    return {"request": [_request_hook]}
