import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';
import { EndpointController } from '../controllers/endpoint.controller.js';
import { authenticateApiKey } from '../../middlewares/auth.middleware.js';
import { createRateLimiter } from '../../middlewares/rateLimiter.middleware.js';

export const router: Router = Router();

const rateLimiter = createRateLimiter({ windowSizeSeconds: 60, maxRequests: 1000 });

// Public endpoints
router.get('/metrics', WebhookController.getMetrics);

// Authenticated & Rate limited Webhook endpoints
router.post('/webhooks', authenticateApiKey, rateLimiter, WebhookController.registerWebhook);
router.get('/webhooks', authenticateApiKey, WebhookController.getWebhooks);
router.get('/webhooks/:id/status', authenticateApiKey, WebhookController.getWebhookStatus);
router.get('/webhooks/:id/attempts', authenticateApiKey, WebhookController.getWebhookAttempts);

// DLQ Operability endpoints
router.get('/dlq', authenticateApiKey, WebhookController.getDlqWebhooks);
router.get('/dlq/:id', authenticateApiKey, WebhookController.getDlqWebhookById);
router.post('/dlq/:id/replay', authenticateApiKey, WebhookController.replayDlqWebhook);

// Authenticated Endpoint Secret Management & Key Rotation
router.post('/endpoints', authenticateApiKey, EndpointController.createEndpoint);
router.post('/endpoints/:id/rotate', authenticateApiKey, EndpointController.rotateSecret);
router.get('/endpoints', authenticateApiKey, EndpointController.getEndpoints);
