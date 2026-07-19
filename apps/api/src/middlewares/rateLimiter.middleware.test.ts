import { describe, expect, it, mock } from 'bun:test';
import { createRateLimiter } from './rateLimiter.middleware.js';
import { Request, Response, NextFunction } from 'express';

describe('Redis Rate Limiter Middleware', () => {
  it('should attach rate limit headers to response and allow request', async () => {
    const mockMulti = {
      zremrangebyscore: mock(() => mockMulti),
      zadd: mock(() => mockMulti),
      zcard: mock(() => mockMulti),
      expire: mock(() => mockMulti),
      exec: mock(async () => [
        [null, 0],
        [null, 1],
        [null, 5], // 5 requests in current window
        [null, 1],
      ]),
    };

    const mockRedis = {
      multi: () => mockMulti,
    };

    const rateLimiter = createRateLimiter({ windowSizeSeconds: 60, maxRequests: 1000 }, mockRedis);

    const headersSet: Record<string, any> = {};
    const req = {
      headers: { 'x-api-key': 'test_key' },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      setHeader: (name: string, value: any) => {
        headersSet[name] = value;
      },
      status: (code: number) => ({
        json: (data: any) => {},
      }),
    } as unknown as Response;

    const next = mock(() => {}) as NextFunction;

    await rateLimiter(req, res, next);
    expect(headersSet['X-RateLimit-Limit']).toBe(1000);
    expect(headersSet['X-RateLimit-Remaining']).toBe(995);
    expect(next).toHaveBeenCalled();
  });

  it('should return 429 Too Many Requests when rate limit quota is exceeded', async () => {
    const mockMulti = {
      zremrangebyscore: mock(() => mockMulti),
      zadd: mock(() => mockMulti),
      zcard: mock(() => mockMulti),
      expire: mock(() => mockMulti),
      exec: mock(async () => [
        [null, 0],
        [null, 1],
        [null, 1005], // 1005 requests in current window (> 1000)
        [null, 1],
      ]),
    };

    const mockRedis = {
      multi: () => mockMulti,
    };

    const rateLimiter = createRateLimiter({ windowSizeSeconds: 60, maxRequests: 1000 }, mockRedis);

    const headersSet: Record<string, any> = {};
    let statusCode = 0;
    let jsonResponse: any = null;

    const req = {
      headers: { 'x-api-key': 'test_key' },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      setHeader: (name: string, value: any) => {
        headersSet[name] = value;
      },
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResponse = data;
          },
        };
      },
    } as unknown as Response;

    const next = mock(() => {}) as NextFunction;

    await rateLimiter(req, res, next);
    expect(statusCode).toBe(429);
    expect(jsonResponse.error).toBe('Too Many Requests');
    expect(headersSet['X-RateLimit-Remaining']).toBe(0);
    expect(next).not.toHaveBeenCalled();
  });
});
