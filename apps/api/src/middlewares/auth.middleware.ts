import { Request, Response, NextFunction } from 'express';
import { config } from '../configs/env.config.js';
import { compareApiKeys } from '../utils/crypto.utils.js';

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers['x-api-key'];

  if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing x-api-key header',
    });
    return;
  }

  if (!compareApiKeys(apiKeyHeader, config.apiKey)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid x-api-key provided',
    });
    return;
  }

  next();
}
