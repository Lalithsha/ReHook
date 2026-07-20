import { describe, expect, it, beforeEach } from 'bun:test';
import { redisConnection } from '../configs/redis.config.js';
import { acquireLock, releaseLock } from '../utils/lock.utils.js';
import crypto from 'crypto';

describe('Worker Concurrency & Distributed Lock Protection', () => {
  let webhookId: string;

  beforeEach(() => {
    webhookId = `test-webhook-${crypto.randomUUID()}`;
  });

  it('should allow only 1 worker process to acquire lock among 5 concurrent contenders', async () => {
    const lockKey = `lock:webhook:${webhookId}:1`;
    const numWorkers = 5;

    // Simulate 5 worker instances competing simultaneously for the exact same webhook attempt
    const workerPromises = Array.from({ length: numWorkers }, async (_, index) => {
      const token = `worker-token-${index}-${crypto.randomUUID()}`;
      const acquired = await acquireLock(redisConnection, lockKey, token, 10000);
      return { workerId: index, acquired, token };
    });

    const results = await Promise.all(workerPromises);

    const winners = results.filter((r) => r.acquired);
    const losers = results.filter((r) => !r.acquired);

    // Assert: Exactly 1 worker process wins the lock, and 4 workers are rejected safely
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(4);

    // Clean up lock with winner's token
    const winnerToken = winners[0].token;
    const released = await releaseLock(redisConnection, lockKey, winnerToken);
    expect(released).toBe(true);
  });

  it('should ensure lock auto-expires after TTL if worker process crashes', async () => {
    const lockKey = `lock:webhook:${webhookId}:ttl-test`;
    const token = crypto.randomUUID();

    // Acquire lock with short 100ms TTL
    const acquired = await acquireLock(redisConnection, lockKey, token, 100);
    expect(acquired).toBe(true);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Next worker attempt should succeed after expiration
    const nextToken = crypto.randomUUID();
    const acquiredAfterExpire = await acquireLock(redisConnection, lockKey, nextToken, 5000);
    expect(acquiredAfterExpire).toBe(true);

    await releaseLock(redisConnection, lockKey, nextToken);
  });
});
