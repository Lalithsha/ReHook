import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../configs/env.config.js';

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) return isPrivateIpv4(address);
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('::ffff:127.') ||
      normalized.startsWith('::ffff:10.') ||
      normalized.startsWith('::ffff:192.168.')
    );
  }
  return true;
}

export async function assertSafeTargetUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Target URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Target URL must not contain embedded credentials');
  }
  if (config.allowPrivateWebhookTargets) return url;

  const results = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (results.length === 0 || results.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Target URL resolves to a private, loopback, link-local, or reserved address');
  }
  return url;
}
