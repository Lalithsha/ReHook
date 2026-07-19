import { redisConnection } from '../configs/redis.config.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;   // Consecutive failures to open circuit (default: 5)
  failureWindowSeconds: number; // Time window for failure threshold (default: 60s)
  cooldownSeconds: number;     // Time to stay OPEN before HALF_OPEN probe (default: 30s)
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowSeconds: 60,
  cooldownSeconds: 30,
};

export class DistributedCircuitBreaker {
  private host: string;
  private config: CircuitBreakerConfig;

  constructor(targetUrl: string, config: Partial<CircuitBreakerConfig> = {}) {
    try {
      const parsedUrl = new URL(targetUrl);
      this.host = parsedUrl.host;
    } catch {
      this.host = targetUrl;
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getKey(suffix: string): string {
    return `circuit_breaker:${this.host}:${suffix}`;
  }

  /**
   * Gets current state of circuit breaker
   */
  async getState(): Promise<CircuitState> {
    const stateKey = this.getKey('state');
    const openUntilKey = this.getKey('open_until');

    const state = (await redisConnection.get(stateKey)) as CircuitState | null;

    if (!state || state === 'CLOSED') {
      return 'CLOSED';
    }

    if (state === 'OPEN') {
      const openUntilStr = await redisConnection.get(openUntilKey);
      if (openUntilStr) {
        const openUntil = parseInt(openUntilStr, 10);
        if (Date.now() >= openUntil) {
          // Cooldown expired -> Move to HALF_OPEN for probing
          await redisConnection.set(stateKey, 'HALF_OPEN');
          return 'HALF_OPEN';
        }
      }
      return 'OPEN';
    }

    return state; // HALF_OPEN
  }

  /**
   * Checks if a request is allowed to pass through
   */
  async isAllowed(): Promise<boolean> {
    const state = await this.getState();
    if (state === 'CLOSED' || state === 'HALF_OPEN') {
      return true;
    }
    return false;
  }

  /**
   * Records a successful delivery
   */
  async recordSuccess(): Promise<void> {
    const stateKey = this.getKey('state');
    const failuresKey = this.getKey('failures');
    const openUntilKey = this.getKey('open_until');

    await redisConnection.del(stateKey, failuresKey, openUntilKey);
  }

  /**
   * Records a failed delivery attempt
   */
  async recordFailure(): Promise<void> {
    const stateKey = this.getKey('state');
    const failuresKey = this.getKey('failures');
    const openUntilKey = this.getKey('open_until');

    const currentState = await this.getState();

    if (currentState === 'HALF_OPEN') {
      // Failed probe in HALF_OPEN -> Re-open circuit immediately
      const openUntil = Date.now() + this.config.cooldownSeconds * 1000;
      await redisConnection.set(stateKey, 'OPEN');
      await redisConnection.set(openUntilKey, openUntil.toString());
      return;
    }

    // Increment failures count
    const failures = await redisConnection.incr(failuresKey);
    if (failures === 1) {
      await redisConnection.expire(failuresKey, this.config.failureWindowSeconds);
    }

    if (failures >= this.config.failureThreshold) {
      const openUntil = Date.now() + this.config.cooldownSeconds * 1000;
      await redisConnection.set(stateKey, 'OPEN');
      await redisConnection.set(openUntilKey, openUntil.toString());
      console.warn(`[CircuitBreaker] Opened circuit for target host: ${this.host} for ${this.config.cooldownSeconds}s`);
    }
  }
}
