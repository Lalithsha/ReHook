import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const ingestionLatency = new Trend('ingestion_latency_ms');
const webhookIngestedCount = new Counter('webhooks_ingested_total');

export const options = {
  stages: [
    { duration: '5s', target: 20 },
    { duration: '15s', target: 50 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<150'],
    ingestion_latency_ms: ['p(95)<100'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.X_API_KEY || 'super_secret_rehook_key_123';

export default function () {
  const payload = JSON.stringify({
    target_url: 'http://localhost:4000/webhook?mode=ok',
    event_type: 'loadtest.payment_completed',
    payload: {
      transaction_id: `tx-${Math.random().toString(36).substring(2, 9)}`,
      amount: 499,
      currency: 'USD',
    },
    retry_config: {
      max_attempts: 3,
    },
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/v1/webhooks`, payload, params);
  const duration = Date.now() - startTime;

  ingestionLatency.add(duration);

  const success = check(res, {
    'status is 202 Accepted': (r) => r.status === 202,
    'has webhook_id': (r) => r.json('webhook_id') !== undefined,
  });

  if (success) {
    webhookIngestedCount.add(1);
  }

  sleep(0.05);
}
