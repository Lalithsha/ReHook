import { Request, Response, NextFunction } from 'express';
import { config } from '../configs/env.config.js';
import { compareApiKeys } from '../utils/crypto.utils.js';

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers['x-api-key'];
  const projectHeader = req.headers['x-project-id'];
  const projectId = typeof projectHeader === 'string' && projectHeader.trim() ? projectHeader.trim() : 'default';

  if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing x-api-key header',
    });
    return;
  }

  const expectedKey = config.projectApiKeys[projectId] || (projectId === 'default' ? config.apiKey : undefined);
  if (!expectedKey || !compareApiKeys(apiKeyHeader, expectedKey)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid x-api-key provided',
    });
    return;
  }

  (req as Request & { projectId?: string }).projectId = projectId;
  next();
}
