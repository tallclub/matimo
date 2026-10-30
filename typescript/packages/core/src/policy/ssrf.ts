/**
 * SSRF address classification.
 *
 * Pure helpers shared by the content validator (URL-level check), the HTTP
 * executor's DNS lookup (resolve-and-pin) and its redirect hook, so all three
 * agree on what counts as an internal address.
 */

import net from 'net';

/** [network, prefix length] blocks that must never be reached from a tool. */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "this" network, includes 0.0.0.0
  ['10.0.0.0', 8], // RFC 1918
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // RFC 1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // RFC 1918
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes 255.255.255.255
];

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.internal', '.local', '.localdomain'];

function ipv4ToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([network, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToInt(network) & mask) >>> 0;
  });
}

/** Parse an IPv6 literal into 16 bytes. Returns null when it is not valid IPv6. */
function ipv6ToBytes(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);

  // Fold a trailing dotted IPv4 (::ffff:1.2.3.4) into two hex groups.
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    const v4 = s.slice(lastColon + 1);
    if (!net.isIPv4(v4)) return null;
    const p = v4.split('.').map(Number);
    s = `${s.slice(0, lastColon + 1)}${((p[0] << 8) | p[1]).toString(16)}:${(
      (p[2] << 8) |
      p[3]
    ).toString(16)}`;
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

  let groups: string[];
  if (halves.length === 1) {
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const n = parseInt(group, 16);
    bytes.push(n >> 8, n & 0xff);
  }
  return bytes;
}

function v4FromBytes(bytes: number[], offset: number): string {
  return bytes.slice(offset, offset + 4).join('.');
}

function isBlockedIPv6(ip: string): boolean {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // net.isIPv6 said yes but we cannot parse it: fail closed

  const allZero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);

  if (allZero(0, 16)) return true; // ::
  if (allZero(0, 15) && b[15] === 1) return true; // ::1
  if (allZero(0, 10) && b[10] === 0xff && b[11] === 0xff) return isBlockedIPv4(v4FromBytes(b, 12)); // ::ffff:a.b.c.d
  if (allZero(0, 12)) return isBlockedIPv4(v4FromBytes(b, 12)); // deprecated IPv4-compatible
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && allZero(4, 12)) {
    return isBlockedIPv4(v4FromBytes(b, 12)); // NAT64 64:ff9b::/96
  }
  if (b[0] === 0x20 && b[1] === 0x02) return isBlockedIPv4(v4FromBytes(b, 2)); // 6to4
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return true; // Teredo
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local (includes fd00:ec2::254)
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true; // fec0::/10 site-local
  if (b[0] === 0xff) return true; // multicast
  return false;
}

/** True when an IP literal (v4 or v6, no brackets) is an internal address. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  return false;
}

/**
 * True when a hostname (already lower-cased, as URL.hostname gives it) targets
 * an internal address or an internal-only name. Brackets and trailing dots are
 * normalised here so `[::1]` and `localhost.` cannot dodge the check.
 */
export function isBlockedHostname(hostname: string): boolean {
  let host = hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  let end = host.length;
  while (end > 0 && host.charCodeAt(end - 1) === 46) end--; // trailing dots
  host = host.slice(0, end);

  if (net.isIP(host)) return isBlockedAddress(host);
  if (host === 'localhost') return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * True when a full URL targets an internal address or name. `failClosed`
 * decides what an unparseable URL means: tools that are about to fetch it
 * should refuse (true); policy checks that see unresolved templates should not
 * (false, the default).
 */
export function isBlockedUrl(url: string, failClosed = false): boolean {
  if (!url) return false;
  try {
    return isBlockedHostname(new URL(url).hostname);
  } catch {
    return failClosed;
  }
}
