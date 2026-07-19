import { Request, Response } from 'express';
import { registerWebhookSchema } from '../validators/webhook.validator.js';
import { WebhookService } from '../../services/webhook.service.js';
import { webhooksIngestedTotal, register as prometheusRegister } from '../../services/telemetry.service.js';

export class WebhookController {
  /**
   * POST /api/v1/webhooks
   */
  static async registerWebhook(req: Request, res: Response): Promise<void> {
    try {
      const parseResult = registerWebhookSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid request body payload',
          details: parseResult.error.flatten(),
        });
        return;
      }

      const webhook = await WebhookService.registerWebhook(parseResult.data);
      webhooksIngestedTotal.inc();

      res.status(202).json({
        message: 'Webhook accepted for processing',
        webhook_id: webhook.id,
        status: webhook.status,
        created_at: webhook.createdAt,
      });
    } catch (error: any) {
      console.error('[RegisterWebhook Error]', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message || 'Failed to register webhook',
      });
    }
  }

  /**
   * GET /api/v1/webhooks/:id/status
   */
  static async getWebhookStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const webhook = await WebhookService.getWebhookById(id);

      if (!webhook) {
        res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
        return;
      }

      res.json({
        id: webhook.id,
        target_url: webhook.targetUrl,
        event_type: webhook.eventType,
        status: webhook.status,
        attempt_count: webhook.attemptCount,
        max_attempts: webhook.maxAttempts,
        next_attempt_at: webhook.nextAttemptAt,
        created_at: webhook.createdAt,
        updated_at: webhook.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  /**
   * GET /api/v1/webhooks/:id/attempts
   */
  static async getWebhookAttempts(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const attempts = await WebhookService.getDeliveryAttempts(id);
      res.json({
        webhook_id: id,
        total_attempts: attempts.length,
        attempts,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  /**
   * POST /api/v1/dlq/:id/replay
   */
  static async replayDlqWebhook(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const replayed = await WebhookService.replayDlqWebhook(id);

      if (!replayed) {
        res.status(404).json({ error: 'Not Found', message: 'Webhook not found' });
        return;
      }

      res.json({
        message: 'Webhook replayed successfully and enqueued for delivery',
        webhook_id: id,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  /**
   * GET /metrics
   */
  static async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      res.setHeader('Content-Type', prometheusRegister.contentType);
      const metrics = await prometheusRegister.metrics();
      res.send(metrics);
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }
}
