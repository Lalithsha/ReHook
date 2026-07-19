import { Request, Response, NextFunction } from 'express';
import { redisConnection } from '../configs/redis.config.js';

interface RateLimiterOptions {
  windowSizeSeconds?: number;
  maxRequests?: number;
}

/**
 * Sliding Window Redis Rate Limiter
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowSizeSeconds = options.windowSizeSeconds || 60; // 1 minute
  const maxRequests = options.maxRequests || 1000;          // 1000 requests / minute

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const apiKey = (req.headers['x-api-key'] as string) || req.ip || 'anonymous';
      const key = `ratelimit:${apiKey}`;
      const now = Date.now();
      const clearBefore = now - windowSizeSeconds * 1000;

      // Pipeline Redis commands for sliding window
      const multi = redisConnection.multi();
      multi.zremrangebyscore(key, 0, clearBefore);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSizeSeconds);

      const results = await multi.exec();
      const requestCount = (results?.[2]?.[1] as number) || 1;

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - requestCount));

      if (requestCount > maxRequests) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: `API rate limit of ${maxRequests} requests per ${windowSizeSeconds} seconds exceeded.`,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[RateLimiter Error]', error);
      // Fail open if Redis has transient issue
      next();
    }
  };
}
