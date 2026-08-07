# ReHook 9–9.5/10 Production Hardening Plan

## Objective

Raise ReHook from a strong production-inspired portfolio project to a system with explicit durability, identity, security, lifecycle, observability, migration, and test guarantees. The target remains **at-least-once delivery**; exactly-once delivery is not claimed.

## End-to-end target flow

```text
authenticated project request
  -> validate payload and target URL
  -> PostgreSQL transaction
       -> create webhook with stable event ID
       -> create durable outbox event
  -> outbox relay publishes stable BullMQ job
  -> worker atomically claims pending/retrying webhook
  -> attach stable X-ReHook-Event-ID
  -> attach unique X-ReHook-Delivery-ID
  -> call receiver with timeout and HMAC signature
  -> persist attempt audit
  -> delivered, or transactionally schedule retry/DLQ through outbox
  -> expose API and worker telemetry
```

## Phase 1 — Durable scheduling

### Changes

- Add `OutboxEvent` with queue, status, availability, publish attempts, error, and timestamps.
- Create webhook and initial outbox row in one PostgreSQL transaction.
- Create replay transition and replay outbox row in one PostgreSQL transaction.
- Create retry/dead state and corresponding delivery/DLQ outbox row together.
- Publish BullMQ jobs with the stable outbox ID as `jobId`.
- Retry unpublished outbox rows rather than losing accepted work during Redis outages.
- Persist and honor `initial_delay_ms` through `availableAt`/`nextAttemptAt`.

### Acceptance criteria

- A Redis outage after API acceptance leaves a pending outbox row.
- Restoring Redis causes the relay to publish the job without another API request.
- Re-running the relay does not create a second logical BullMQ job for the same outbox row.
- Only `dead` webhooks can enter the replay transition.

## Phase 2 — Identity and state correctness

### Changes

- Use webhook UUID as stable `X-ReHook-Event-ID` across every retry and replay.
- Generate a new `X-ReHook-Delivery-ID` for each actual/circuit-open attempt.
- Persist and index the delivery ID on `DeliveryAttempt` for correlation.
- Claim work with a conditional `pending|retrying -> processing` update guarded by the previous attempt count.
- Preserve at-least-once semantics and receiver-side idempotency requirements.

### Acceptance criteria

- All attempts for one webhook share one event ID.
- Every attempt has a distinct delivery ID visible in the UI.
- Concurrent workers cannot both claim the same stored attempt state.
- Replay of a non-dead webhook returns HTTP `409`.

## Phase 3 — Security and project isolation

### Changes

- Resolve API keys per `x-project-id` using `PROJECT_API_KEYS`.
- Override body/query project IDs with authenticated project context.
- Scope webhook, attempt, DLQ, endpoint, and rotation reads/writes to that project.
- Restrict target URLs to HTTP(S), reject embedded credentials, resolve DNS, and block private, loopback, link-local, multicast, and reserved targets in production.
- Keep `ALLOW_PRIVATE_WEBHOOK_TARGETS=true` only for local receiver testing.

### Follow-up boundary

The current dashboard still uses a development `NEXT_PUBLIC_API_KEY`. A public deployment must move authentication into a server-side session/BFF and must never ship project API credentials to browser JavaScript.

### Acceptance criteria

- A key for project A cannot read, replay, rotate, or create resources for project B.
- Production rejects metadata-service and RFC1918 destinations.
- Development can explicitly opt into localhost receivers.

## Phase 4 — Lifecycle and observability

### Changes

- Separate liveness (`/api/health`) from dependency readiness (`/api/ready`).
- Drain HTTP connections on `SIGTERM`/`SIGINT` before closing Prisma and Redis.
- Stop outbox polling, drain BullMQ workers, close queues, then close dependencies on worker shutdown.
- Expose worker-process Prometheus metrics on port `9464`.
- Add outbox success/failure and lock-contention metrics.

### Acceptance criteria

- API readiness returns `503` when PostgreSQL or Redis is unavailable.
- Worker shutdown waits for active jobs instead of immediately terminating them.
- Worker metrics include delivery, outbox, latency, and lock-contention series.

## Phase 5 — Schema governance and deployment

### Changes

- Commit an initial production Prisma migration.
- Add `db:migrate:deploy` for managed deployments.
- Retain `db:push` only in the local hot-reload Compose workflow.
- Expose worker metrics and add API readiness health checks in Compose.

### Existing-volume migration note

Databases previously created with `prisma db push` have no migration history. Back up important data, baseline the existing database with Prisma migration resolution, or recreate the local development volume before adopting `migrate deploy`.

## Phase 6 — Automated verification

### Required test layers

- Pure unit tests: URL/IP safety, backoff, HMAC, authentication, lock ownership.
- Service tests: transactional outbox creation and invalid replay transitions.
- Integration tests: PostgreSQL + Redis + API + relay + worker + mock receiver.
- Failure tests: Redis unavailable during acceptance, worker killed before/after receiver commit, slow receiver beyond lease, duplicate relay publication.
- UI tests: dispatch success, retry/DLQ, replay, attempt identity display, endpoint rotation, project isolation.

### CI contract

```text
generate Prisma client
-> typecheck API and web
-> start isolated PostgreSQL and Redis
-> apply migrations
-> run unit/integration tests
-> build production containers
```

## Phase 7 — Remaining work for a genuine 9.5 production rating

- Replace browser-visible API keys with server sessions and a BFF.
- Store only hashed API credentials and provide create/revoke/rotate flows.
- Encrypt endpoint secrets with KMS/envelope encryption and reveal them once.
- Add lease renewal or fencing tokens for long-running deliveries.
- Add atomic half-open circuit-breaker probe ownership.
- Add queue-depth/oldest-age gauges and centralized OpenTelemetry traces.
- Add per-target concurrency controls, retention/redaction policies, backups, managed Redis durability, and an egress proxy.
- Deploy to a reproducible cloud environment and run failure-injection tests.

## Manual UI validation matrix

| Scenario | Target | Expected UI result |
|---|---|---|
| Successful delivery | `https://httpbin.org/post` | pending -> processing -> delivered; one attempt with event/delivery identity |
| Retry and DLQ | `https://httpbin.org/status/500` | retrying attempts followed by dead; record appears in DLQ |
| Replay | Replay a dead record | replay count increments; state returns to pending and runs again |
| Delayed first attempt | dispatch with delay | remains pending until configured delay passes |
| Endpoint signing | registered endpoint URL | attempt succeeds with HMAC headers generated by worker |
| Redis recovery | stop/start Redis around dispatch | accepted outbox row publishes after Redis returns |
| Project isolation | two project headers/keys | each project sees only its own resources |
| SSRF protection | production target `http://127.0.0.1` | API rejects target |
| Readiness | stop Redis/PostgreSQL | `/api/ready` returns `503` |
| Worker metrics | visit port `9464/metrics` | worker/outbox/delivery metrics render |

## Definition of done

- Schema, API, worker, dashboard types, Compose, tests, and documentation agree.
- Typechecks pass for API and web.
- Migration validates against an empty PostgreSQL database.
- Manual success, failure, DLQ, replay, identity, isolation, readiness, and recovery flows are reproducible.
- Known remaining risks are documented without overstating delivery guarantees.
