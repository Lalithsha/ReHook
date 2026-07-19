import { describe, expect, it, mock } from 'bun:test';
import { WebhookService } from '../../services/webhook.service.js';
import { WebhookController } from './webhook.controller.js';
import { Request, Response } from 'express';

describe('DLQ REST Controller Endpoints', () => {
  it('should list dead-lettered webhooks with pagination', async () => {
    WebhookService.getDeadLetterWebhooks = mock(async (limit: number, offset: number) => ({
      total: 1,
      limit,
      offset,
      webhooks: [
        {
          id: 'dead-wh-123',
          targetUrl: 'https://httpbin.org/status/500',
          eventType: 'order.failed',
          status: 'dead',
          replayCount: 0,
        },
      ] as any,
    }));

    let jsonResponse: any = null;
    const req = { query: { limit: '10', offset: '0' } } as unknown as Request;
    const res = {
      json: (data: any) => {
        jsonResponse = data;
      },
    } as unknown as Response;

    await WebhookController.getDlqWebhooks(req, res);
    expect(jsonResponse.total).toBe(1);
    expect(jsonResponse.webhooks[0].id).toBe('dead-wh-123');
  });

  it('should return 404 when dead-lettered webhook is not found by ID', async () => {
    WebhookService.getWebhookById = mock(async () => null);

    let statusCode = 0;
    let jsonResponse: any = null;

    const req = { params: { id: 'non-existent-id' } } as unknown as Request;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResponse = data;
          },
        };
      },
    } as unknown as Response;

    await WebhookController.getDlqWebhookById(req, res);
    expect(statusCode).toBe(404);
    expect(jsonResponse.error).toBe('Not Found');
  });

  it('should replay dead-lettered webhook and increment replay count', async () => {
    WebhookService.replayDlqWebhook = mock(async (id: string) => ({
      id,
      status: 'pending',
      replayCount: 1,
    }) as any);

    let jsonResponse: any = null;

    const req = { params: { id: 'dead-wh-123' } } as unknown as Request;
    const res = {
      json: (data: any) => {
        jsonResponse = data;
      },
    } as unknown as Response;

    await WebhookController.replayDlqWebhook(req, res);
    expect(jsonResponse.message).toContain('replayed successfully');
    expect(jsonResponse.replay_count).toBe(1);
  });
});
