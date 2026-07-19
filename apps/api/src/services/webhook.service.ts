import { prisma } from '../db/index.js';
import { deliveryQueue, dlqQueue } from '../queues/webhook.queue.js';
import { RegisterWebhookInput } from '../types/index.js';
import { Webhook, WebhookStatus } from '@prisma/client';

export class WebhookService {
  /**
   * Registers a new webhook and enqueues it for delivery
   */
  static async registerWebhook(input: RegisterWebhookInput): Promise<Webhook> {
    const maxAttempts = input.retry_config?.max_attempts || 5;

    // Check if target endpoint has active signing keys stored
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { targetUrl: input.target_url, status: 'active' },
    });

    const webhook = await prisma.webhook.create({
      data: {
        endpointId: endpoint ? endpoint.id : null,
        targetUrl: input.target_url,
        eventType: input.event_type,
        payload: input.payload,
        headers: input.headers || {},
        meta: input.meta || {},
        status: WebhookStatus.pending,
        maxAttempts,
        attemptCount: 0,
        nextAttemptAt: new Date(),
      },
    });

    // Enqueue into BullMQ with instant execution
    await deliveryQueue.add(
      'deliver-webhook',
      { webhookId: webhook.id },
      { jobId: `webhook-${webhook.id}` }
    );

    return webhook;
  }

  /**
   * Gets current webhook delivery status & attempts log
   */
  static async getWebhookById(id: string): Promise<Webhook | null> {
    return prisma.webhook.findUnique({
      where: { id },
    });
  }

  /**
   * Gets all delivery attempts for a webhook
   */
  static async getDeliveryAttempts(webhookId: string) {
    return prisma.deliveryAttempt.findMany({
      where: { webhookId },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  /**
   * Replays a Dead-Lettered webhook manually
   */
  static async replayDlqWebhook(webhookId: string): Promise<boolean> {
    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      return false;
    }

    // Reset attempts and status
    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        status: WebhookStatus.pending,
        attemptCount: 0,
        nextAttemptAt: new Date(),
      },
    });

    // Remove from DLQ if present and push back into primary delivery queue
    await dlqQueue.remove(`dlq-${webhookId}`).catch(() => {});
    await deliveryQueue.add(
      'deliver-webhook',
      { webhookId },
      { jobId: `webhook-replay-${webhookId}-${Date.now()}` }
    );

    return true;
  }
}
