import { Redis } from 'ioredis';

/**
 * Acquires a distributed lock in Redis using atomic SET with NX (Only if Not Exists) and PX (Milliseconds TTL).
 * Prevents race conditions and duplicate executions across concurrent background worker processes.
 *
 * @param redis ioredis instance
 * @param lockKey Key name for the lock (e.g., `lock:webhook:<webhookId>:<attemptNumber>`)
 * @param token Unique random UUID identifying lock ownership
 * @param ttlMs Time-to-live for lock in milliseconds (default 30,000ms)
 * @returns Promise<boolean> - true if lock was successfully acquired, false if held by another process
 */
export async function acquireLock(
  redis: Redis,
  lockKey: string,
  token: string,
  ttlMs = 30000
): Promise<boolean> {
  const result = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Releases a distributed lock in Redis atomically using a Lua script.
 * Ensures a worker process can ONLY release a lock if its token matches the lock value.
 *
 * @param redis ioredis instance
 * @param lockKey Key name for the lock
 * @param token Unique token used when acquiring the lock
 * @returns Promise<boolean> - true if released by owner, false if token mismatch or lock expired
 */
export async function releaseLock(
  redis: Redis,
  lockKey: string,
  token: string
): Promise<boolean> {
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(luaScript, 1, lockKey, token);
  return result === 1;
}
