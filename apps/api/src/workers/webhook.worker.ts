import { Worker, Job } from 'bullmq';
import { redisConnection } from '../configs/redis.config.js';
import { config } from '../configs/env.config.js';
import { prisma } from '../db/index.js';
import { DistributedCircuitBreaker } from '../services/circuitBreaker.service.js';
import { buildSignatureHeader } from '../utils/crypto.utils.js';
import { calculateExponentialJitterBackoff } from '../utils/backoff.utils.js';
import { acquireLock, extendLock, releaseLock } from '../utils/lock.utils.js';
import { WebhookJobData } from '../queues/webhook.queue.js';
import { webhooksDeliveredTotal, deliveryLatencyHistogram, lockContentionTotal } from '../services/telemetry.service.js';
import { ExecutionStatus, OutboxQueue, WebhookStatus } from '@prisma/client';
import crypto from 'crypto';
import { assertSafeTargetUrl } from '../utils/targetUrl.utils.js';

export const deliveryWorker = new Worker<WebhookJobData>(
  config.retryQueueName,
  async (job: Job<WebhookJobData>) => {
    const { webhookId } = job.data;
    const startTime = Date.now();

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) {
      console.warn(`[Worker] Webhook ID ${webhookId} not found in database.`);
      return;
    }

    if (webhook.status === WebhookStatus.delivered || webhook.status === WebhookStatus.dead) {
      return;
    }

    const currentAttempt = webhook.attemptCount + 1;
    const lockKey = `lock:webhook:${webhookId}:${currentAttempt}`;
    const lockToken = crypto.randomUUID();
    const lockTtlMs = 30000;
    let leaseTimer: ReturnType<typeof setInterval> | undefined;

    // Acquire atomic execution lock to prevent duplicate sends under worker failover
    const acquired = await acquireLock(redisConnection, lockKey, lockToken, lockTtlMs);
    if (!acquired) {
      lockContentionTotal.inc();
      console.warn(`[Worker] Concurrency lock active for webhook ${webhookId} attempt ${currentAttempt}. Skipping duplicate execution.`);
      return;
    }

    try {
      leaseTimer = setInterval(() => {
        void extendLock(redisConnection, lockKey, lockToken, lockTtlMs).then((extended) => {
          if (!extended) console.error(`[Worker] Lost delivery lease for webhook ${webhookId} attempt ${currentAttempt}`);
        }).catch((error) => console.error('[Worker] Failed to renew delivery lease', error));
      }, Math.floor(lockTtlMs / 3));
      leaseTimer.unref();
      const claimed = await prisma.webhook.updateMany({
        where: {
          id: webhookId,
          attemptCount: webhook.attemptCount,
          status: { in: [WebhookStatus.pending, WebhookStatus.retrying] },
        },
        data: { status: WebhookStatus.processing, attemptCount: currentAttempt },
      });
      if (claimed.count !== 1) return;

      const targetUrl = webhook.targetUrl;
      const circuitBreaker = new DistributedCircuitBreaker(targetUrl);

    // 1. Check Circuit Breaker State
    const isAllowed = await circuitBreaker.isAllowed();
    if (!isAllowed) {
      console.warn(`[Worker] Circuit Breaker OPEN for target URL: ${targetUrl}. Re-queuing webhook ${webhookId}...`);
      
      const backoffDelay = calculateExponentialJitterBackoff(webhook.attemptCount + 1, 15000);
      const exhausted = currentAttempt >= webhook.maxAttempts;
      const nextAttemptAt = new Date(Date.now() + backoffDelay);
      await prisma.$transaction([
        prisma.deliveryAttempt.create({
          data: {
            webhookId,
            deliveryId: crypto.randomUUID(),
            attemptNumber: currentAttempt,
            executionStatus: ExecutionStatus.circuit_open,
            errorMessage: 'Circuit breaker is OPEN for target host',
          },
        }),
        prisma.webhook.update({
          where: { id: webhookId },
          data: { status: exhausted ? WebhookStatus.dead : WebhookStatus.retrying, nextAttemptAt: exhausted ? null : nextAttemptAt },
        }),
        prisma.outboxEvent.create({
          data: {
            webhookId,
            queue: exhausted ? OutboxQueue.dlq : OutboxQueue.delivery,
            availableAt: exhausted ? new Date() : nextAttemptAt,
          },
        }),
      ]);
      return;
    }

    // 2. Fetch Signing Keys if available
    let headers: Record<string, string> = typeof webhook.headers === 'object' && webhook.headers !== null
      ? (webhook.headers as Record<string, string>)
      : {};
    
    headers['Content-Type'] = 'application/json';
    headers['User-Agent'] = 'ReHook-Engine/1.0';
    headers['X-ReHook-Event-ID'] = webhook.id;
    const deliveryId = crypto.randomUUID();
    headers['X-ReHook-Delivery-ID'] = deliveryId;

    if (webhook.endpointId) {
      const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: webhook.endpointId } });
      if (endpoint && endpoint.secretV1) {
        const payloadObj = typeof webhook.payload === 'object' && webhook.payload !== null
          ? (webhook.payload as Record<string, any>)
          : {};
          
        const { signatureHeader, timestamp } = buildSignatureHeader(
          payloadObj,
          endpoint.secretV1,
          endpoint.secretV2 || undefined
        );
        headers['X-ReHook-Signature'] = signatureHeader;
        headers['X-ReHook-Timestamp'] = timestamp.toString();
      }
    }

    let statusCode: number | undefined;
    let responseText = '';
    let isSuccess = false;
    let errorMessage: string | undefined;
    let executionStatus: ExecutionStatus = ExecutionStatus.failure;

    try {
      await assertSafeTargetUrl(targetUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const payloadBody = JSON.stringify(webhook.payload);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: payloadBody,
        signal: controller.signal,
        redirect: 'error',
      });

      clearTimeout(timeoutId);
      statusCode = response.status;
      responseText = (await response.text()).slice(0, 1000); // Truncate body

      if (response.ok) {
        isSuccess = true;
        executionStatus = ExecutionStatus.success;
      } else {
        errorMessage = `HTTP error ${response.status}: ${responseText}`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        executionStatus = ExecutionStatus.timeout;
        errorMessage = 'Delivery timed out after 10000ms';
      } else {
        errorMessage = err.message || 'Network fetch failure';
      }
    }

    const durationMs = Date.now() - startTime;
    deliveryLatencyHistogram.observe(durationMs / 1000);

    // Record Delivery Attempt Log
    await prisma.deliveryAttempt.create({
      data: {
        webhookId,
        deliveryId,
        attemptNumber: currentAttempt,
        statusCode,
        responseBody: responseText,
        responseTimeMs: durationMs,
        errorMessage,
        executionStatus,
      },
    });

    if (isSuccess) {
      // Record Circuit Breaker success
      await circuitBreaker.recordSuccess();
      webhooksDeliveredTotal.inc({ status: 'success' });

      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          status: WebhookStatus.delivered,
        },
      });
      console.log(`[Worker] Webhook ${webhookId} delivered successfully to ${targetUrl} (Attempt ${currentAttempt})`);
    } else {
      // Record Circuit Breaker failure
      await circuitBreaker.recordFailure();

      if (currentAttempt >= webhook.maxAttempts) {
        // Max attempts reached -> Move to Dead Letter Queue (DLQ)
        webhooksDeliveredTotal.inc({ status: 'dead' });
        await prisma.$transaction([
          prisma.webhook.update({ where: { id: webhookId }, data: { status: WebhookStatus.dead, nextAttemptAt: null } }),
          prisma.outboxEvent.create({ data: { webhookId, queue: OutboxQueue.dlq } }),
        ]);
        console.error(`[Worker] Webhook ${webhookId} exhausted all ${webhook.maxAttempts} attempts. Moved to DLQ.`);
      } else {
        // Schedule next retry with exponential backoff & jitter
        webhooksDeliveredTotal.inc({ status: 'retrying' });
        const backoffMs = calculateExponentialJitterBackoff(currentAttempt);
        const nextAttemptDate = new Date(Date.now() + backoffMs);

        await prisma.$transaction([
          prisma.webhook.update({
            where: { id: webhookId },
            data: { status: WebhookStatus.retrying, nextAttemptAt: nextAttemptDate },
          }),
          prisma.outboxEvent.create({
            data: { webhookId, queue: OutboxQueue.delivery, availableAt: nextAttemptDate },
          }),
        ]);
        console.warn(`[Worker] Webhook ${webhookId} failed attempt ${currentAttempt}/${webhook.maxAttempts}. Retrying in ${backoffMs}ms`);
      }
    }
    } finally {
      if (leaseTimer) clearInterval(leaseTimer);
      await releaseLock(redisConnection, lockKey, lockToken).catch(() => {});
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);
