import { OutboxQueue, OutboxStatus } from '@prisma/client';
import { config } from '../configs/env.config.js';
import { prisma } from '../db/index.js';
import { deliveryQueue, dlqQueue } from '../queues/webhook.queue.js';
import { outboxPendingGauge, outboxPublishFailuresTotal, outboxPublishedTotal, queueJobsGauge } from './telemetry.service.js';

let pollTimer: ReturnType<typeof setInterval> | undefined;
let publishing = false;

async function refreshOperationalGauges(): Promise<void> {
  const [delivery, dlq, pending] = await Promise.all([
    deliveryQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    dlqQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    prisma.outboxEvent.count({ where: { status: OutboxStatus.pending } }),
  ]);
  for (const [state, count] of Object.entries(delivery)) queueJobsGauge.set({ queue: 'delivery', state }, count);
  for (const [state, count] of Object.entries(dlq)) queueJobsGauge.set({ queue: 'dlq', state }, count);
  outboxPendingGauge.set(pending);
}

export async function publishOutboxBatch(): Promise<number> {
  if (publishing) return 0;
  publishing = true;
  try {
    const events = await prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.pending, availableAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: config.outboxBatchSize,
    });

    let published = 0;
    for (const event of events) {
      try {
        const queue = event.queue === OutboxQueue.dlq ? dlqQueue : deliveryQueue;
        const jobName = event.queue === OutboxQueue.dlq ? 'dlq-webhook' : 'deliver-webhook';
        await queue.add(jobName, { webhookId: event.webhookId }, { jobId: `outbox-${event.id}` });
        await prisma.outboxEvent.updateMany({
          where: { id: event.id, status: OutboxStatus.pending },
          data: { status: OutboxStatus.published, publishedAt: new Date(), attempts: { increment: 1 }, lastError: null },
        });
        outboxPublishedTotal.inc({ queue: event.queue });
        published += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { attempts: { increment: 1 }, lastError: message.slice(0, 2000) },
        }).catch(() => {});
        outboxPublishFailuresTotal.inc({ queue: event.queue });
      }
    }
    await refreshOperationalGauges().catch(() => {});
    return published;
  } finally {
    publishing = false;
  }
}

export function startOutboxRelay(): void {
  void publishOutboxBatch();
  pollTimer = setInterval(() => void publishOutboxBatch(), config.outboxPollIntervalMs);
  pollTimer.unref();
}

export function stopOutboxRelay(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
}
