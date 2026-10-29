/**
 * Connect-time SSRF protection for outbound HTTP.
 *
 * `isSSRFTarget` only sees the URL string. These helpers close the remaining
 * gaps: a hostname that RESOLVES to an internal address (DNS rebinding,
 * `127.0.0.1.nip.io`) and a redirect that points at an internal address.
 */

import dns from 'dns';
import http from 'http';
import https from 'https';
import { MatimoError, ErrorCode } from '../errors/matimo-error.js';
import { isBlockedAddress, isBlockedHostname } from '../policy/ssrf.js';

/**
 * Escape hatch for deployments that legitimately call internal services by DNS
 * name. Only skips the resolved-address check; literal internal IPs, internal
 * suffixes and redirects to them stay blocked.
 */
const ALLOW_PRIVATE_DNS_ENV = 'MATIMO_ALLOW_PRIVATE_DNS';

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  addressOrList?: string | dns.LookupAddress[],
  family?: number
) => void;

/**
 * dns.lookup replacement that refuses to connect to internal addresses. Because
 * the socket connects to the address returned here, the checked address is the
 * one used (no resolve-then-reconnect window for rebinding).
 */
export function ssrfSafeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: LookupCallback
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err);
      return;
    }
    const list = addresses as dns.LookupAddress[];
    if (process.env[ALLOW_PRIVATE_DNS_ENV] !== 'true') {
      const blocked = list.find((entry) => isBlockedAddress(entry.address));
      if (blocked) {
        callback(
          new MatimoError(
            `Execution blocked: ${hostname} resolves to an internal address`,
            ErrorCode.POLICY_DENIED,
            { hostname }
          ) as unknown as NodeJS.ErrnoException
        );
        return;
      }
    }
    if (options.all) {
      callback(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
}

/** Redirect hook: re-validate every hop before the next request is made. */
export function ssrfBeforeRedirect(options: Record<string, unknown>): void {
  const hostname = String(options.hostname ?? options.host ?? '');
  if (hostname && isBlockedHostname(hostname)) {
    throw new MatimoError(
      `Execution blocked: redirect targets an internal address: ${hostname}`,
      ErrorCode.POLICY_DENIED,
      { hostname }
    );
  }
}

export const ssrfHttpAgent = new http.Agent({ lookup: ssrfSafeLookup as never });
export const ssrfHttpsAgent = new https.Agent({ lookup: ssrfSafeLookup as never });
