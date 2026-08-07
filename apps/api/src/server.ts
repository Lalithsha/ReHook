import { app } from './app.js';
import { config } from './configs/env.config.js';
import { prisma } from './db/index.js';
import { redisConnection } from './configs/redis.config.js';

const server = app.listen(config.port, () => {
  console.log(`
  🚀 ReHook Webhook Delivery Engine is running!
  -----------------------------------------------
  📡 API Server:  http://localhost:${config.port}
  📊 Metrics:     http://localhost:${config.port}/api/v1/metrics
  🏥 Healthcheck: http://localhost:${config.port}/api/health
  -----------------------------------------------
  `);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[API] ${signal} received; draining HTTP connections...`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redisConnection.quit()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
