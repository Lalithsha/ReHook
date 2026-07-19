import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router as webhookRoutes } from './api/routes/webhook.routes.js';

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

// API Routes
app.use('/api/v1', webhookRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found' });
});
