import { isBlockedAddress, isBlockedHostname } from '../../../src/policy/ssrf';
import { isSSRFTarget } from '../../../src/policy/content-validator';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '127.0.0.2',
    '127.255.255.255',
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:169.254.169.254',
    '::ffff:a9fe:a9fe',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
    'fd00:ec2::254',
    'fc00::1',
    'fe80::1',
    'fe80::1%eth0',
    'ff02::1',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '198.17.255.255',
    '198.20.0.1',
    '2606:4700:4700::1111',
    '2001:4860:4860::8888',
    '::ffff:8.8.8.8',
  ])('allows %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it('does not classify hostnames', () => {
    expect(isBlockedAddress('example.com')).toBe(false);
  });
});

describe('isBlockedHostname', () => {
  it.each([
    'localhost',
    'localhost.',
    'LOCALHOST',
    'app.localhost',
    'svc.internal',
    'metadata.google.internal',
    'printer.local',
    '[::1]',
    '[::]',
    '127.0.0.2',
  ])('blocks %s', (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it.each(['example.com', 'api.slack.com', 'localhost.example.com', '8.8.8.8'])(
    'allows %s',
    (host) => {
      expect(isBlockedHostname(host)).toBe(false);
    }
  );
});

describe('isSSRFTarget bypass regressions', () => {
  it.each([
    'http://127.0.0.2/',
    'http://127.1/',
    'http://2130706433/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
    'http://[fe80::1]/',
    'http://[fd00:ec2::254]/',
    'http://100.64.0.1/',
    'http://localhost./',
    'http://[::]/',
  ])('blocks %s', (url) => {
    expect(isSSRFTarget(url)).toBe(true);
  });
});
