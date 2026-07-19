import { Worker, Job } from 'bullmq';
import { redisConnection } from '../configs/redis.config.js';
import { config } from '../configs/env.config.js';
import { WebhookJobData } from '../queues/webhook.queue.js';

export const dlqWorker = new Worker<WebhookJobData>(
  config.dlqQueueName,
  async (job: Job<WebhookJobData>) => {
    console.error(`[DLQ Worker] Webhook ${job.data.webhookId} is residing in Dead Letter Queue.`);
  },
  {
    connection: redisConnection,
  }
);
