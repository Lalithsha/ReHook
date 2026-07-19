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
