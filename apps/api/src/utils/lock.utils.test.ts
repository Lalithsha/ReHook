import { describe, expect, it, beforeEach } from 'bun:test';
import { acquireLock, releaseLock } from './lock.utils.js';
import { redisConnection } from '../configs/redis.config.js';
import crypto from 'crypto';

describe('Distributed Redlock Utilities', () => {
  const testLockKey = 'test:lock:concurrency:123';

  beforeEach(async () => {
    await redisConnection.del(testLockKey);
  });

  it('should successfully acquire an available lock', async () => {
    const token = crypto.randomUUID();
    const acquired = await acquireLock(redisConnection, testLockKey, token, 10000);

    expect(acquired).toBe(true);

    const storedToken = await redisConnection.get(testLockKey);
    expect(storedToken).toBe(token);
  });

  it('should reject acquisition if lock is already held by another process', async () => {
    const token1 = crypto.randomUUID();
    const token2 = crypto.randomUUID();

    const acquired1 = await acquireLock(redisConnection, testLockKey, token1, 10000);
    expect(acquired1).toBe(true);

    const acquired2 = await acquireLock(redisConnection, testLockKey, token2, 10000);
    expect(acquired2).toBe(false);
  });

  it('should release lock atomically only when token matches owner token', async () => {
    const ownerToken = crypto.randomUUID();
    const wrongToken = crypto.randomUUID();

    await acquireLock(redisConnection, testLockKey, ownerToken, 10000);

    // Release attempt with wrong token should fail
    const releasedWrong = await releaseLock(redisConnection, testLockKey, wrongToken);
    expect(releasedWrong).toBe(false);
    expect(await redisConnection.get(testLockKey)).toBe(ownerToken);

    // Release attempt with correct owner token should succeed
    const releasedOwner = await releaseLock(redisConnection, testLockKey, ownerToken);
    expect(releasedOwner).toBe(true);
    expect(await redisConnection.get(testLockKey)).toBeNull();
  });
});
