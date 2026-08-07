import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router as webhookRoutes } from './api/routes/webhook.routes.js';
import { prisma } from './db/index.js';
import { redisConnection } from './configs/redis.config.js';

export const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ReHook Webhook Delivery Platform',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', async (req, res) => {
  try {
    const redisReady = Promise.race([
      redisConnection.ping(),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Redis readiness timeout')), 500);
        timer.unref();
      }),
    ]);
    await Promise.all([prisma.$queryRaw`SELECT 1`, redisReady]);
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      message: error instanceof Error ? error.message : 'Dependency check failed',
    });
  }
});

// API Routes
app.use('/api/v1', webhookRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' });
});
