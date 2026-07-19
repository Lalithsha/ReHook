import { describe, expect, it } from 'bun:test';
import { compareApiKeys, generateHmacSignature, buildSignatureHeader } from './crypto.utils.js';

describe('Crypto Utilities', () => {
  it('should validate API key comparisons correctly in constant time', () => {
    const validKey = 'super_secret_rehook_key_123';
    expect(compareApiKeys('super_secret_rehook_key_123', validKey)).toBe(true);
    expect(compareApiKeys('wrong_key', validKey)).toBe(false);
  });

  it('should generate consistent HMAC-SHA256 signatures', () => {
    const secret = 'my_signing_secret';
    const payload = '1784487755.{"event":"order.placed"}';
    const sig = generateHmacSignature(payload, secret);

    expect(sig).toBeTypeOf('string');
    expect(sig.length).toBe(64); // SHA256 hex length
  });

  it('should build dual-secret signature headers for zero-downtime key rotation', () => {
    const payload = { event: 'order.placed', amount: 999 };
    const secretV1 = 'secret_key_v1';
    const secretV2 = 'secret_key_v2';

    const { signatureHeader, timestamp } = buildSignatureHeader(payload, secretV1, secretV2);

    expect(signatureHeader).toContain(`t=${timestamp}`);
    expect(signatureHeader).toContain('v1=');
    expect(signatureHeader).toContain('v2=');
  });
});
