import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const cbIngestionLatency = new Trend('cb_test_latency_ms');
const cbIngestedTotal = new Counter('cb_webhooks_ingested');

export const options = {
  stages: [
    { duration: '5s', target: 30 },
    { duration: '10s', target: 30 },
    { duration: '3s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<200'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.X_API_KEY || 'super_secret_rehook_key_123';

export default function () {
  // Target URL simulates a dead endpoint returning 500 Internal Server Error
  const payload = JSON.stringify({
    target_url: 'http://localhost:4000/webhook?mode=fail',
    event_type: 'loadtest.circuit_breaker_test',
    payload: {
      test_type: 'circuit_breaker_resilience',
      batch_id: `batch-${Math.floor(Math.random() * 1000)}`,
    },
    retry_config: {
      max_attempts: 5,
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

  cbIngestionLatency.add(duration);

  const success = check(res, {
    'status is 202 Accepted': (r) => r.status === 202,
  });

  if (success) {
    cbIngestedTotal.add(1);
  }

  sleep(0.05);
}
