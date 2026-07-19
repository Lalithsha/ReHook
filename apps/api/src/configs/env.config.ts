import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  apiKey: process.env.X_API_KEY || 'super_secret_rehook_key_123',
  postgresUrl: process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/rehook',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  retryQueueName: process.env.RETRY_QUEUE_NAME || 'rehook-delivery-queue',
  dlqQueueName: process.env.DLQ_QUEUE_NAME || 'rehook-dlq-queue',
  env: process.env.NODE_ENV || 'development',
};
