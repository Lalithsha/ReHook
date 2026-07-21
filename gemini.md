# ♊ Gemini & AI Developer Context: ReHook Platform

> **Project Name:** ReHook  
> **Workspace Root:** `/Users/lalithsharma/My-Projects/ReHook`  
> **Primary Runtime:** Bun 1.3.x  
> **Architecture Pattern:** Monorepo with Bun, Express, Prisma ORM, BullMQ, Redis, PostgreSQL  

---

## 📌 Project Overview
**ReHook** is an enterprise-grade, high-throughput Webhook Delivery Engine designed for zero-loss event dispatching, automatic retries with exponential randomized jitter backoff, distributed Redis circuit breaking, zero-downtime dual-secret rotation, and dead-letter queue (DLQ) management.

---

## 📁 Repository Map

```
├── README.md                 # Project user documentation
├── gemini.md                 # AI assistant context & developer handbook
├── package.json              # Monorepo root Bun package manifest
├── docs/                     # Production plans, handbooks, & benchmark reports
│   ├── BENCHMARKS.md         # Published k6 & throughput load test report
│   ├── PHASE_2_POLISH_PLAN.md# Execution roadmap for polish & concurrency
│   ├── PRODUCTION_PLAN.md   # Master production architecture blueprint & trade-offs
│   └── REHOOK_SYSTEM_HANDBOOK.md # Single source of truth system handbook
├── apps/
│   └── api/                  # Core Webhook Delivery Engine microservice
│       ├── prisma/
│       │   └── schema.prisma # PostgreSQL Prisma ORM database schema
│       ├── src/
│       │   ├── api/
│       │   │   ├── controllers/  # WebhookController (Ingestion, status, DLQ replay, metrics)
│       │   │   ├── routes/       # Express route handlers
│       │   │   └── validators/   # Zod input validation schemas
│       │   ├── configs/          # env.config.ts and redis.config.ts
│       │   ├── db/               # Prisma Client singleton (index.ts)
│       │   ├── middlewares/      # Auth (x-api-key) and Redis sliding-window rate limiter
│       │   ├── queues/           # BullMQ queue instantiations
│       │   ├── services/         # WebhookService, DistributedCircuitBreaker, Telemetry
│       │   ├── types/            # TypeScript interfaces & domain types
│       │   ├── utils/            # Crypto HMAC signer & exponential jitter backoff
│       │   └── workers/          # BullMQ background delivery and DLQ workers
│       └── tsconfig.json
```

---

## 🛠️ Technology Stack & Core Tools

- **Runtime:** [Bun](https://bun.sh) (`bun --watch`, `bun test`)
- **API Framework:** Express 4.x with Zod validation
- **ORM / Database:** Prisma ORM 6.x with PostgreSQL
- **Queue / Background Workers:** BullMQ 5.x backed by Redis
- **Circuit Breaker:** Custom distributed 3-state machine (`CLOSED`, `OPEN`, `HALF_OPEN`) stored atomically in Redis
- **Security:** HMAC-SHA256 signature generator (`X-ReHook-Signature`) supporting dual-secret key rotation (`v1`, `v2`)
- **Telemetry:** Prometheus metrics collector (`prom-client`) at `/api/v1/metrics`

---

## ⚙️ Key Environment Variables (`apps/api/.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | HTTP API server port |
| `X_API_KEY` | `super_secret_rehook_key_123` | Security key required in `x-api-key` header |
| `POSTGRES_URL` | `postgres://postgres:postgres@localhost:5432/rehook` | PostgreSQL connection URI |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URI |
| `RETRY_QUEUE_NAME` | `rehook-delivery-queue` | BullMQ delivery queue name |
| `DLQ_QUEUE_NAME` | `rehook-dlq-queue` | BullMQ Dead Letter Queue name |

---

## 🏃 Useful CLI Commands

```bash
# 1. Install dependencies
bun install

# 2. Run unit test suite
bun test:api

# 3. Generate Prisma Client
bun db:generate

# 4. Push Prisma Schema to PostgreSQL
bun db:push

# 5. Start API Server & Worker Engine
bun dev:api
```

---

## 🧠 Architectural Rules for AI Assistants

1. **Always use Bun:** Use `bun` commands (`bun test`, `bun add`, `bun run`) instead of npm/yarn/pnpm.
2. **Type Safety:** Maintain strict TypeScript compliance using exported Prisma types (`@prisma/client`) and Zod validation.
3. **Resilience First:** Ensure all worker calls utilize the `DistributedCircuitBreaker` and `calculateExponentialJitterBackoff`.
4. **Security:** All mutations or secret rotations must maintain constant-time API key verification (`compareApiKeys`) and preserve dual-signature headers (`v1` and `v2`).
