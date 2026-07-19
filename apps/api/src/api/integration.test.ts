import { describe, expect, it, spyOn, beforeEach } from 'bun:test';
import request from 'supertest';
import { app } from '../app.js';
import { config } from '../configs/env.config.js';
import { WebhookService } from '../services/webhook.service.js';
import { EndpointService } from '../services/endpoint.service.js';
import { deliveryQueue } from '../queues/webhook.queue.js';
import { redisConnection } from '../configs/redis.config.js';

describe('ReHook End-to-End Integration Test Suite', () => {
  beforeEach(() => {
    // Mock Redis pipeline to prevent socket timeout in offline test runner
    const mockMulti = {
      zremrangebyscore: () => mockMulti,
      zadd: () => mockMulti,
      zcard: () => mockMulti,
      expire: () => mockMulti,
      exec: async () => [[null, 0], [null, 1], [null, 1], [null, 1]],
    };
    spyOn(redisConnection, 'multi').mockImplementation(() => mockMulti as any);
    spyOn(deliveryQueue, 'add').mockImplementation(async () => ({} as any));
  });

  it('GET /api/health should return status healthy without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toContain('ReHook');
  });

  it('POST /api/v1/webhooks should reject missing x-api-key header with 401', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks')
      .send({
        target_url: 'https://httpbin.org/post',
        event_type: 'user.created',
        payload: { user_id: 'usr_100' },
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('POST /api/v1/webhooks should accept valid webhook and return 202 Accepted', async () => {
    spyOn(WebhookService, 'registerWebhook').mockImplementation(async () => ({
      id: 'integration-wh-99',
      targetUrl: 'https://httpbin.org/post',
      eventType: 'order.placed',
      payload: {},
      status: 'pending',
      maxAttempts: 5,
      attemptCount: 0,
      replayCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any);

    const res = await request(app)
      .post('/api/v1/webhooks')
      .set('x-api-key', config.apiKey)
      .send({
        target_url: 'https://httpbin.org/post',
        event_type: 'order.placed',
        payload: { order_id: 'ORD-1234', amount: 499 },
      });

    expect(res.status).toBe(202);
    expect(res.body.webhook_id).toBe('integration-wh-99');
    expect(res.body.status).toBe('pending');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('POST /api/v1/endpoints should register endpoint with signing key', async () => {
    spyOn(EndpointService, 'createEndpoint').mockImplementation(async () => ({
      id: 'ep-001',
      projectId: 'proj_alpha',
      targetUrl: 'https://subscriber-app.com/webhooks',
      secretV1: 'whsec_test123456789',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any);

    const res = await request(app)
      .post('/api/v1/endpoints')
      .set('x-api-key', config.apiKey)
      .send({
        project_id: 'proj_alpha',
        target_url: 'https://subscriber-app.com/webhooks',
      });

    expect(res.status).toBe(201);
    expect(res.body.endpoint.id).toBe('ep-001');
    expect(res.body.endpoint.secret_v1).toBe('whsec_test123456789');
  });

  it('POST /api/v1/endpoints/:id/rotate should rotate secret for key migration', async () => {
    spyOn(EndpointService, 'rotateSecret').mockImplementation(async () => ({
      id: 'ep-001',
      projectId: 'proj_alpha',
      targetUrl: 'https://subscriber-app.com/webhooks',
      secretV1: 'whsec_new_v1_key',
      secretV2: 'whsec_old_v1_key',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any);

    const res = await request(app)
      .post('/api/v1/endpoints/ep-001/rotate')
      .set('x-api-key', config.apiKey)
      .send({ new_secret: 'whsec_new_v1_key' });

    expect(res.status).toBe(200);
    expect(res.body.endpoint.secret_v1).toBe('whsec_new_v1_key');
    expect(res.body.endpoint.secret_v2).toBe('whsec_old_v1_key');
  });

  it('GET /api/v1/dlq should list dead-lettered webhooks', async () => {
    spyOn(WebhookService, 'getDeadLetterWebhooks').mockImplementation(async () => ({
      total: 1,
      limit: 20,
      offset: 0,
      webhooks: [
        { id: 'dead-wh-01', targetUrl: 'https://failing-host.com/hook', status: 'dead' },
      ] as any,
    }));

    const res = await request(app)
      .get('/api/v1/dlq')
      .set('x-api-key', config.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.webhooks[0].id).toBe('dead-wh-01');
  });

  it('GET /api/v1/metrics should expose Prometheus metrics in plain text', async () => {
    const res = await request(app).get('/api/v1/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('rehook_webhooks_ingested_total');
  });
});
