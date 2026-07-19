import { describe, expect, it } from 'bun:test';
import { calculateExponentialJitterBackoff } from './backoff.utils.js';

describe('Backoff Utilities', () => {
  it('should calculate exponential backoff with jitter within valid bounds', () => {
    const initialDelayMs = 1000;
    const maxDelayMs = 60000;

    // Test attempt 1
    const delay1 = calculateExponentialJitterBackoff(1, initialDelayMs, maxDelayMs);
    expect(delay1).toBeGreaterThanOrEqual(0);
    expect(delay1).toBeLessThanOrEqual(1000);

    // Test attempt 3 (capped exponential: 1000 * 2^2 = 4000)
    const delay3 = calculateExponentialJitterBackoff(3, initialDelayMs, maxDelayMs);
    expect(delay3).toBeGreaterThanOrEqual(0);
    expect(delay3).toBeLessThanOrEqual(4000);
  });
});
