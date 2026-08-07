import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const webhooksIngestedTotal = new client.Counter({
  name: 'rehook_webhooks_ingested_total',
  help: 'Total count of webhooks ingested by ReHook API',
  registers: [register],
});

export const webhooksDeliveredTotal = new client.Counter({
  name: 'rehook_webhooks_delivered_total',
  help: 'Total count of webhook delivery attempts by status',
  labelNames: ['status'],
  registers: [register],
});

export const deliveryLatencyHistogram = new client.Histogram({
  name: 'rehook_delivery_duration_seconds',
  help: 'Histogram of webhook delivery duration in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const outboxPublishedTotal = new client.Counter({
  name: 'rehook_outbox_published_total',
  help: 'Total outbox events successfully published to BullMQ',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const outboxPublishFailuresTotal = new client.Counter({
  name: 'rehook_outbox_publish_failures_total',
  help: 'Total outbox publish failures',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const lockContentionTotal = new client.Counter({
  name: 'rehook_worker_lock_contention_total',
  help: 'Total delivery jobs skipped because another worker held the lease',
  registers: [register],
});

export const queueJobsGauge = new client.Gauge({
  name: 'rehook_queue_jobs',
  help: 'Current BullMQ jobs by queue and state',
  labelNames: ['queue', 'state'] as const,
  registers: [register],
});

export const outboxPendingGauge = new client.Gauge({
  name: 'rehook_outbox_pending',
  help: 'Current number of unpublished outbox events',
  registers: [register],
});
