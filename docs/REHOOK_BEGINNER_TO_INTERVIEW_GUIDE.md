# ReHook — Beginner-to-Interview, Code-Grounded Learning Guide

> **Purpose:** Teach the concepts, runtime flow, implementation, trade-offs, limitations, testing, and interview explanation of this repository from first principles.
>
> **Code snapshot reviewed:** Current working tree on 2026-08-02. The existing uncommitted addition of `X-ReHook-Delivery-ID` in `apps/api/src/workers/webhook.worker.ts` is included and was not modified.
>
> **How to use this guide:** Read Chapters 1–5 for the mental model, Chapters 6–15 with the code open, then use Chapters 16–20 for practice and interviews.

---

## Table of contents

1. [The problem ReHook solves](#1-the-problem-rehook-solves)
2. [Vocabulary from zero](#2-vocabulary-from-zero)
3. [Architecture and technology choices](#3-architecture-and-technology-choices)
4. [One webhook, end to end](#4-one-webhook-end-to-end)
5. [Delivery semantics: what is actually guaranteed](#5-delivery-semantics-what-is-actually-guaranteed)
6. [Boot, configuration, middleware, and routes](#6-boot-configuration-middleware-and-routes)
7. [Database and Prisma, line by line](#7-database-and-prisma-line-by-line)
8. [Fast-path ingestion and BullMQ](#8-fast-path-ingestion-and-bullmq)
9. [The delivery worker, line by line](#9-the-delivery-worker-line-by-line)
10. [Retries, exponential backoff, and full jitter](#10-retries-exponential-backoff-and-full-jitter)
11. [Distributed circuit breaker](#11-distributed-circuit-breaker)
12. [Distributed locking and duplicate prevention](#12-distributed-locking-and-duplicate-prevention)
13. [Authentication, rate limiting, HMAC, and rotation](#13-authentication-rate-limiting-hmac-and-rotation)
14. [DLQ, replay, observability, and dashboard](#14-dlq-replay-observability-and-dashboard)
15. [Testing, benchmarks, and local practice](#15-testing-benchmarks-and-local-practice)
16. [Complexity and scaling analysis](#16-complexity-and-scaling-analysis)
17. [Current gaps and production improvements](#17-current-gaps-and-production-improvements)
18. [Interview-ready explanation](#18-interview-ready-explanation)
19. [Interview questions and answers](#19-interview-questions-and-answers)
20. [Learning and practice plan](#20-learning-and-practice-plan)

---

# 1. The problem ReHook solves

## 1.1 What is a webhook?

A webhook is an HTTP request sent automatically when an event happens.

Example: a payment service finishes a payment. It needs to tell a merchant application:

```http
POST https://merchant.example/webhooks
Content-Type: application/json

{
  "event": "payment.completed",
  "payment_id": "pay_123",
  "amount": 499
}
```

This is sometimes called a **reverse API**:

- In a normal API, the consumer asks, “Has payment `pay_123` completed?”
- With a webhook, the payment system pushes the answer when the event occurs.

## 1.2 Why not send the HTTP request directly?

Suppose the business application does this synchronously:

```text
save order -> call merchant webhook -> wait 10 seconds -> finish request
```

If the merchant is slow or offline, the business operation becomes slow or fails. One unreliable external system can therefore damage the upstream system.

ReHook inserts a durable-ish asynchronous boundary:

```text
client -> ReHook API -> PostgreSQL + Redis queue -> 202 Accepted
                                       |
                                       v
                                  worker -> receiver
```

The API accepts and records work quickly. A worker performs the unreliable network call separately. This is **decoupling**: ingestion and delivery can proceed at different speeds and fail independently.

## 1.3 Concrete scenario used throughout this guide

An e-commerce service sends `order.shipped` to a warehouse partner.

1. The e-commerce service calls ReHook.
2. ReHook validates and records the event.
3. ReHook enqueues a small job containing only the database ID.
4. A worker loads the full event from PostgreSQL.
5. It signs the payload and calls the warehouse.
6. A `200` response marks it delivered.
7. A timeout or non-2xx response schedules a randomized retry.
8. After all attempts fail, it becomes `dead` and can be replayed by an operator.

---

# 2. Vocabulary from zero

| Term | Plain meaning | ReHook example |
|---|---|---|
| API | A contract for software to communicate | `POST /api/v1/webhooks` |
| HTTP method | The requested operation | `POST` creates/dispatches; `GET` reads |
| HTTP status | Numeric result | `202` accepted, `400` invalid, `401` unauthenticated, `429` limited |
| Header | Request metadata | `x-api-key`, `X-ReHook-Signature` |
| Payload/body | Main request data | The event JSON |
| Middleware | Code run before the controller | auth and rate limiter |
| Controller | HTTP adapter that parses input and formats output | `WebhookController` |
| Service | Business/data operation behind a controller | `WebhookService.registerWebhook` |
| ORM | Maps code objects to database rows | Prisma |
| Queue | Buffer of work waiting for consumers | BullMQ delivery queue |
| Producer | Adds work to a queue | `WebhookService` |
| Consumer/worker | Removes and processes work | `deliveryWorker` |
| Broker | Infrastructure holding queue state | Redis |
| Retry | Another attempt after failure | delayed BullMQ job |
| Backoff | Increasing wait between attempts | roughly 5s, 10s, 20s caps |
| Jitter | Randomness added to the wait | random from zero to the cap |
| DLQ | Isolation area for exhausted work | logical `dead` rows plus BullMQ DLQ |
| HMAC | Keyed integrity/authenticity digest | signs timestamp + JSON payload |
| Secret rotation | Replacing a key without abrupt breakage | new `v1`, old `v2` |
| Circuit breaker | Stops calls to a repeatedly failing dependency | `CLOSED/OPEN/HALF_OPEN` |
| Distributed lock | Shared mutex visible to multiple processes | Redis `SET NX PX` |
| Idempotency | Repeating an operation has no extra effect | receiver should deduplicate delivery IDs/event IDs |
| Telemetry | Measurements about a running system | Prometheus counters/histogram |
| p95 latency | 95% of observations are at or below this value | benchmark latency percentile |
| Horizontal scaling | Add more processes/machines | multiple BullMQ workers |
| TTL | Automatic expiration time | lock and rate-limit keys |

## 2.1 Synchronous versus asynchronous

**Synchronous:** caller waits for the final work to finish.

```text
caller -------- request --------> receiver
caller <------- final result ----- receiver
```

**Asynchronous:** caller receives acceptance; final work happens later.

```text
caller -> API -> queue
caller <- 202
                    queue -> worker -> receiver
```

HTTP `202 Accepted` specifically means “the request was accepted for processing,” not “delivery succeeded.” The caller later checks status.

## 2.2 Durability versus availability

- **Durability** asks whether accepted data survives crashes.
- **Availability** asks whether the system can respond now.
- PostgreSQL stores business state and audit history durably.
- Redis stores queue, limiter, lock, and circuit state. Docker gives Redis a volume, but production durability also depends on Redis persistence and replication settings not defined here.

---

# 3. Architecture and technology choices

## 3.1 Repository layout

```text
ReHook/
├── apps/api/              Express API, services, workers, Prisma, tests
├── apps/web/              Next.js operator dashboard
├── apps/docs/             Placeholder/documentation Next.js app
├── packages/              Shared monorepo configs and small UI package
├── load-tests/            k6 ingestion and circuit-breaker workloads
├── docs/                  Architecture, benchmarks, plans, this guide
├── docker-compose.yml     PostgreSQL, Redis, API, worker, dashboard
├── package.json           Bun workspaces + Turbo scripts
└── turbo.json             Monorepo task orchestration
```

## 3.2 Component diagram

```mermaid
flowchart LR
    U[Upstream client] -->|POST event| API[Express API]
    API -->|read/write| PG[(PostgreSQL)]
    API -->|enqueue ID| R[(Redis)]
    R -->|BullMQ job| W[Delivery worker]
    W -->|load/update| PG
    W -->|lock + circuit state| R
    W -->|signed POST| T[Target receiver]
    W -->|failed permanently| D[DLQ]
    UI[Next.js dashboard] -->|REST calls| API
    P[Prometheus scraper] -->|GET metrics| API
```

## 3.3 Why each technology is here

| Technology | Job | Reasonable benefit | Cost/trade-off |
|---|---|---|---|
| Bun | runtime, package manager, tests | fast TypeScript workflow | smaller ecosystem than Node |
| Express | HTTP server | simple, familiar middleware model | application must assemble validation/errors itself |
| Zod | runtime validation | TypeScript types do not validate network JSON | another schema to maintain |
| PostgreSQL | source of business/audit state | relations, indexes, durable transactions | higher latency than memory |
| Prisma | ORM and generated types | type-safe queries and declarative schema | abstraction/migration tooling overhead |
| Redis | fast shared coordination | queue, sorted sets, counters, locks | extra dependency and memory constraints |
| BullMQ | Redis-backed job queue | delayed jobs and worker concurrency | exactly-once is not guaranteed |
| Prometheus client | metrics | scrape-based operational measurements | process-local metrics require correct topology |
| Next.js | operator UI | React dashboard and routing | exposing browser-side credentials is unsafe in production |
| Docker Compose | local multi-service environment | reproducible startup | not a production orchestrator |

## 3.4 Where processes run

`docker-compose.yml` starts five services:

1. `postgres` on `5432`.
2. `redis` on `6379`.
3. `api` on `3001`.
4. `worker` without a public port.
5. `web` on `3000`.

The API and worker have separate entrypoints. [`server.ts`](../apps/api/src/server.ts) serves HTTP only, while the dedicated `worker` service runs `workers/init.ts` and consumes BullMQ jobs. This keeps API and delivery capacity independently scalable.

---

# 4. One webhook, end to end

## 4.1 Sequence diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Express API
    participant P as PostgreSQL
    participant Q as BullMQ/Redis
    participant W as Worker
    participant R as Receiver

    C->>A: POST /api/v1/webhooks + x-api-key
    A->>A: authenticate, rate-limit, validate
    A->>P: INSERT webhook(status=pending)
    P-->>A: webhook UUID
    A->>Q: ADD deliver-webhook {webhookId}
    Q-->>A: queued
    A-->>C: 202 Accepted + webhook_id
    Q->>W: deliver job
    W->>P: SELECT webhook
    W->>Q: SET lock NX PX
    W->>Q: read circuit state
    W->>P: load endpoint secrets
    W->>P: status=processing, attemptCount++
    W->>R: POST payload + signature headers
    alt Receiver returns 2xx
        R-->>W: 200 OK
        W->>P: INSERT successful attempt
        W->>P: status=delivered
        W->>Q: clear circuit + release lock
    else Receiver fails and attempts remain
        R-->>W: timeout/non-2xx
        W->>P: INSERT failed attempt
        W->>P: status=retrying, nextAttemptAt
        W->>Q: ADD delayed job
        W->>Q: release lock
    else Final failure
        W->>P: status=dead
        W->>Q: ADD DLQ job
        W->>Q: release lock
    end
```

## 4.2 Example request

```bash
curl -X POST http://localhost:3001/api/v1/webhooks \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: super_secret_rehook_key_123' \
  -d '{
    "target_url": "http://localhost:4000/webhook?mode=ok",
    "event_type": "order.shipped",
    "payload": {"order_id":"ord_42","carrier":"DHL"},
    "retry_config": {"max_attempts":5,"initial_delay_ms":5000}
  }'
```

Typical API response:

```json
{
  "message": "Webhook accepted for processing",
  "webhook_id": "a UUID",
  "status": "pending",
  "created_at": "an ISO timestamp"
}
```

Follow it with:

```bash
curl -H 'x-api-key: super_secret_rehook_key_123' \
  http://localhost:3001/api/v1/webhooks/WEBHOOK_ID/status
```

## 4.3 State machine

```mermaid
stateDiagram-v2
    [*] --> pending: database row created
    pending --> processing: worker begins HTTP attempt
    processing --> delivered: target returns 2xx
    processing --> retrying: failure and attempts remain
    retrying --> processing: delayed job runs
    processing --> dead: final attempt fails
    dead --> pending: manual replay
```

`failed` exists in the Prisma enum and frontend type but the current worker never assigns it.

---

# 5. Delivery semantics: what is actually guaranteed

This is the most important interview section.

## 5.1 At-most-once, at-least-once, exactly-once

| Semantic | Meaning | Consequence |
|---|---|---|
| At-most-once | zero or one delivery | may lose an event, never deliberately retries |
| At-least-once | one or more deliveries | avoids loss through retries, duplicates are possible |
| Exactly-once | exactly one business effect | generally requires end-to-end cooperation/idempotency |

ReHook aims for **at-least-once delivery**, with a Redis lock reducing simultaneous duplicate attempts. It does **not** prove exactly-once behavior.

Classic ambiguity:

1. Receiver processes the event and commits an order update.
2. Receiver’s `200 OK` is lost on the network.
3. ReHook sees a timeout and retries.
4. Receiver sees the event again.

No sender-side lock can determine whether step 1 happened. The receiver must be idempotent.

## 5.2 Idempotency practice

The current worker creates a new `X-ReHook-Delivery-ID` using `crypto.randomUUID()` for every attempt. That identifies the attempt, not a stable event. A receiver cannot deduplicate retries by that changing value.

A production approach typically sends both:

```http
X-ReHook-Event-ID: <stable webhook.id across retries>
X-ReHook-Delivery-ID: <unique attempt id>
```

Receiver pseudocode:

```ts
begin transaction
if processed_events contains eventId:
  return 200
apply business change
insert eventId into processed_events (unique constraint)
commit
return 200
```

## 5.3 Acceptance atomicity

Current ingestion performs two separate operations:

1. insert PostgreSQL row;
2. add Redis queue job.

There is no transaction spanning PostgreSQL and Redis. If the database insert succeeds but queue insertion fails, the API returns `500`, yet a `pending` row remains without a queued job. This is the **dual-write problem**.

A production solution is the **transactional outbox pattern**:

```text
single PostgreSQL transaction:
  insert webhook
  insert outbox row

outbox relay:
  read unprocessed outbox rows
  enqueue with stable job ID
  mark outbox row published
```

That converts a cross-system atomicity problem into a recoverable relay problem.

---

# 6. Boot, configuration, middleware, and routes

## 6.1 `server.ts`, line by line

Source: [`apps/api/src/server.ts`](../apps/api/src/server.ts)

| Lines | What happens | Why |
|---|---|---|
| 1 | imports the configured Express app | separates app construction from listening, useful for tests |
| 2 | imports environment config | centralizes port and infrastructure names |
| 4 | calls `app.listen(config.port)` | opens the TCP server without starting background consumers |
| 5–12 | logs useful local URLs | developer feedback only |

Workers use the separate `workers/init.ts` entrypoint, which the Compose `worker` service starts.

## 6.2 `app.ts`, line by line

Source: [`apps/api/src/app.ts`](../apps/api/src/app.ts)

| Lines | Explanation |
|---|---|
| 1–4 | import Express, CORS, Helmet, and the versioned router |
| 6 | instantiate the app |
| 8 | Helmet adds defensive HTTP headers |
| 9 | CORS currently allows broad cross-origin access by default |
| 10 | parse JSON bodies and reject bodies over 5 MB |
| 13–19 | shallow public health response; it does not check DB/Redis |
| 22 | mount router under `/api/v1` |
| 25–27 | return JSON 404 for unmatched routes |

Order matters: middleware registered earlier runs earlier.

## 6.3 Environment configuration

Source: [`apps/api/src/configs/env.config.ts`](../apps/api/src/configs/env.config.ts)

- `dotenv.config()` loads a local `.env` into `process.env`.
- `PORT` defaults to `3001`.
- `X_API_KEY` has a demo default.
- `POSTGRES_URL` and `REDIS_URL` select infrastructure.
- queue names allow environment separation.
- `NODE_ENV` defaults to development.

Production rule: fail startup when secrets or database URLs are missing. Silent insecure defaults are convenient locally but dangerous in deployment.

## 6.4 Route chain

Source: [`apps/api/src/api/routes/webhook.routes.ts`](../apps/api/src/api/routes/webhook.routes.ts)

Express executes handlers left to right. For ingestion:

```ts
router.post('/webhooks', authenticateApiKey, rateLimiter, WebhookController.registerWebhook);
```

This means:

```text
request -> authenticate -> rate limiter -> controller
```

The limiter is applied only to `POST /webhooks`, not every authenticated endpoint.

Complete API:

| Method and path | Purpose | Auth | Rate limited |
|---|---|---:|---:|
| `GET /api/health` | shallow liveness | no | no |
| `GET /api/v1/metrics` | Prometheus text | no | no |
| `POST /api/v1/webhooks` | accept event | yes | yes |
| `GET /api/v1/webhooks` | page/filter events | yes | no |
| `GET /api/v1/webhooks/:id/status` | one status | yes | no |
| `GET /api/v1/webhooks/:id/attempts` | attempt audit | yes | no |
| `GET /api/v1/dlq` | dead events | yes | no |
| `GET /api/v1/dlq/:id` | dead event detail | yes | no |
| `POST /api/v1/dlq/:id/replay` | requeue | yes | no |
| `POST /api/v1/endpoints` | endpoint + secret | yes | no |
| `POST /api/v1/endpoints/:id/rotate` | rotate secret | yes | no |
| `GET /api/v1/endpoints` | list by project | yes | no |

## 6.5 Validation

Source: [`webhook.validator.ts`](../apps/api/src/api/validators/webhook.validator.ts)

- `target_url` must be syntactically a URL. It is not restricted to HTTPS or protected from SSRF.
- `event_type` must be nonempty.
- `payload` must be an object/record.
- custom headers must have string values.
- `max_attempts` is 1–20, default 5.
- `initial_delay_ms` is 100–86,400,000, default 5,000.

Important: `initial_delay_ms` is validated but not stored or used by the worker. This is currently an API/implementation mismatch.

`safeParse` returns a success/error result instead of throwing. Controllers turn validation failures into `400 Bad Request` and call `.flatten()` to produce field errors.

---

# 7. Database and Prisma, line by line

Source: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)

## 7.1 Prisma basics

- `generator client` creates TypeScript query code.
- `datasource db` says the database is PostgreSQL.
- `env("POSTGRES_URL")` keeps connection details outside source logic.
- `@map` maps camelCase code fields to snake_case SQL columns.
- `@@map` maps model names to SQL table names.
- `@default(uuid())` generates primary IDs.
- `@updatedAt` updates the timestamp on changes.
- `@db.Timestamptz` stores timezone-aware instants.

## 7.2 Enums

`EndpointStatus` is `active | disabled`.

`WebhookStatus` describes the overall event lifecycle:

```text
pending -> processing -> delivered
                    \-> retrying -> processing
                    \-> dead
```

`ExecutionStatus` describes one attempt: `success`, `failure`, `timeout`, or `circuit_open`.

Do not confuse overall webhook status with individual attempt status.

## 7.3 `WebhookEndpoint`

| Field | Meaning |
|---|---|
| `id` | UUID primary key |
| `projectId` | tenant/project grouping, max 64 characters |
| `targetUrl` | subscriber URL |
| `description` | optional human context |
| `secretV1` | current signing secret |
| `secretV2` | previous secret during rotation |
| `status` | active/disabled |
| timestamps | creation and last update |
| `webhooks` | one-to-many relation |

`@@index([projectId])` supports endpoint listing by project.

## 7.4 `Webhook`

| Field | Meaning and use |
|---|---|
| `id` | stable event identity |
| `endpointId` | optional relation found by matching active target URL |
| `targetUrl` | copied destination so the event can stand alone |
| `eventType` | routing/business name such as `order.shipped` |
| `payload` | JSON sent to receiver |
| `headers` | caller-provided outbound headers |
| `meta` | internal/user metadata not sent by worker |
| `status` | overall lifecycle |
| `maxAttempts` | retry budget |
| `attemptCount` | executed HTTP attempts |
| `replayCount` | operator replay count |
| `nextAttemptAt` | informational scheduled retry time |
| timestamps | audit/ordering |

The composite `[status, nextAttemptAt]` index is useful for queries that search scheduled states, although the present worker relies on BullMQ delayed jobs rather than polling this index.

## 7.5 `DeliveryAttempt`

Each row is an audit record for one execution decision:

- attempt number;
- HTTP status if received;
- first 1,000 characters of response;
- elapsed milliseconds;
- error message;
- execution status;
- creation time.

The foreign key uses `onDelete: Cascade`: deleting a webhook deletes its attempts. Deleting an endpoint also cascades related webhooks because the webhook relation specifies cascade. There is currently no delete API.

## 7.6 Why normalize attempts?

Putting attempts in their own table avoids a growing JSON array inside the webhook row and makes audit entries individually queryable. Cost: retrieving a webhook plus attempts needs a relation query/join.

---

# 8. Fast-path ingestion and BullMQ

## 8.1 Controller path

Source: [`webhook.controller.ts`](../apps/api/src/api/controllers/webhook.controller.ts), lines 10–43.

1. `safeParse(req.body)` validates untrusted JSON.
2. Invalid input returns `400` and stops with `return`.
3. `WebhookService.registerWebhook` performs persistence and queueing.
4. Prometheus ingestion counter increments only after service success.
5. `202` returns the ID and initial status.
6. Unexpected errors return `500`.

Why a thin controller? HTTP details stay in the controller; reusable business/data operations stay in services.

## 8.2 Service path, line by line

Source: [`webhook.service.ts`](../apps/api/src/services/webhook.service.ts), lines 10–42.

| Lines | Explanation |
|---|---|
| 11 | choose requested max attempts or 5 |
| 14–16 | find an active endpoint whose URL exactly matches |
| 18–32 | insert webhook state into PostgreSQL |
| 20 | link endpoint when found, enabling signing |
| 24–25 | store optional headers and metadata as JSON |
| 26–30 | initialize lifecycle counters/times |
| 35–39 | enqueue only `{ webhookId }` |
| 38 | stable initial BullMQ job ID helps reject duplicate initial adds |
| 41 | return persisted Prisma object |

Only the ID is queued because PostgreSQL remains the authoritative source for mutable details. It also keeps Redis job payloads small. The trade-off is a database query for every job execution.

## 8.3 BullMQ queue configuration

Source: [`webhook.queue.ts`](../apps/api/src/queues/webhook.queue.ts)

`deliveryQueue`:

- completed jobs are removed;
- failed BullMQ jobs are retained;
- application failures normally do not throw to BullMQ; the worker manually reschedules them.

`dlqQueue`:

- completed and failed jobs are retained.

The application has two notions of DLQ:

1. PostgreSQL `Webhook.status = dead`, used by the API/dashboard;
2. a BullMQ DLQ job, consumed by `dlq.worker.ts` and retained as completed.

The database is effectively the operational source of truth. The DLQ worker only logs; it does not repair, notify, or persist anything new.

## 8.4 Why the path is called fast

The API waits for authentication, Redis limiter commands, validation, a PostgreSQL query, a PostgreSQL insert, and a Redis queue insertion—but not the receiver’s network response or retries. Therefore it is fast relative to synchronous delivery. “Under 15 ms” is a measured/local claim, not a logical guarantee in all deployments.

---

# 9. The delivery worker, line by line

Source: [`apps/api/src/workers/webhook.worker.ts`](../apps/api/src/workers/webhook.worker.ts)

This file is the system’s central orchestrator.

## 9.1 Imports and worker creation (lines 1–16)

- BullMQ `Worker` consumes jobs; `Job` supplies typed job data.
- Redis is used by BullMQ, circuit breaker, and lock.
- Prisma reads/writes business state.
- helpers isolate HMAC, backoff, and lock algorithms.
- queue objects enable retries and DLQ placement.
- Prometheus records outcomes and latency.
- Prisma enums prevent arbitrary status strings.
- `crypto.randomUUID()` creates ownership/delivery tokens.

The worker listens on the configured delivery queue.

## 9.2 Load and guard clauses (lines 17–28)

1. Extract `webhookId` from the tiny job.
2. Save start time for latency.
3. Fetch the row.
4. If it vanished, log and stop.
5. If already delivered/dead, stop. This protects against stale jobs.

These early returns are **guard clauses**: they keep the main path less nested.

## 9.3 Lock construction (lines 30–39)

`currentAttempt = attemptCount + 1` chooses the next logical attempt.

```text
lock:webhook:<webhook ID>:<attempt number>
```

A random token represents ownership. The worker asks Redis to create the lock only if absent, for 30 seconds. If another worker holds it, this worker exits without sending.

## 9.4 `try/finally` (lines 41 and 209–211)

Everything after acquisition runs in `try`. `finally` releases the lock whether the path succeeds, fails, or returns early. This is resource cleanup analogous to closing a file or DB connection.

Release errors are swallowed with `.catch(() => {})`, relying on the TTL to expire the lock.

## 9.5 Circuit decision (lines 42–67)

1. Build a circuit breaker keyed by target host.
2. `isAllowed()` permits `CLOSED` or `HALF_OPEN`.
3. When open, calculate jitter with a 15-second base.
4. Insert a `circuit_open` audit entry.
5. Add a delayed job and return.

The open-circuit path deliberately does not increment `attemptCount`, because no receiver call occurred. However, it can create repeated audit rows with the same `attemptNumber`, and it does not update `nextAttemptAt`.

## 9.6 Outbound headers and signing (lines 69–93)

- Convert stored JSON headers to a string map.
- Force JSON content type.
- identify the sender as `ReHook-Engine/1.0`.
- generate an attempt-specific `X-ReHook-Delivery-ID`.
- if linked endpoint secrets exist, sign the payload.
- attach signature and timestamp headers.

The worker overwrites conflicting stored values for these system headers. `headers` references the parsed Prisma JSON object for this execution; it is not written back to the database.

## 9.7 Mark processing (lines 95–109)

The code recomputes/shadows `currentAttempt` inside the `try` block, initializes result variables, and updates the webhook:

```text
status = processing
attemptCount = currentAttempt
```

This update happens before the HTTP request so status inspection can show active work.

## 9.8 HTTP execution (lines 111–141)

1. Create an `AbortController`.
2. Schedule abort after 10 seconds.
3. serialize JSON payload.
4. `fetch` a POST with headers/body/signal.
5. cancel timer when a response arrives.
6. store status and at most 1,000 response characters.
7. every 2xx (`response.ok`) counts as success.
8. non-2xx becomes failure.
9. `AbortError` becomes timeout; other exceptions become network failures.

Nuance: if `fetch` throws, `clearTimeout(timeoutId)` is not called. The timer will eventually fire; a `finally` around the fetch would be cleaner.

## 9.9 Audit and metrics (lines 143–157)

Elapsed wall time is observed in seconds because Prometheus metric conventions prefer seconds. Then the worker inserts one delivery-attempt row with all collected fields.

The histogram includes pre-request work since `startTime` is set before the database read and lock/circuit checks. Its name says “delivery duration,” so this is a defensible but important interpretation.

## 9.10 Success branch (lines 159–170)

- reset circuit state/failure counter;
- increment `rehook_webhooks_delivered_total{status="success"}`;
- mark webhook `delivered`;
- log outcome.

## 9.11 Failure/retry/DLQ branch (lines 171–207)

Every HTTP/network failure is recorded against the host circuit.

If attempt budget is exhausted:

- metric label `dead` increments;
- webhook becomes `dead`;
- stable `dlq-<id>` job is added;
- error is logged.

Otherwise:

- metric label `retrying` increments;
- jitter delay is calculated;
- `nextAttemptAt` is stored;
- status becomes `retrying`;
- a delayed delivery job is added.

BullMQ worker `concurrency: 10` means this process runs up to ten job processors concurrently. Multiple processes multiply total concurrency.

---

# 10. Retries, exponential backoff, and full jitter

Source: [`backoff.utils.ts`](../apps/api/src/utils/backoff.utils.ts)

## 10.1 Why retry?

Many failures are temporary: deployment restart, packet loss, a short overload, or transient `500`. Immediate permanent failure would lose recoverable events.

## 10.2 Why not retry immediately?

If 10,000 events fail and all retry immediately, they intensify the outage. This is a **retry storm** or **thundering herd**.

## 10.3 Formula

```text
exponential = initialDelay × 2^(attempt - 1)
capped      = min(maxDelay, exponential)
sleep       = random integer in [0, capped)
```

With default initial delay 5,000 ms:

| Attempt | Cap | Possible full-jitter delay | Expected average |
|---:|---:|---:|---:|
| 1 | 5 s | 0–just under 5 s | ~2.5 s |
| 2 | 10 s | 0–just under 10 s | ~5 s |
| 3 | 20 s | 0–just under 20 s | ~10 s |
| 4 | 40 s | 0–just under 40 s | ~20 s |
| 5 | 80 s | 0–just under 80 s | ~40 s |

The one-hour cap prevents unbounded delays.

## 10.4 Line-by-line helper

| Line | Meaning |
|---|---|
| 5–9 | accept attempt count and optional initial/max delays |
| 10 | grow exponentially, protecting attempts below 1 |
| 11 | enforce ceiling |
| 13 | choose uniform random delay and floor to integer |

## 10.5 Retry policy caveats

Current code retries every non-2xx equally, including many `4xx` responses that are usually permanent. A production classifier might use:

- retry: timeouts, network errors, `408`, `425`, `429`, most `5xx`;
- do not retry: most `400`, `401`, `403`, `404`, `422` unless configuration changes;
- honor `Retry-After` for `429`/`503`;
- distinguish connection timeout from total response timeout.

---

# 11. Distributed circuit breaker

Source: [`circuitBreaker.service.ts`](../apps/api/src/services/circuitBreaker.service.ts)

## 11.1 Circuit-breaker analogy

An electrical breaker stops current after a fault. A software circuit breaker stops network calls after repeated failures, allowing the dependency and caller to recover.

```mermaid
stateDiagram-v2
    [*] --> CLOSED
    CLOSED --> OPEN: at least 5 failures in 60s
    OPEN --> HALF_OPEN: 30s cooldown expires
    HALF_OPEN --> CLOSED: successful call
    HALF_OPEN --> OPEN: failed call
```

- `CLOSED`: normal traffic.
- `OPEN`: reject/short-circuit traffic without contacting receiver.
- `HALF_OPEN`: test whether recovery occurred.

## 11.2 Scope is per host

Constructor parses the URL and stores `parsedUrl.host`, including port. These URLs share a circuit:

```text
https://api.example.com/webhook/a
https://api.example.com/webhook/b
```

That protects the host as one downstream dependency. It may be too broad when unrelated tenants share a host, or too narrow when host aliases point to the same service.

## 11.3 Redis keys

```text
circuit_breaker:<host>:state
circuit_breaker:<host>:failures
circuit_breaker:<host>:open_until
```

Redis makes state visible to all worker processes.

## 11.4 Code walkthrough

`getState()`:

- absent state means `CLOSED`;
- `OPEN` reads the deadline;
- if cooldown expired, writes and returns `HALF_OPEN`;
- otherwise remains `OPEN`.

`isAllowed()` allows closed and half-open calls.

`recordSuccess()` deletes all three keys, making absent state closed.

`recordFailure()`:

- a half-open failure immediately reopens for another cooldown;
- a closed-state failure uses atomic `INCR`;
- the first failure sets a 60-second TTL;
- five failures open the circuit and store a deadline.

## 11.5 Important concurrency limitation

Transitioning to `HALF_OPEN` is not a single-probe lease. Many workers can observe/receive `HALF_OPEN` and all are allowed. A production breaker would use an atomic Lua script or `SET NX` probe token so only one/few probes pass.

The state transition and deadline writes are separate commands, and success deletes shared failure state. This is useful demonstration code, not a fully linearizable circuit-breaker implementation.

---

# 12. Distributed locking and duplicate prevention

Source: [`lock.utils.ts`](../apps/api/src/utils/lock.utils.ts)

## 12.1 The race

Two worker processes can contend for the same logical attempt:

```text
Worker A reads attemptCount=0
Worker B reads attemptCount=0
Worker A sends attempt 1
Worker B sends attempt 1  <-- duplicate
```

## 12.2 Acquisition: `SET key token PX ttl NX`

- `SET`: write key/value.
- `NX`: only if key does not exist.
- `PX 30000`: expire after 30,000 ms.
- `token`: random ownership proof.

Redis executes one command atomically, so only one contender receives `OK`.

TTL is essential: if the owner crashes, the lock eventually disappears.

## 12.3 Why release needs Lua

Unsafe release:

```text
GET lock -> token matches
lock expires; Worker B obtains it
DEL lock -> Worker A accidentally deletes Worker B's lock
```

The Lua script checks token and deletes in one atomic server-side operation:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

## 12.4 Is this Redlock?

Strictly, no. This repository implements a **single-Redis token lock** using the core `SET NX PX` pattern. The Redlock algorithm coordinates a majority of multiple independent Redis masters and reasons about clock/lease validity. Calling this helper “Redlock” in interviews invites a follow-up you should answer honestly.

Good phrasing:

> “I implemented a Redis lease with random ownership tokens and atomic Lua release. It reduces concurrent duplicates in the current single-Redis deployment. For stronger fault tolerance I would use a proven lock library/quorum design, while still relying on receiver idempotency.”

## 12.5 Lock limitations

- no lease renewal;
- if total protected work exceeds 30 seconds, another worker may acquire it;
- Redis failover semantics can violate exclusivity depending on replication;
- lock acquisition failure simply returns, trusting another job to finish;
- a lock reduces concurrent duplication but cannot solve ambiguous HTTP outcomes.

The outbound timeout is 10 seconds, leaving headroom within the 30-second lease, but DB/Redis delays also occur inside the protected section.

---

# 13. Authentication, rate limiting, HMAC, and rotation

## 13.1 API-key authentication

Sources: [`auth.middleware.ts`](../apps/api/src/middlewares/auth.middleware.ts), [`crypto.utils.ts`](../apps/api/src/utils/crypto.utils.ts)

Flow:

1. read `x-api-key`;
2. reject absent/non-string values with `401`;
3. compare against configured key;
4. call `next()` when valid.

`crypto.timingSafeEqual` avoids byte-by-byte early exit for equal-length inputs. The helper first returns when lengths differ, so key length can be inferred; key length normally is not treated as secret. This is safer than ordinary string comparison but only one part of API security.

Current system uses one global API key, not per-user/project keys, roles, expiry, hashing, revocation, or audit ownership.

## 13.2 Sliding-window rate limiter

Source: [`rateLimiter.middleware.ts`](../apps/api/src/middlewares/rateLimiter.middleware.ts)

Redis sorted set representation:

```text
key: ratelimit:<api key>
score: request timestamp in milliseconds
member: timestamp-random suffix
```

Per request, a Redis transaction/pipeline:

1. removes entries older than 60 seconds (`ZREMRANGEBYSCORE`);
2. adds current request (`ZADD`);
3. counts current entries (`ZCARD`);
4. refreshes key TTL (`EXPIRE`);
5. returns `429` if count is greater than 1,000.

Time complexity is approximately `O(log N + M)` for removal/addition where `M` expired items are removed, plus `O(1)` cardinality. Memory is `O(N)` per active key within the window.

The limiter is **fail-open**: if Redis errors, traffic is allowed. This prioritizes availability over protection. Also, the rejected request is inserted before the count check, so repeated rejected traffic remains counted until it ages out.

## 13.3 HMAC from first principles

Hash:

```text
message -> SHA-256 -> fixed digest
```

A plain hash proves only content equality; anyone can recompute it. HMAC includes a shared secret:

```text
HMAC-SHA256(secret, message) -> authentication tag
```

Only holders of the secret can generate a valid tag. It provides integrity and sender authenticity, not encryption. The payload remains readable.

ReHook signs:

```text
<unix timestamp>.<JSON.stringify(payload)>
```

and sends:

```http
X-ReHook-Signature: t=TIMESTAMP,v1=HEX[,v2=HEX]
X-ReHook-Timestamp: TIMESTAMP
```

## 13.4 Receiver verification example

```ts
const rawBody = obtainExactRawRequestBody();
const { t, v1, v2 } = parseSignatureHeader(req.headers['x-rehook-signature']);

if (Math.abs(nowInSeconds() - Number(t)) > 300) reject('stale request');

const signed = `${t}.${rawBody}`;
const expected = hmacSha256(currentOrOldSecret, signed);
if (!timingSafeEqualAny(expected, [v1, v2])) reject('bad signature');

processIdempotently(stableEventId, rawBody);
```

Exact bytes matter. Parsing and re-stringifying JSON can change whitespace/key order. The current sender signs `JSON.stringify(payload)` and sends the same serialization in a separate call, which is normally deterministic for the same object, but robust webhook specifications explicitly define raw-byte canonicalization.

The included mock receiver checks whether signature headers are present; it does not cryptographically verify them.

## 13.5 Zero-downtime rotation

Source: [`endpoint.service.ts`](../apps/api/src/services/endpoint.service.ts)

Initial state:

```text
v1 = OLD
v2 = null
```

Rotation:

```text
v1 = NEW
v2 = OLD
```

Deliveries now contain signatures made with both. Receivers update to `NEW` while still accepting `OLD`.

Missing lifecycle step: there is no finalize endpoint that removes `v2` after the grace period. Repeated rotation also overwrites the previous `v2`, so operational coordination matters.

## 13.6 Security boundaries and risks

- endpoint secrets are stored plaintext in PostgreSQL and returned by API;
- the dashboard API key is in a `NEXT_PUBLIC_*` variable and therefore browser-visible;
- metrics are public;
- CORS is broad;
- arbitrary target URLs create SSRF risk (cloud metadata/private network access);
- HTTP URLs are accepted, so signatures/payload can travel without TLS;
- custom outbound headers could contain sensitive values stored in DB;
- default demo credentials must never be production credentials.

Production controls: secret manager/envelope encryption, server-side dashboard session, scoped API keys, HTTPS allowlist, DNS/IP revalidation, egress proxy, private-range blocking, payload classification, audit logs, and restricted CORS.

---

# 14. DLQ, replay, observability, and dashboard

## 14.1 DLQ concept

A dead-letter queue separates events that exhausted automatic recovery. Without it, the system either retries forever or silently drops work.

DLQ enables:

- inspection;
- alerting;
- root-cause correction;
- controlled replay;
- audit/history.

## 14.2 Replay code path

Source: [`webhook.service.ts`](../apps/api/src/services/webhook.service.ts), lines 102–128.

1. find webhook or return `null`;
2. set status `pending`;
3. reset attempt count to zero;
4. increment replay count atomically in SQL;
5. set next time to now;
6. try to remove stable DLQ job;
7. enqueue new delivery job with timestamped replay ID.

Audit attempt rows are retained, which is good for history. But attempt numbers restart at 1 after replay, so `(webhookId, attemptNumber)` is not globally unique and timelines should also use `createdAt`/replay generation.

The service currently allows replay of any existing webhook, not only `dead` ones. The route name and UI imply DLQ-only behavior, so production should enforce an allowed state transition in a transaction.

## 14.3 Metrics

Source: [`telemetry.service.ts`](../apps/api/src/services/telemetry.service.ts)

- default Node/Bun process metrics;
- `rehook_webhooks_ingested_total` counter;
- `rehook_webhooks_delivered_total{status=...}` counter;
- `rehook_delivery_duration_seconds` histogram with fixed buckets.

Prometheus types:

- **Counter:** only increases; use rates over time.
- **Gauge:** can rise/fall, good for queue depth (not implemented).
- **Histogram:** counts observations in buckets and supports server-side quantiles.

Process topology caveat: `prom-client` stores metrics in process memory. `/metrics` exposes only the API process registry, so the separate worker container’s delivery counters are not visible there. Production options include exposing and scraping metrics from each worker, service discovery, or centralized OpenTelemetry/metrics aggregation.

Useful missing metrics:

- queue waiting/delayed/active depth;
- delivery attempts by target/status code class;
- circuit state/transitions;
- DLQ size and oldest age;
- lock contention;
- time from ingestion to successful delivery;
- replay success/failure.

## 14.4 Dashboard

Source: [`apps/web/lib/api.ts`](../apps/web/lib/api.ts) and pages under `apps/web/app`.

The frontend API wrapper:

- centralizes base URL and auth header;
- fetches webhooks and attempts;
- dispatches test events;
- lists/replays DLQ items;
- creates endpoints and rotates secrets.

UI features not listed in the screenshot:

- live polling every five seconds on the main page;
- status filtering and KPI cards;
- webhook detail drawer with attempt history;
- quick-dispatch modal;
- endpoint/secret management;
- per-item and client-side sequential bulk DLQ replay;
- toast feedback.

The dashboard computes several KPIs from the current fetched page, not necessarily the entire dataset. They are operator conveniences, not authoritative global analytics.

---

# 15. Testing, benchmarks, and local practice

## 15.1 Test inventory

The current repository contains 28 declared tests across 11 files:

| Area | What is tested |
|---|---|
| auth | valid, missing, invalid API key |
| limiter | headers/allow and 429 branch with mock Redis |
| validator | valid payload, bad URL, missing event type |
| crypto | compare, deterministic HMAC, dual signature |
| backoff | jitter bounds and cap |
| lock | acquisition, contention, token-safe release against Redis |
| concurrency | five contenders and lock TTL |
| circuit | default closed, open denied, half-open allowed with mocks |
| worker helper | backoff behavior; not full HTTP worker orchestration |
| DLQ controller | list, missing detail, replay response with mocks |
| API integration | health, auth, ingest, endpoints, rotation, DLQ, metrics |

Tests prove only their assertions and environment. They do not by themselves prove zero loss, 99.99% reliability, exactly-once delivery, or correctness across 100 nodes.

## 15.2 Verification performed for this guide

On 2026-08-02:

- `tsc --noEmit` passed.
- `bun test` without local Redis/PostgreSQL produced **18 pass, 10 fail, 31 runtime errors**.
- Redis-dependent lock tests timed out because Redis was unavailable.
- Supertest integration tests failed to bind ephemeral port `0` in this sandbox/runtime.

Therefore the repository badge/handbook’s “32 passing” statement was not reproduced in this environment. This is an environment-qualified result, not proof that those tests always fail. Run the suite after starting Docker infrastructure.

## 15.3 Correct local practice sequence

```bash
docker compose up -d
bun install
bun db:generate
bun db:push
bun test:api
bun mock:receiver
```

In separate terminals:

```bash
bun dev:api
bun --cwd apps/web dev
```

Dashboard: `http://localhost:3000`; API: `http://localhost:3001`.

## 15.4 Failure drills

### Drill A: success

Target `http://localhost:4000/webhook?mode=ok`. Expect `pending -> processing -> delivered`, one success attempt, and success metric increment.

### Drill B: retry and DLQ

Target `?mode=fail`, set `max_attempts: 3`. Observe randomized delays, three actual HTTP attempts, then `dead`. Inspect `/dlq`, correct target conditions, replay.

### Drill C: rate limit

Temporarily configure a smaller limiter in a test and send more requests than allowed in 60 seconds. Inspect `X-RateLimit-*` and `429`.

### Drill D: circuit breaker

Send many events to the same failing host. After threshold, inspect Redis keys and see calls short-circuited for cooldown. Then restore receiver and observe half-open recovery.

### Drill E: signature verification

Extend mock receiver to store the exact raw body, calculate HMAC over `timestamp.rawBody`, apply a five-minute timestamp tolerance, and compare with `timingSafeEqual`.

### Drill F: lock contention

Run the concurrency test with Redis and explain why exactly one `SET NX` succeeds. Then deliberately reduce lock TTL below simulated work time to demonstrate lease expiry risk.

## 15.5 Benchmarks

- `load-tests/k6-baseline.js` ramps to 50 virtual users and checks ingestion p95.
- `load-tests/k6-circuit-breaker.js` sends events to a failing receiver.
- `apps/api/src/scripts/benchmark.ts` sends 1,000 requests in batches of 50.

Benchmark cautions:

- the native script’s “average ingest time” is total batch wall time divided by requests, not average individual response latency;
- performance depends on hardware, warmup, Docker/network, DB state, payload size, and colocated services;
- circuit benchmark’s HTTP measurement is ingestion, not direct measurement of receiver calls saved;
- published numbers should be stated with methodology and date, not as universal SLAs.

---

# 16. Complexity and scaling analysis

Let:

- `N` = requests for one rate-limit identity within window;
- `A` = attempt rows for a webhook;
- `W` = number of webhook rows returned;
- `C` = worker concurrency per process (10);
- `P` = worker processes.

| Operation | Approximate complexity | Bottleneck |
|---|---|---|
| auth key compare | `O(K)` key bytes | negligible |
| Zod payload validation | `O(payload size)` | CPU/memory, 5 MB limit |
| rate limit | `O(log N + removed)` | Redis sorted set |
| webhook insert | index-dependent `O(log rows)` | PostgreSQL I/O |
| queue add/pop | roughly `O(log jobs)` depending BullMQ structure | Redis |
| webhook lookup by UUID | `O(log rows)` index | PostgreSQL |
| backoff calculation | `O(1)` | none |
| circuit operations | `O(1)` Redis commands | network/Redis |
| list attempts | `O(log rows + A)` | result size |
| list webhooks | `O(log rows + W)` plus count | offset becomes costly at large offsets |

Maximum nominal delivery concurrency is approximately:

```text
total worker concurrency = C × P
```

With one worker process at the configured concurrency of 10, this is 10 concurrent jobs. Scaling dedicated worker replicas increases delivery concurrency independently; scaling API replicas does not add consumers.

## 16.1 Scaling dimensions

- **Ingestion scale:** API replicas, PostgreSQL connection capacity, Redis limiter/queue throughput.
- **Delivery scale:** worker replicas/concurrency, receiver limits, DB attempt writes.
- **Storage scale:** payload size × events, response audit size, retention.
- **Hot-host scale:** many events for one target share circuit state but have no per-host concurrency limit.
- **Tenant scale:** one global API key and URL-based endpoint lookup are insufficient isolation.

## 16.2 Backpressure

A queue absorbs temporary mismatches between producer and consumer speed. It does not create infinite capacity. If ingestion rate exceeds delivery rate for long enough, queue age and storage grow. Production needs queue-depth/age alerts, per-tenant quotas, per-host concurrency, admission control, and capacity scaling.

---

# 17. Current gaps and production improvements

This chapter is not an attack on the project. Recognizing boundaries is senior engineering behavior.

| Current behavior | Risk | Production improvement |
|---|---|---|
| PostgreSQL insert then Redis enqueue | stranded pending row | transactional outbox + relay |
| at-least-once attempts | duplicate business effects | stable event ID + receiver idempotency |
| random delivery ID per retry | cannot dedupe event by it | separate stable event and attempt IDs |
| single Redis lease called Redlock | failover/lease limitations | precise naming, proven quorum/library if justified |
| fixed 30s lock, no renewal | expiry during slow protected work | lease extension/fencing token or redesign |
| half-open allows all | recovery probe burst | atomic probe lease/budget |
| circuit operations split across commands | races/inconsistent snapshots | Lua/transaction/state versioning |
| all non-2xx retry | waste on permanent 4xx | retry classifier + `Retry-After` |
| `initial_delay_ms` ignored | misleading API | persist and pass to backoff |
| circuit-open rows can repeat attempt number | confusing/unbounded audit | separate decision sequence or unique execution ID |
| replay accepts any status | invalid transition/race | conditional transactional update `dead -> pending` |
| endpoint selected by exact URL | ambiguity/duplicates | require endpoint ID, unique tenant-scoped constraint |
| secret plaintext and returned | credential exposure | KMS/envelope encryption, show once, redaction |
| no secret-rotation finalization | old key persists | grace deadline + retire endpoint |
| browser-visible global API key | anyone with UI can extract key | BFF/session auth + scoped server credentials |
| arbitrary URL | SSRF/internal network access | HTTPS allowlist, DNS/IP validation, egress proxy |
| broad CORS/public metrics | data/attack exposure | origin policy, internal metrics network/auth |
| shallow health always healthy | false readiness | separate liveness/readiness, DB/Redis checks |
| process-local metrics | incomplete worker totals | scrape every process or central telemetry |
| no graceful shutdown | in-flight disruption | close HTTP, worker, Redis, Prisma on signals |
| response body stored | sensitive data/storage growth | redaction, classification, retention TTL |
| no payload retention policy | unbounded DB | archival/deletion policy |
| offset pagination | slow/deceptive under churn | cursor pagination |
| `failed` status unused | ambiguous model | remove or define transition |
| no per-target concurrency limit | overwhelm one receiver | BullMQ groups/custom semaphore |
| no migrations directory | schema drift governance | committed migrations, not production `db push` |
| queue Redis durability unspecified | possible queued-work loss | AOF/replication/managed Redis + outbox recovery |

## 17.1 A production target architecture

```mermaid
flowchart LR
    C[Client] --> G[Authenticated API]
    G -->|one transaction| DB[(Webhook + Outbox)]
    O[Outbox relay] --> DB
    O --> Q[(Durable queue)]
    Q --> W[Dedicated workers]
    W --> S[SSRF-safe egress proxy]
    S --> R[Receiver]
    W --> DB
    W --> T[Central telemetry]
    UI[Session-auth operator UI] --> G
    K[KMS/Secrets] --> W
```

---

# 18. Interview-ready explanation

## 18.1 30-second answer

> “ReHook is an asynchronous webhook delivery platform. An Express API authenticates and rate-limits requests, validates them with Zod, stores event state in PostgreSQL through Prisma, and enqueues a BullMQ job in Redis. Distributed workers sign payloads with HMAC, call receivers with a timeout, record attempt audits and Prometheus metrics, retry transient failures using exponential full jitter, protect unhealthy hosts with a Redis circuit breaker, and move exhausted events to a replayable DLQ. A Next.js dashboard provides operational visibility. Its semantics are at-least-once, so production receivers should be idempotent.”

## 18.2 Two-minute architecture answer

> “I split the system into an ingestion plane and a delivery plane. The ingestion API returns 202 after validation, PostgreSQL persistence, and BullMQ enqueue, so it does not wait on an unreliable subscriber. The queue absorbs traffic bursts and workers scale independently. Each worker loads authoritative state by webhook ID, takes a Redis token lock for the logical attempt, checks a host-scoped distributed circuit breaker, attaches HMAC signatures, and sends a 10-second-bounded HTTP POST. It records every actual attempt in PostgreSQL. Failures are retried with capped exponential full jitter; after the configured budget the event is marked dead and exposed through DLQ APIs/dashboard for replay. Redis also implements a 60-second sliding-window ingestion limiter, while Prometheus exposes counters and latency buckets. I would describe the guarantee as at-least-once, not exactly-once, and the current lock as a single-Redis lease rather than strict Redlock. For production I would add a transactional outbox, stable event idempotency keys, SSRF controls, scoped credentials, atomic half-open probes, dedicated worker processes, and centralized metrics.”

## 18.3 STAR story without invented numbers

- **Situation:** webhook receivers can be slow, unavailable, or rate-limited, coupling them directly to business requests.
- **Task:** accept events quickly, deliver reliably, contain downstream failures, and give operators recovery tools.
- **Action:** built asynchronous persistence/queueing, worker retries with full jitter, circuit breaking, HMAC rotation, attempt audits, DLQ replay, telemetry, tests, load scripts, and dashboard.
- **Result:** created a demonstrable system with reproducible local benchmark artifacts and operational recovery paths. Quote measured numbers only with their documented environment; do not claim 99.99% reliability unless a long-running reliability test actually establishes it.

## 18.4 Design decisions to defend

**Why PostgreSQL and Redis?** PostgreSQL is authoritative relational/audit storage; Redis is fast ephemeral/shared coordination and BullMQ infrastructure. Different workload strengths justify two systems, but create a dual-write problem solved by an outbox in production.

**Why full jitter?** Exponential delay reduces pressure; randomness prevents synchronized retries from becoming another outage wave.

**Why a circuit breaker if retries exist?** Retries recover individual events. A circuit breaker protects shared capacity when an entire host is unhealthy.

**Why HMAC rather than encryption?** The receiver needs to verify integrity/authenticity. Transport confidentiality should come from TLS; HMAC does not hide data.

**Why a DLQ?** Infinite retries hide poison events and consume capacity. DLQ creates a bounded automatic policy and explicit human recovery path.

---

# 19. Interview questions and answers

## Q1. Why return 202 instead of 200?

`202 Accepted` communicates that processing will occur asynchronously. A `200` could be misunderstood as successful final delivery.

## Q2. What happens if Redis is down during ingestion?

Rate limiting fails open, but later queue insertion fails. The controller returns `500`; because DB insertion happens first, a pending row may remain. An outbox would make this recoverable.

## Q3. What happens if PostgreSQL is down?

Endpoint lookup or webhook insert fails, so nothing is queued and API returns `500`.

## Q4. Can BullMQ deliver a job twice?

Distributed queues generally provide at-least-once processing under failures/stalls. Yes, duplicates must be anticipated.

## Q5. Does the Redis lock provide exactly once?

No. It reduces simultaneous duplicate execution. It cannot resolve an HTTP response lost after receiver commit, lock-expiry races, or all Redis failover cases.

## Q6. Why include timestamp in HMAC?

It enables replay-window enforcement. The receiver must actually reject stale timestamps; signing alone does not stop replay.

## Q7. Why two signatures during rotation?

Producer and receiver cannot update atomically. New and old signatures let receivers migrate during a grace window without dropping events.

## Q8. Why store attempts separately?

It provides an append-like audit trail and avoids endlessly growing a single webhook JSON field. It supports ordered history queries.

## Q9. How does full jitter prevent a herd?

Without randomness, all failures from the same time retry at identical exponential boundaries. Uniform random delays spread work across the interval.

## Q10. Circuit breaker versus rate limiter?

Rate limiter controls how much traffic a caller may submit. Circuit breaker stops outbound calls because a dependency is unhealthy. They protect different boundaries.

## Q11. What is the DLQ source of truth here?

Operational APIs query PostgreSQL rows with status `dead`. A BullMQ DLQ also exists, but its worker only logs and consumes jobs to completed state.

## Q12. How would you support multiple tenants?

Tenant-scoped hashed API keys/roles, tenant ID on all rows and queue metadata, unique endpoint constraints, per-tenant quotas, authorization filters, encryption boundaries, and noisy-neighbor controls.

## Q13. How would you avoid SSRF?

Require HTTPS; validate hostname; resolve DNS and reject loopback/private/link-local/metadata ranges; revalidate after redirects; disable or strictly limit redirects; use an egress proxy/allowlist and network policy.

## Q14. How do you know the receiver processed an event?

A 2xx is an acknowledgement, not mathematical proof of business commit. Define receiver contract: commit idempotently before returning 2xx.

## Q15. How would you test crash recovery?

Kill a worker before send, during send, after receiver commit but before DB update, and during retry scheduling. Assert eventual state, bounded duplicates, lock expiry, outbox recovery, and receiver idempotency.

## Q16. Why is `nextAttemptAt` not enough to schedule retries?

It is a database timestamp. Current scheduling is actually performed by BullMQ’s delayed job. The field is informational for UI/audit unless a polling scheduler consumes it.

## Q17. Is the health endpoint readiness?

No. It returns static healthy JSON without checking PostgreSQL or Redis. It is liveness-like, not dependency readiness.

## Q18. What would you alert on?

Oldest queue age, DLQ growth, delivery error rate, p95/p99 delivery latency, circuit openings, Redis/PostgreSQL errors, lock contention, and outbox lag.

---

# 20. Learning and practice plan

## Phase 1 — foundations

Be able to explain HTTP request/response, JSON, headers, status codes, async processing, processes, database rows/indexes, Redis keys/TTL, and producer/consumer queues.

Practice: manually call health, invalid auth, invalid payload, valid ingestion, and status APIs with `curl`.

## Phase 2 — trace the code

Set breakpoints/logs in this order:

1. route;
2. auth middleware;
3. rate limiter;
4. controller;
5. service DB insert;
6. queue add;
7. worker DB read;
8. lock;
9. circuit;
10. HMAC;
11. fetch;
12. audit/status branch.

For every step answer: input, output, state changed, failure behavior, and why it belongs in that layer.

## Phase 3 — resilience experiments

Run success, `500`, `429`, random failure, receiver-down, Redis-down, and worker-kill scenarios. Write down state transitions and whether the caller, worker, DB, queue, and receiver agree.

## Phase 4 — implement learning improvements

Good exercises, in order:

1. persist/use `initial_delay_ms`;
2. add stable `X-ReHook-Event-ID`;
3. cryptographically verify mock-receiver signatures;
4. classify retryable status codes and honor `Retry-After`;
5. enforce `dead -> pending` replay transactionally;
6. add queue-depth and end-to-end latency metrics;
7. separate API and worker entrypoints;
8. implement an outbox relay;
9. add SSRF defenses;
10. implement atomic half-open probe ownership.

## Phase 5 — mock interview checklist

Without notes, draw:

- architecture diagram;
- request sequence;
- webhook state machine;
- circuit state machine;
- retry formula and example;
- HMAC rotation timeline;
- at-least-once duplicate scenario;
- outbox improvement.

Then answer:

1. why this system exists;
2. why each datastore exists;
3. what happens on every failure boundary;
4. what is and is not guaranteed;
5. how you tested it;
6. what you would improve first and why.

## Final mental model

```text
ReHook is not “an API that calls another API.”

It is a state machine around an unreliable side effect:

accept -> persist -> schedule -> coordinate -> authenticate delivery
       -> observe -> retry safely -> isolate failure -> recover manually
```

If that sentence is clear, the individual features stop looking like unrelated buzzwords. Each one controls a specific failure boundary in the same end-to-end lifecycle.
