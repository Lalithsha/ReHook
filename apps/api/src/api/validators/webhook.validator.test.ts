import { describe, expect, it } from 'bun:test';
import { registerWebhookSchema } from './webhook.validator.js';

describe('Webhook Validator Schema (Zod)', () => {
  it('should validate a correct webhook registration payload', () => {
    const validPayload = {
      target_url: 'https://httpbin.org/post',
      event_type: 'payment.succeeded',
      payload: {
        transaction_id: 'tx_9981',
        amount: 500,
      },
      retry_config: {
        max_attempts: 5,
        initial_delay_ms: 3000,
      },
    };

    const result = registerWebhookSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_url).toBe('https://httpbin.org/post');
      expect(result.data.event_type).toBe('payment.succeeded');
    }
  });

  it('should reject invalid target_url values', () => {
    const invalidPayload = {
      target_url: 'not-a-valid-url',
      event_type: 'order.placed',
      payload: {},
    };

    const result = registerWebhookSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it('should reject missing event_type values', () => {
    const invalidPayload = {
      target_url: 'https://httpbin.org/post',
      payload: {},
    };

    const result = registerWebhookSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});
