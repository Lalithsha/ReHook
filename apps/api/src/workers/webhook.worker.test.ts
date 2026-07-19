import { describe, expect, it } from 'bun:test';
import { calculateExponentialJitterBackoff } from '../utils/backoff.utils.js';

describe('Worker Delivery & Retry Logic', () => {
  it('should calculate exponential backoff with full jitter for consecutive attempts', () => {
    const initialDelay = 1000;
    const maxDelay = 60000;

    // Attempt 1: max range = 1000 * 2^0 = 1000ms
    const delay1 = calculateExponentialJitterBackoff(1, initialDelay, maxDelay);
    expect(delay1).toBeGreaterThanOrEqual(0);
    expect(delay1).toBeLessThanOrEqual(1000);

    // Attempt 2: max range = 1000 * 2^1 = 2000ms
    const delay2 = calculateExponentialJitterBackoff(2, initialDelay, maxDelay);
    expect(delay2).toBeGreaterThanOrEqual(0);
    expect(delay2).toBeLessThanOrEqual(2000);

    // Attempt 5: max range = 1000 * 2^4 = 16000ms
    const delay5 = calculateExponentialJitterBackoff(5, initialDelay, maxDelay);
    expect(delay5).toBeGreaterThanOrEqual(0);
    expect(delay5).toBeLessThanOrEqual(16000);
  });

  it('should cap max delay when backoff exceeds maximum allowed threshold', () => {
    const initialDelay = 10000;
    const maxDelay = 30000; // 30s max cap

    // Attempt 10: 10000 * 2^9 = 5,120,000ms -> should cap at 30,000ms
    const delay10 = calculateExponentialJitterBackoff(10, initialDelay, maxDelay);
    expect(delay10).toBeGreaterThanOrEqual(0);
    expect(delay10).toBeLessThanOrEqual(30000);
  });
});
