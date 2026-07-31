const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'super_secret_rehook_key_123';

export interface WebhookAttempt {
  id: string;
  webhookId: string;
  attemptNumber: number;
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  executionTimeMs: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  createdAt: string;
}

export interface WebhookJob {
  id: string;
  targetUrl: string;
  target_url?: string;
  eventType: string;
  event_type?: string;
  payload: any;
  status: 'pending' | 'processing' | 'delivered' | 'retrying' | 'failed' | 'dead';
  attemptCount?: number;
  attempt_count?: number;
  maxAttempts?: number;
  max_attempts?: number;
  replayCount?: number;
  replay_count?: number;
  nextAttemptAt?: string | null;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  attempts?: WebhookAttempt[];
}

export interface WebhookEndpoint {
  id: string;
  projectId: string;
  project_id?: string;
  targetUrl: string;
  target_url?: string;
  secretV1: string;
  secret_v1?: string;
  secretV2?: string | null;
  secret_v2?: string | null;
  status: string;
  createdAt: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

export async function fetchWebhooks(limit = 50, offset = 0, status?: string): Promise<{ webhooks: WebhookJob[]; total: number }> {
  let url = `${API_BASE_URL}/webhooks?limit=${limit}&offset=${offset}`;
  if (status && status !== 'ALL') {
    url += `&status=${status.toLowerCase()}`;
  }
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return res.json();
}

export async function fetchWebhookAttempts(webhookId: string): Promise<WebhookAttempt[]> {
  const res = await fetch(`${API_BASE_URL}/webhooks/${webhookId}/attempts`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch attempts for ${webhookId}`);
  const data = await res.json();
  return data.attempts || [];
}

export async function dispatchWebhook(data: {
  target_url: string;
  event_type: string;
  payload?: any;
  retry_config?: { max_attempts?: number; initial_delay_ms?: number };
}) {
  const res = await fetch(`${API_BASE_URL}/webhooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to dispatch webhook');
  return json;
}

export async function fetchDlqWebhooks(limit = 50, offset = 0): Promise<{ webhooks: WebhookJob[]; total: number }> {
  const res = await fetch(`${API_BASE_URL}/dlq?limit=${limit}&offset=${offset}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch DLQ items (${res.status})`);
  return res.json();
}

export async function replayDlqWebhook(webhookId: string) {
  const res = await fetch(`${API_BASE_URL}/dlq/${webhookId}/replay`, {
    method: 'POST',
    headers,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to replay webhook');
  return json;
}

export async function fetchEndpoints(projectId = 'default'): Promise<WebhookEndpoint[]> {
  const res = await fetch(`${API_BASE_URL}/endpoints?project_id=${projectId}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch endpoints (${res.status})`);
  const data = await res.json();
  return data.endpoints || [];
}

export async function createEndpoint(target_url: string, project_id = 'default') {
  const res = await fetch(`${API_BASE_URL}/endpoints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ target_url, project_id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to create endpoint');
  return json.endpoint;
}

export async function rotateEndpointSecret(endpointId: string, new_secret?: string) {
  const res = await fetch(`${API_BASE_URL}/endpoints/${endpointId}/rotate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(new_secret ? { new_secret } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to rotate secret');
  return json.endpoint;
}
