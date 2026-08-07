import { prisma } from '../db/index.js';
import { RegisterWebhookInput } from '../types/index.js';
import { OutboxQueue, Webhook, WebhookStatus } from '@prisma/client';
import { assertSafeTargetUrl } from '../utils/targetUrl.utils.js';

export class InvalidWebhookTransitionError extends Error {}

export class WebhookService {
  /**
   * Registers a new webhook and enqueues it for delivery
   */
  static async registerWebhook(input: RegisterWebhookInput): Promise<Webhook> {
    const maxAttempts = input.retry_config?.max_attempts || 5;
    const initialDelayMs = input.retry_config?.initial_delay_ms || 5000;
    const projectId = input.project_id || 'default';
    await assertSafeTargetUrl(input.target_url);

    // Check if target endpoint has active signing keys stored
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { projectId, targetUrl: input.target_url, status: 'active' },
    });

    return prisma.$transaction(async (tx) => {
      const availableAt = new Date(Date.now() + initialDelayMs);
      const webhook = await tx.webhook.create({
        data: {
          projectId,
          endpointId: endpoint ? endpoint.id : null,
          targetUrl: input.target_url,
          eventType: input.event_type,
          payload: input.payload,
          headers: input.headers || {},
          meta: input.meta || {},
          status: WebhookStatus.pending,
          maxAttempts,
          initialDelayMs,
          attemptCount: 0,
          replayCount: 0,
          nextAttemptAt: availableAt,
        },
      });
      await tx.outboxEvent.create({
        data: { webhookId: webhook.id, queue: OutboxQueue.delivery, availableAt },
      });
      return webhook;
    });
  }

  /**
   * Gets current webhook delivery status & attempts log
   */
  static async getWebhookById(id: string, projectId = 'default'): Promise<Webhook | null> {
    return prisma.webhook.findUnique({
      where: { id, projectId },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Gets all webhooks with optional status filter & pagination (for Dashboard)
   */
  static async getWebhooks(limit = 50, offset = 0, status?: WebhookStatus, projectId = 'default') {
    const where = status ? { status, projectId } : { projectId };
    const [total, webhooks] = await Promise.all([
      prisma.webhook.count({ where }),
      prisma.webhook.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          attempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return { total, limit, offset, webhooks };
  }

  /**
   * Gets dead-lettered webhooks with pagination
   */
  static async getDeadLetterWebhooks(limit = 20, offset = 0, projectId = 'default') {
    return this.getWebhooks(limit, offset, WebhookStatus.dead, projectId);
  }

  /**
   * Gets all delivery attempts for a webhook
   */
  static async getDeliveryAttempts(webhookId: string, projectId = 'default') {
    return prisma.deliveryAttempt.findMany({
      where: { webhookId, webhook: { projectId } },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  /**
   * Replays a Dead-Lettered webhook manually
   */
  static async replayDlqWebhook(webhookId: string, projectId = 'default'): Promise<Webhook | null> {
    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId, projectId } });
    if (!webhook) {
      return null;
    }

    if (webhook.status !== WebhookStatus.dead) {
      throw new InvalidWebhookTransitionError(`Only dead webhooks can be replayed; current status is ${webhook.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const transitioned = await tx.webhook.updateMany({
        where: { id: webhookId, status: WebhookStatus.dead },
        data: {
          status: WebhookStatus.pending,
          attemptCount: 0,
          replayCount: { increment: 1 },
          nextAttemptAt: new Date(),
        },
      });
      if (transitioned.count !== 1) {
        throw new InvalidWebhookTransitionError('Webhook state changed before replay could be scheduled');
      }
      await tx.outboxEvent.create({ data: { webhookId, queue: OutboxQueue.delivery } });
      return tx.webhook.findUniqueOrThrow({ where: { id: webhookId } });
    });
  }
}
