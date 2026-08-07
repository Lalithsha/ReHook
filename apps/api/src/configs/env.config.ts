import dotenv from 'dotenv';
dotenv.config();

function parseProjectApiKeys(): Record<string, string> {
  if (!process.env.PROJECT_API_KEYS) return {};
  try {
    return JSON.parse(process.env.PROJECT_API_KEYS) as Record<string, string>;
  } catch {
    throw new Error('PROJECT_API_KEYS must be a JSON object mapping project IDs to API keys');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  apiKey: process.env.X_API_KEY || 'super_secret_rehook_key_123',
  projectApiKeys: parseProjectApiKeys(),
  postgresUrl: process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/rehook',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  retryQueueName: process.env.RETRY_QUEUE_NAME || 'rehook-delivery-queue',
  dlqQueueName: process.env.DLQ_QUEUE_NAME || 'rehook-dlq-queue',
  workerMetricsPort: parseInt(process.env.WORKER_METRICS_PORT || '9464', 10),
  outboxPollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '500', 10),
  outboxBatchSize: parseInt(process.env.OUTBOX_BATCH_SIZE || '100', 10),
  rateLimitRedisTimeoutMs: parseInt(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS || '250', 10),
  allowPrivateWebhookTargets:
    process.env.ALLOW_PRIVATE_WEBHOOK_TARGETS === 'true' || (process.env.NODE_ENV || 'development') !== 'production',
  env: process.env.NODE_ENV || 'development',
};
