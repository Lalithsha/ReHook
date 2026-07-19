import { describe, expect, it, mock } from 'bun:test';
import { authenticateApiKey } from './auth.middleware.js';
import { Request, Response, NextFunction } from 'express';
import { config } from '../configs/env.config.js';

describe('Auth Middleware (x-api-key)', () => {
  it('should call next() when valid x-api-key header is provided', () => {
    const req = {
      headers: {
        'x-api-key': config.apiKey,
      },
    } as unknown as Request;

    const res = {} as Response;
    const next = mock(() => {}) as NextFunction;

    authenticateApiKey(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 401 Unauthorized when x-api-key header is missing', () => {
    const req = {
      headers: {},
    } as unknown as Request;

    let statusCode = 0;
    let jsonResponse: any = null;

    const res = {
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

    authenticateApiKey(req, res, next);
    expect(statusCode).toBe(401);
    expect(jsonResponse.error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 Unauthorized when invalid x-api-key is provided', () => {
    const req = {
      headers: {
        'x-api-key': 'invalid_secret_key',
      },
    } as unknown as Request;

    let statusCode = 0;
    let jsonResponse: any = null;

    const res = {
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

    authenticateApiKey(req, res, next);
    expect(statusCode).toBe(401);
    expect(jsonResponse.error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });
});
