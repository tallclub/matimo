import dns from 'dns';
import { ssrfSafeLookup, ssrfBeforeRedirect } from '../../src/executors/ssrf-guard';
import { ErrorCode } from '../../src/errors/matimo-error';

jest.mock('dns');
const mockedLookup = dns.lookup as unknown as jest.Mock;

function resolveTo(...addresses: string[]) {
  mockedLookup.mockImplementation((_host: string, _opts: unknown, cb: (...a: unknown[]) => void) =>
    cb(
      null,
      addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))
    )
  );
}

function lookup(host: string, all = false): Promise<{ err: unknown; result: unknown }> {
  return new Promise((resolve) =>
    ssrfSafeLookup(host, { all }, (err, result, family) =>
      resolve({ err, result: all ? result : [result, family] })
    )
  );
}

describe('ssrfSafeLookup', () => {
  const saved = process.env.MATIMO_ALLOW_PRIVATE_DNS;
  afterEach(() => {
    jest.resetAllMocks();
    if (saved === undefined) delete process.env.MATIMO_ALLOW_PRIVATE_DNS;
    else process.env.MATIMO_ALLOW_PRIVATE_DNS = saved;
  });

  it('rejects a name that resolves to loopback (rebinding / nip.io)', async () => {
    resolveTo('127.0.0.1');
    const { err } = await lookup('127.0.0.1.nip.io');
    expect(err).toMatchObject({ code: ErrorCode.POLICY_DENIED });
  });

  it('rejects when any resolved address is internal', async () => {
    resolveTo('93.184.216.34', '169.254.169.254');
    const { err } = await lookup('mixed.example.com', true);
    expect(err).toMatchObject({ code: ErrorCode.POLICY_DENIED });
  });

  it('rejects an IPv4-mapped IPv6 answer', async () => {
    resolveTo('::ffff:10.0.0.1');
    const { err } = await lookup('sneaky.example.com');
    expect(err).toBeTruthy();
  });

  it('passes through public addresses in single and all modes', async () => {
    resolveTo('93.184.216.34');
    expect(await lookup('example.com')).toEqual({ err: null, result: ['93.184.216.34', 4] });
    expect(await lookup('example.com', true)).toEqual({
      err: null,
      result: [{ address: '93.184.216.34', family: 4 }],
    });
  });

  it('propagates resolver errors', async () => {
    mockedLookup.mockImplementation((_h: string, _o: unknown, cb: (e: Error) => void) =>
      cb(new Error('ENOTFOUND'))
    );
    const { err } = await lookup('nope.example.com');
    expect((err as Error).message).toBe('ENOTFOUND');
  });

  it('MATIMO_ALLOW_PRIVATE_DNS=true permits internal resolution', async () => {
    process.env.MATIMO_ALLOW_PRIVATE_DNS = 'true';
    resolveTo('10.0.0.5');
    const { err } = await lookup('corp-api.example.com');
    expect(err).toBeNull();
  });
});

describe('ssrfBeforeRedirect', () => {
  it.each(['127.0.0.2', '169.254.169.254', '::1', 'localhost', 'svc.internal'])(
    'blocks a redirect to %s',
    (hostname) => {
      expect(() => ssrfBeforeRedirect({ hostname })).toThrow(/internal address/);
    }
  );

  it('allows a redirect to a public host', () => {
    expect(() => ssrfBeforeRedirect({ hostname: 'cdn.example.com' })).not.toThrow();
  });
});
