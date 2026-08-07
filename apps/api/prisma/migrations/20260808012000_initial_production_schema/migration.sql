CREATE TYPE "EndpointStatus" AS ENUM ('active', 'disabled');
CREATE TYPE "WebhookStatus" AS ENUM ('pending', 'processing', 'delivered', 'retrying', 'failed', 'dead');
CREATE TYPE "ExecutionStatus" AS ENUM ('success', 'failure', 'timeout', 'circuit_open');
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'published');
CREATE TYPE "OutboxQueue" AS ENUM ('delivery', 'dlq');

CREATE TABLE "webhook_endpoints" (
  "id" TEXT NOT NULL,
  "project_id" VARCHAR(64) NOT NULL,
  "target_url" TEXT NOT NULL,
  "description" TEXT,
  "secret_v1" TEXT NOT NULL,
  "secret_v2" TEXT,
  "status" "EndpointStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhooks" (
  "id" TEXT NOT NULL,
  "project_id" VARCHAR(64) NOT NULL DEFAULT 'default',
  "endpoint_id" TEXT,
  "target_url" TEXT NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "headers" JSONB DEFAULT '{}',
  "meta" JSONB DEFAULT '{}',
  "status" "WebhookStatus" NOT NULL DEFAULT 'pending',
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "initial_delay_ms" INTEGER NOT NULL DEFAULT 5000,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "replay_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_attempts" (
  "id" TEXT NOT NULL,
  "delivery_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "webhook_id" TEXT NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status_code" INTEGER,
  "response_body" TEXT,
  "response_time_ms" INTEGER,
  "error_message" TEXT,
  "execution_status" "ExecutionStatus" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "webhook_id" TEXT NOT NULL,
  "queue" "OutboxQueue" NOT NULL DEFAULT 'delivery',
  "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
  "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_endpoints_project" ON "webhook_endpoints"("project_id");
CREATE INDEX "idx_webhooks_status_next_attempt" ON "webhooks"("status", "next_attempt_at");
CREATE INDEX "idx_webhooks_endpoint" ON "webhooks"("endpoint_id");
CREATE INDEX "idx_webhooks_project" ON "webhooks"("project_id");
CREATE INDEX "idx_delivery_attempts_webhook" ON "delivery_attempts"("webhook_id");
CREATE INDEX "idx_delivery_attempt_delivery_id" ON "delivery_attempts"("delivery_id");
CREATE INDEX "idx_outbox_status_available" ON "outbox_events"("status", "available_at");

ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
