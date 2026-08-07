import http from 'node:http';
import { config } from '../configs/env.config.js';
import { redisConnection } from '../configs/redis.config.js';
import { prisma } from '../db/index.js';
import { deliveryQueue, dlqQueue } from '../queues/webhook.queue.js';
import { register } from '../services/telemetry.service.js';
import { startOutboxRelay, stopOutboxRelay } from '../services/outbox.service.js';
import { deliveryWorker } from './webhook.worker.js';
import { dlqWorker } from './dlq.worker.js';

startOutboxRelay();

const metricsServer = http.createServer(async (req, res) => {
  if (req.url !== '/metrics') {
    res.writeHead(404).end('Not Found');
    return;
  }
  res.writeHead(200, { 'Content-Type': register.contentType });
  res.end(await register.metrics());
});
metricsServer.listen(config.workerMetricsPort, () => {
  console.log(`🚀 [ReHook Worker Engine] Delivery, DLQ, outbox relay, and metrics :${config.workerMetricsPort}/metrics started`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Worker] ${signal} received; draining active jobs...`);
  stopOutboxRelay();
  metricsServer.close();
  await Promise.allSettled([deliveryWorker.close(), dlqWorker.close()]);
  await Promise.allSettled([deliveryQueue.close(), dlqQueue.close()]);
  await Promise.allSettled([prisma.$disconnect(), redisConnection.quit()]);
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
