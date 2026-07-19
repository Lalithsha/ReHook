import crypto from 'crypto';

/**
 * Constant-time comparison for API keys to prevent timing attacks
 */
export function compareApiKeys(providedKey: string, expectedKey: string): boolean {
  if (providedKey.length !== expectedKey.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
}

/**
 * Generates HMAC-SHA256 signature for webhook payload
 */
export function generateHmacSignature(payloadStr: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadStr, 'utf8').digest('hex');
}

/**
 * Generates X-ReHook-Signature header supporting dual-key rotation
 * Output format: t=1784487755,v1=sha256_v1[,v2=sha256_v2]
 */
export function buildSignatureHeader(
  payload: Record<string, any>,
  secretV1: string,
  secretV2?: string
): { signatureHeader: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadToSign = `${timestamp}.${JSON.stringify(payload)}`;

  const sigV1 = generateHmacSignature(payloadToSign, secretV1);
  let headerValue = `t=${timestamp},v1=${sigV1}`;

  if (secretV2) {
    const sigV2 = generateHmacSignature(payloadToSign, secretV2);
    headerValue += `,v2=${sigV2}`;
  }

  return {
    signatureHeader: headerValue,
    timestamp,
  };
}
