import { Redis } from 'ioredis';
import { config } from './env.config.js';

export const redisConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected to Redis instance');
});
