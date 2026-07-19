export interface WebhookEndpoint {
  id: string;
  project_id: string;
  target_url: string;
  description?: string;
  secret_v1: string;
  secret_v2?: string;
  status: 'active' | 'disabled';
  created_at: Date;
  updated_at: Date;
}

export type WebhookStatus = 'pending' | 'processing' | 'delivered' | 'retrying' | 'failed' | 'dead';

export interface Webhook {
  id: string;
  endpoint_id?: string;
  target_url: string;
  event_type: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  meta?: Record<string, any>;
  status: WebhookStatus;
  max_attempts: number;
  attempt_count: number;
  next_attempt_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export type ExecutionStatus = 'success' | 'failure' | 'timeout' | 'circuit_open';

export interface DeliveryAttempt {
  id: string;
  webhook_id: string;
  attempt_number: number;
  status_code?: number;
  response_body?: string;
  response_time_ms?: number;
  error_message?: string;
  execution_status: ExecutionStatus;
  created_at: Date;
}

export interface RegisterWebhookInput {
  target_url: string;
  event_type: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  meta?: Record<string, any>;
  retry_config?: {
    max_attempts?: number;
    initial_delay_ms?: number;
  };
}
