import { describe, expect, it } from 'bun:test';
import { isPrivateAddress } from './targetUrl.utils.js';

describe('target URL network safety', () => {
  it('rejects loopback, private, link-local, and reserved addresses', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.2', '169.254.169.254', '::1', 'fd00::1']) {
      expect(isPrivateAddress(address)).toBe(true);
    }
  });

  it('allows public IP addresses', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('1.1.1.1')).toBe(false);
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });
});
