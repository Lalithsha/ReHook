import { Worker, Job } from 'bullmq';
import { redisConnection } from '../configs/redis.config.js';
import { config } from '../configs/env.config.js';
import { prisma } from '../db/index.js';
import { DistributedCircuitBreaker } from '../services/circuitBreaker.service.js';
import { buildSignatureHeader } from '../utils/crypto.utils.js';
import { calculateExponentialJitterBackoff } from '../utils/backoff.utils.js';
import { dlqQueue, deliveryQueue, WebhookJobData } from '../queues/webhook.queue.js';
import { webhooksDeliveredTotal, deliveryLatencyHistogram } from '../services/telemetry.service.js';
import { ExecutionStatus, WebhookStatus } from '@prisma/client';

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

    const targetUrl = webhook.targetUrl;
    const circuitBreaker = new DistributedCircuitBreaker(targetUrl);

    // 1. Check Circuit Breaker State
    const isAllowed = await circuitBreaker.isAllowed();
    if (!isAllowed) {
      console.warn(`[Worker] Circuit Breaker OPEN for target URL: ${targetUrl}. Re-queuing webhook ${webhookId}...`);
      
      const backoffDelay = calculateExponentialJitterBackoff(webhook.attemptCount + 1, 15000);
      
      await prisma.deliveryAttempt.create({
        data: {
          webhookId,
          attemptNumber: webhook.attemptCount + 1,
          executionStatus: ExecutionStatus.circuit_open,
          errorMessage: 'Circuit breaker is OPEN for target host',
        },
      });

      await deliveryQueue.add(
        'deliver-webhook',
        { webhookId },
        { delay: backoffDelay }
      );
      return;
    }

    // 2. Fetch Signing Keys if available
    let headers: Record<string, string> = typeof webhook.headers === 'object' && webhook.headers !== null
      ? (webhook.headers as Record<string, string>)
      : {};
    
    headers['Content-Type'] = 'application/json';
    headers['User-Agent'] = 'ReHook-Engine/1.0';

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

    const currentAttempt = webhook.attemptCount + 1;
    let statusCode: number | undefined;
    let responseText = '';
    let isSuccess = false;
    let errorMessage: string | undefined;
    let executionStatus: ExecutionStatus = ExecutionStatus.failure;

    // Update status to processing
    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        status: WebhookStatus.processing,
        attemptCount: currentAttempt,
      },
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const payloadBody = JSON.stringify(webhook.payload);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: payloadBody,
        signal: controller.signal,
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
        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            status: WebhookStatus.dead,
          },
        });

        await dlqQueue.add('dlq-webhook', { webhookId }, { jobId: `dlq-${webhookId}` });
        console.error(`[Worker] Webhook ${webhookId} exhausted all ${webhook.maxAttempts} attempts. Moved to DLQ.`);
      } else {
        // Schedule next retry with exponential backoff & jitter
        webhooksDeliveredTotal.inc({ status: 'retrying' });
        const backoffMs = calculateExponentialJitterBackoff(currentAttempt);
        const nextAttemptDate = new Date(Date.now() + backoffMs);

        await prisma.webhook.update({
          where: { id: webhookId },
          data: {
            status: WebhookStatus.retrying,
            nextAttemptAt: nextAttemptDate,
          },
        });

        await deliveryQueue.add(
          'deliver-webhook',
          { webhookId },
          { delay: backoffMs }
        );
        console.warn(`[Worker] Webhook ${webhookId} failed attempt ${currentAttempt}/${webhook.maxAttempts}. Retrying in ${backoffMs}ms`);
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);
