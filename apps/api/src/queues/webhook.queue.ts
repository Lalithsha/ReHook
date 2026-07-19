import { Queue } from 'bullmq';
import { redisConnection } from '../configs/redis.config.js';
import { config } from '../configs/env.config.js';

export interface WebhookJobData {
  webhookId: string;
}

export const deliveryQueue = new Queue<WebhookJobData>(config.retryQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const dlqQueue = new Queue<WebhookJobData>(config.dlqQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});
