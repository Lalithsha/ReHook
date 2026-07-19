/**
 * Calculates exponential backoff delay with randomized full jitter
 * Formula: Sleep = random(0, min(maxBackoff, initialDelay * 2^(attempt - 1)))
 */
export function calculateExponentialJitterBackoff(
  attemptCount: number,
  initialDelayMs: number = 5000,
  maxDelayMs: number = 3600000 // 1 hour max
): number {
  const exponentialDelay = initialDelayMs * Math.pow(2, Math.max(0, attemptCount - 1));
  const cappedDelay = Math.min(maxDelayMs, exponentialDelay);
  // Full jitter: uniform random number between 0 and cappedDelay
  return Math.floor(Math.random() * cappedDelay);
}
