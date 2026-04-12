# GTM Workers Implementation Plan

This plan is for building the `gtm-workers` service in this repository. It is based on:

- `high_level_design.md`
- the current `gtm-workers` scaffold
- the current contracts already described in `gtm-ai`
- the current crawler output shape in `gtm-web-crawler`
- the current local infrastructure in `docker-compose.yml`

Read this document from top to bottom once before writing code. Then implement it in order, checkpoint by checkpoint. Do not skip the verification steps.

The current `gtm-workers` code is not a working service yet. Treat it as a partial scaffold:

- `src/index.ts` is only a placeholder.
- `package.json` has almost no real runtime configuration.
- several existing files import modules that do not exist.
- the database schema is incomplete for the full lead-processing flow.

## Goal

- [ ] Build a real `gtm-workers` service with two runtimes:
- [ ] an HTTP API process that exposes two endpoints:
- [ ] one internal endpoint that starts the Apify actor run
- [ ] one webhook endpoint that Apify calls when the run finishes
- [ ] a long-running queue worker that reads posts from Redis and performs the AI plus dOrg flow
- [ ] Create `bun run api` as the Bun HTTP server.
- [ ] Create `bun run worker` as the long-running consumer.
- [ ] Make the trigger endpoint, webhook import flow, and worker idempotent enough that retries do not create duplicate posts or duplicate lead claims.
- [ ] Keep all service boundaries clean. `gtm-workers` must talk to `gtm-ai` through a client interface and to `gtm-web-crawler` through Apify. Do not import service internals from either project.
- [ ] Keep the implementation Bun-first: `bun run`, `bun test`, Bun SQL, Bun Redis, and `Bun.serve()`.

## Runtime Shape To Keep In Your Head

- [ ] The external scheduler does not run the crawler directly. It calls an internal HTTP endpoint on `gtm-workers`.
- [ ] The internal trigger endpoint starts the Apify actor asynchronously and returns immediately with the Apify run ID.
- [ ] The trigger endpoint configures an Apify webhook for the started run.
- [ ] When the actor reaches a terminal state, Apify calls the `gtm-workers` webhook endpoint.
- [ ] The webhook endpoint fetches the dataset from Apify, deduplicates posts by URL, inserts pending rows into Postgres, and enqueues Redis payloads.
- [ ] The worker reads the queue, calls `gtm-ai`, updates the database, claims the lead in dOrg, and surfaces the lead.
- [ ] If the webhook is retried by Apify, the import flow must be safe to run again.
- [ ] If the worker crashes and restarts, queue handling must not lose messages.

## Current Repo Reality

- [ ] Understand that `gtm-workers/src/index.ts` currently only prints `"Hello via Bun!"`.
- [ ] Understand that `gtm-workers/package.json` currently does not declare the dependencies or scripts needed for a real service.
- [ ] Understand that `src/storage/drizzle-post-repository.ts`, `src/storage/redis-processed-url-store.ts`, and `src/storage/redis-queue-publisher.ts` currently import `../services/interfaces.js`, `../domain/post.js`, and `../config/appConfig.js`, but those files do not exist.
- [ ] Understand that the current `posts` table shape is missing AI result fields, dOrg fields, crawl-run tracking, webhook retry support, and better status coverage.
- [ ] Understand that the current `docker-compose.yml` runs plain `valkey/valkey` and does not configure RedisBloom. Because of that, you must explicitly decide how v1 deduplication works before coding.

## Non-Negotiable Rules

- [ ] Centralize environment parsing in one `zod` config module. Do not read `process.env` all over the codebase.
- [ ] Validate all external JSON at the boundary: trigger requests, Apify webhook requests, Apify dataset items, Redis queue messages, GTM AI responses, and dOrg API responses.
- [ ] Use named types and schemas instead of `any`.
- [ ] Keep functions short and single-purpose.
- [ ] Use one export per file.
- [ ] Use composition and small use-case functions instead of deep inheritance or giant god-classes.
- [ ] Do not wait for the Apify run to finish inside the trigger endpoint. Start the run and return immediately.
- [ ] Do not expose the trigger endpoint without authentication.
- [ ] Do not accept webhook requests without validating a shared secret or other explicit authentication mechanism.
- [ ] The webhook handler must be safe to run more than once for the same Apify run.
- [ ] Return `5xx` from the webhook handler for transient import failures so Apify can retry the webhook.
- [ ] Do not use a queue pattern that loses a message if the worker crashes after reserving it.
- [ ] Do not permanently mark a URL as processed until the database insert and queue publish have both succeeded.
- [ ] Do not deduplicate on post content. Deduplicate only on the canonical Reddit post URL, as required by `high_level_design.md`.

## Contracts You Must Freeze Before Coding

### Crawler Output Contract

- [ ] Freeze the crawler dataset item shape that the webhook import flow will accept from Apify.
- [ ] Base that shape on the current crawler output in `gtm-web-crawler/src/domain/post.ts` and `gtm-web-crawler/src/routes.ts`.
- [ ] Validate this input with a schema such as `src/schemas/apify-reddit-post-schema.ts`.
- [ ] Treat these fields as the minimum v1 contract: `url`, `username`, `content`, `postedAt`, `nLikes`, `nComments`, and `topic`.
- [ ] Record in code comments and tests that `postedAt` is currently a Unix timestamp in milliseconds.
- [ ] Treat `url` from the crawler as the canonical dedupe key. The crawler already canonicalizes post URLs before pushing to the dataset.

### Trigger Endpoint Contract

- [ ] Freeze the trigger route path early. Recommended v1 path: `POST /internal/crawl-runs`.
- [ ] Protect the route with a static token or bearer token. Recommended env var: `TRIGGER_API_TOKEN`.
- [ ] Keep the request body intentionally small.
- [ ] Recommended v1 request shape: either an empty JSON object or `{ source: "scheduler" | "manual" }`.
- [ ] Return `202 Accepted` on success because the run starts asynchronously and the import work will happen later.
- [ ] Recommended v1 response shape:

```json
{
  "apifyRunId": "string",
  "actorId": "string",
  "status": "READY|RUNNING",
  "webhookUrl": "string"
}
```

- [ ] Do not put dataset import logic in this endpoint.
- [ ] Do not put queue write logic in this endpoint.

### Apify Webhook Contract

- [ ] Freeze the webhook route path early. Recommended v1 path: `POST /webhooks/apify/run-finished`.
- [ ] Protect the route with a shared secret. Recommended env var: `APIFY_WEBHOOK_SECRET`.
- [ ] Decide whether to use Apify's default webhook payload or a custom `payloadTemplate`.
- [ ] Recommended v1 approach: use an ad hoc webhook with a small custom payload that contains only the fields the webhook handler needs.
- [ ] Keep the webhook payload machine-friendly and stable.
- [ ] Recommended minimum webhook payload fields:
- [ ] `eventType`
- [ ] `actorId`
- [ ] `apifyRunId`
- [ ] `status`
- [ ] `defaultDatasetId` if available
- [ ] `finishedAt`
- [ ] Before coding the payload parser, verify the exact payload field names against the real Apify webhook behavior or the official webhook docs.
- [ ] Validate the webhook body with a local schema such as `src/schemas/apify-run-webhook-schema.ts`.
- [ ] If the webhook payload does not include `defaultDatasetId`, fetch the run details from Apify by `apifyRunId` before importing.
- [ ] Return `200` for successful imports and safe duplicate no-ops.
- [ ] Return `4xx` for invalid authentication or invalid payloads.
- [ ] Return `5xx` for transient import failures so Apify can retry safely.

### GTM AI Contract

- [ ] Freeze the worker-to-AI input to match the current `gtm-ai` schema: `id`, `platform`, `topic`, `url`, `username`, `content`, `ageText`, `likes`, `nComments`, and `capturedAt`.
- [ ] Do not invent `ageText`. Until the crawler produces that field, pass `null`.
- [ ] Freeze the score response shape as exactly `{ leadProbability: number }`.
- [ ] Freeze the analysis response shape as either `{ isLead: false }` or `{ isLead: true, whyFit, needs, timing, contactInfo }`.
- [ ] Freeze the lead-score threshold as a single constant inside `gtm-workers`. Recommended value: `0.7`.

### Queue Contract

- [ ] Freeze the main queue payload as exactly `{ id: string; platform: "reddit" }`.
- [ ] Freeze the dead-letter queue payload as a different schema that includes `id`, `platform`, `stage`, `errorMessage`, `failedAt`, and `originalPayload`.
- [ ] Keep queue messages intentionally small. Do not push the full post body into Redis.

### dOrg API Contract

- [ ] Freeze `claimLead` to send `{ identifier: post.url, channel: "reddit" }` unless the dOrg API owner confirms a different identifier.
- [ ] Freeze `surfaceLead` to send `{ lead_id, brief }`.
- [ ] Keep `sendMessage` out of scope for v1 because it is not part of the high-level workers flow.

## Recommended Target File Layout

- [ ] `src/config/app-env.ts`
- [ ] `src/constants/route-paths.ts`
- [ ] `src/constants/lead-score-threshold.ts`
- [ ] `src/constants/post-status.ts`
- [ ] `src/constants/crawl-run-status.ts`
- [ ] `src/constants/queue-names.ts`
- [ ] `src/schemas/trigger-crawl-request-schema.ts`
- [ ] `src/schemas/trigger-crawl-response-schema.ts`
- [ ] `src/schemas/apify-run-webhook-schema.ts`
- [ ] `src/schemas/apify-reddit-post-schema.ts`
- [ ] `src/schemas/queue-payload-schema.ts`
- [ ] `src/schemas/dead-letter-payload-schema.ts`
- [ ] `src/schemas/dorg-claim-response-schema.ts`
- [ ] `src/schemas/dorg-surface-response-schema.ts`
- [ ] `src/domain/post-platform.ts`
- [ ] `src/domain/post-status.ts`
- [ ] `src/domain/crawl-run-status.ts`
- [ ] `src/domain/post-record.ts`
- [ ] `src/domain/crawl-run-record.ts`
- [ ] `src/domain/dead-letter-stage.ts`
- [ ] `src/storage/database.ts`
- [ ] `src/storage/schema/posts-table.ts`
- [ ] `src/storage/schema/crawl-runs-table.ts`
- [ ] `src/storage/repositories/post-repository.ts`
- [ ] `src/storage/repositories/crawl-run-repository.ts`
- [ ] `src/storage/processed-url-store.ts`
- [ ] `src/storage/lead-queue.ts`
- [ ] `src/clients/apify-crawler-client.ts`
- [ ] `src/clients/gtm-ai-client.ts`
- [ ] `src/clients/dorg-api-client.ts`
- [ ] `src/http/create-server.ts`
- [ ] `src/http/handle-health-request.ts`
- [ ] `src/http/handle-trigger-crawl-request.ts`
- [ ] `src/http/handle-apify-webhook-request.ts`
- [ ] `src/use-cases/start-apify-crawl-run.ts`
- [ ] `src/use-cases/import-apify-run-dataset.ts`
- [ ] `src/use-cases/process-post-job.ts`
- [ ] `src/use-cases/process-queue-loop.ts`
- [ ] `src/worker/build-surface-brief.ts`
- [ ] `src/worker/mark-post-error.ts`
- [ ] `src/bin/api.ts`
- [ ] `src/bin/worker.ts`
- [ ] `drizzle.config.ts`
- [ ] `.env.example`
- [ ] `README.md`
- [ ] `Dockerfile`
- [ ] `test/fixtures/apify/webhook/*.json`
- [ ] `test/fixtures/apify/dataset/*.json`
- [ ] `test/unit/**/*.test.ts`
- [ ] `test/integration/**/*.test.ts`

## Package And Scripts Checkpoint

- [ ] Rewrite `gtm-workers/package.json` so it describes a real service.
- [ ] Add a `build` script. Recommended command: `bun build src/bin/api.ts src/bin/worker.ts --outdir dist --target bun --packages external`.
- [ ] Add a `typecheck` script. Recommended command: `bunx tsc --noEmit`.
- [ ] Add an `api` script. Recommended command: `bun run src/bin/api.ts`.
- [ ] Add a `worker` script. Recommended command: `bun run src/bin/worker.ts`.
- [ ] Add a `test` script. Recommended command: `bun test`.
- [ ] Add `db:generate` and `db:migrate` scripts using `bunx drizzle-kit`.
- [ ] Add runtime dependencies for the actual service. At minimum this should include `zod`, `drizzle-orm`, `apify-client`, and a UUIDv7 package.
- [ ] Add dev dependencies for schema generation and local development. At minimum this should include `drizzle-kit`.
- [ ] Decide whether to add a logging library. Recommended v1: keep structured `console` logging to reduce moving parts.
- [ ] Remove or rewrite any existing source file that still imports modules that do not exist.
- [ ] Add `.env.example` because `gtm-workers` currently only has a local `.env` file.
- [ ] Verification step: run `bun install`.
- [ ] Verification step: run `bun run typecheck`.

## Configuration Checkpoint

- [ ] Create `src/config/app-env.ts` and validate every environment variable with `zod`.
- [ ] Parse `WORKERS_API_HOST`.
- [ ] Parse `WORKERS_API_PORT`.
- [ ] Parse `WORKERS_PUBLIC_BASE_URL` because Apify needs a public webhook URL to call.
- [ ] Parse `TRIGGER_API_TOKEN`.
- [ ] Parse `APIFY_WEBHOOK_SECRET`.
- [ ] Parse `DATABASE_URL`.
- [ ] Parse `REDIS_URL`.
- [ ] Parse `DORG_API_TOKEN`.
- [ ] Parse `DORG_API_BASE_URL` with a default of `https://agentsofdorg.tech/api`.
- [ ] Parse `APIFY_TOKEN`.
- [ ] Parse `APIFY_ACTOR_ID`.
- [ ] Parse `APIFY_RUN_TIMEOUT_SECONDS` if you want a hard cap on actor runs.
- [ ] Parse `GTM_AI_BASE_URL`.
- [ ] Parse `GTM_AI_REQUEST_TIMEOUT_MS` with a safe default.
- [ ] Parse `LEAD_SCORE_THRESHOLD` with a default of `0.7`.
- [ ] Parse `QUEUE_NAME`, `QUEUE_PROCESSING_NAME`, and `QUEUE_DLQ_NAME` with stable defaults.
- [ ] Parse `PROCESSED_URLS_KEY` with a stable default.
- [ ] Parse `WORKER_POLL_TIMEOUT_SECONDS` with a stable default for blocking Redis operations.
- [ ] Parse `WORKER_REQUEUE_STALE_ON_STARTUP` if you want startup recovery to be configurable.
- [ ] Parse numbers with `z.coerce.number()` so string env vars become numbers safely.
- [ ] Export one validated `appEnv` object and use it everywhere.
- [ ] Update `.env.example` so it matches the real code exactly.
- [ ] Verification step: add unit tests for valid env parsing, missing required vars, and invalid number parsing.
- [ ] Verification step: run `bun run typecheck`.
- [ ] Verification step: run `bun test`.

## HTTP Server Checkpoint

- [ ] Build one Bun HTTP server with `Bun.serve()`.
- [ ] Create a health route. Recommended path: `GET /healthz`.
- [ ] Create the internal trigger route. Recommended path: `POST /internal/crawl-runs`.
- [ ] Create the Apify webhook route. Recommended path: `POST /webhooks/apify/run-finished`.
- [ ] Reject unsupported methods with `405`.
- [ ] Reject unknown routes with `404`.
- [ ] Parse JSON request bodies safely and return `400` for invalid JSON.
- [ ] Keep HTTP handlers thin. Route handlers should validate input, call one use case, and build the response.
- [ ] Do not put business logic directly inside the `fetch()` route switch.
- [ ] Add integration tests for route matching, auth failures, bad JSON, and happy-path requests.

## Domain And Status Checkpoint

- [ ] Create a `PostPlatform` type and freeze it to `"reddit"` for v1.
- [ ] Create a `PostStatus` type or constant list and freeze the exact status names before building repositories or worker logic.
- [ ] Recommended post status list:

```text
pending
scoring
below_threshold
analyzing
not_a_lead
claiming
claim_failed
surfacing
completed
error
```

- [ ] Create a `CrawlRunStatus` type or constant list for the API plus webhook flow.
- [ ] Recommended crawl run status list:

```text
started
webhook_received
importing
completed
failed
```

- [ ] Freeze the allowed post status transitions and document them in tests.
- [ ] Recommended high-level post transitions:

```text
pending -> scoring -> below_threshold
pending -> scoring -> analyzing -> not_a_lead
pending -> scoring -> analyzing -> claiming -> claim_failed
pending -> scoring -> analyzing -> claiming -> surfacing -> completed
any non-terminal stage -> error
```

- [ ] Freeze the allowed crawl run status transitions and document them in tests.
- [ ] Recommended high-level crawl run transitions:

```text
started -> webhook_received -> importing -> completed
started -> webhook_received -> failed
importing -> failed
```

- [ ] Create a small `workerRunId` helper so each worker process can stamp logs and AI request context consistently.
- [ ] Create a small `httpRequestId` helper so the trigger and webhook handlers can correlate logs.
- [ ] Create a mapper that converts a database post row into the exact GTM AI input shape.
- [ ] Create a mapper that converts an Apify dataset item into a database insert shape.
- [ ] Create a mapper that converts the webhook payload into one normalized internal `ApifyRunNotification` type.
- [ ] Verification step: add unit tests for all mappers and status transition helpers.
- [ ] Verification step: run `bun test`.

## Database Checkpoint

- [ ] Replace the current `posts` schema with a shape that supports the full workflow.
- [ ] Keep `id` as the primary key and make it UUIDv7.
- [ ] Keep `url` unique because it is the real dedupe key.
- [ ] Keep `platform`, `topic`, `username`, `content`, `postedAt`, `likes`, and `nComments`.
- [ ] Add `capturedAt` so the worker can pass a real `capturedAt` value to GTM AI.
- [ ] Add `status`.
- [ ] Add `leadProbability`.
- [ ] Add `whyFit`.
- [ ] Add `needs`.
- [ ] Add `timing`.
- [ ] Add `contactInfo`.
- [ ] Add `dorgLeadId`.
- [ ] Add `errorMessage`.
- [ ] Add `apifyRunId` so imported posts can be traced back to a crawl.
- [ ] Add `apifyDatasetId` so imported posts can be traced back to a dataset.
- [ ] Keep `createdAt` and `updatedAt`.
- [ ] Use timestamp columns in UTC and be explicit about timezone handling.
- [ ] Add an index on `status` because the worker and debugging tools will query by status frequently.

- [ ] Add a new `crawl_runs` table because the trigger endpoint and webhook endpoint are now separated in time.
- [ ] Keep `apifyRunId` unique in `crawl_runs`.
- [ ] Store `actorId`.
- [ ] Store `status`.
- [ ] Store `defaultDatasetId` if known.
- [ ] Store `requestedBy` or `source` if you want to distinguish scheduler vs manual runs.
- [ ] Store `errorMessage`.
- [ ] Store `startedAt`, `webhookReceivedAt`, `importStartedAt`, `completedAt`, and `updatedAt`.
- [ ] Optional but recommended: store counters such as `itemsRead`, `itemsImported`, `duplicatesSkipped`, `invalidItems`, and `failedItems`.
- [ ] The webhook handler must be able to upsert a crawl run by `apifyRunId`. Do not assume the trigger endpoint insert always succeeded.
- [ ] Create `drizzle.config.ts`.
- [ ] Generate the first migration for `gtm-workers`.
- [ ] Create repository modules with business-oriented methods instead of raw SQL spread across the app.
- [ ] Add a post repository method to insert a new pending post.
- [ ] Add a post repository method to fetch a post by ID.
- [ ] Add a post repository method to save the lead score result and advance status.
- [ ] Add a post repository method to save the lead analysis result and advance status.
- [ ] Add a post repository method to save the claimed dOrg lead ID.
- [ ] Add a post repository method to mark claim failure.
- [ ] Add a post repository method to mark completion.
- [ ] Add a post repository method to mark unexpected errors.
- [ ] Add a crawl-run repository method to create or upsert a started run.
- [ ] Add a crawl-run repository method to mark webhook received.
- [ ] Add a crawl-run repository method to mark importing.
- [ ] Add a crawl-run repository method to mark completed with counters.
- [ ] Add a crawl-run repository method to mark failed with an error message.
- [ ] Make every repository write update `updatedAt`.
- [ ] Verification step: add tests for migration generation, inserts, updates, and unique URL plus unique run behavior.
- [ ] Verification step: run `bun run typecheck`.
- [ ] Verification step: run `bun test`.

## Deduplication Checkpoint

- [ ] Create a `ProcessedUrlStore` interface so the webhook import flow does not care how deduplication is implemented.
- [ ] Decide the v1 implementation now.
- [ ] Recommended v1 implementation: use a Redis `SET` because the current local stack does not provide RedisBloom.
- [ ] Keep the interface generic so you can add a real RedisBloom-backed implementation later without changing the webhook import logic.
- [ ] If you want extra safety against two webhook deliveries importing the same run at the same time, add a temporary run-level claim key such as `import-run:<apifyRunId>`.
- [ ] If you want extra safety against duplicate URL imports inside the same time window, add a temporary URL claim key with TTL before writing to the database.
- [ ] If you use temporary URL claims, acquire the claim first, then insert into the database, then publish to the queue, then permanently mark the URL as processed, then release the temporary claim.
- [ ] Do not permanently mark the URL as processed before queue publish succeeds. If you do that and publishing fails, the post is lost forever.
- [ ] Treat a database unique-constraint failure on `url` as a duplicate, not as a fatal crash.
- [ ] Add unit tests for duplicate URL detection, run-level import locking, and temporary claim behavior.

## Queue Checkpoint

- [ ] Create a `LeadQueue` abstraction with methods like `enqueue`, `reserveNext`, `ack`, `moveToDeadLetter`, and `requeueProcessing`.
- [ ] Use Redis lists for v1 because the high-level design only requires a Redis-based queue and lists are simple to implement.
- [ ] Use three lists: main queue, processing queue, and dead-letter queue.
- [ ] Recommended reserve pattern: atomically move an item from the main queue to the processing queue using a blocking Redis operation.
- [ ] Recommended acknowledge pattern: after successful processing, remove the exact raw message from the processing queue.
- [ ] On unexpected failure, push a dead-letter payload to the dead-letter queue and then remove the raw message from the processing queue.
- [ ] On startup, decide how to recover items stranded in the processing queue after a crash.
- [ ] Recommended startup recovery for v1: move all processing items back to the main queue before starting the loop.
- [ ] Validate every Redis message with `QueuePayloadSchema` or `DeadLetterPayloadSchema` before acting on it.
- [ ] Add tests for enqueue, reserve, acknowledge, dead-lettering, and startup requeue behavior.
- [ ] Verification step: run `bun test`.

## Apify Client Checkpoint

- [ ] Create an `ApifyCrawlerClient` interface so the trigger endpoint and webhook import use case do not depend on the raw SDK everywhere.
- [ ] Implement it with the official `apify-client` package.
- [ ] The trigger endpoint must use `actor(APIFY_ACTOR_ID).start(...)`, not `call(...)`, because the endpoint should not wait for the run to finish.
- [ ] Configure ad hoc webhooks when starting the run.
- [ ] Recommended event coverage: `ACTOR.RUN.SUCCEEDED`, `ACTOR.RUN.FAILED`, `ACTOR.RUN.ABORTED`, and `ACTOR.RUN.TIMED-OUT`.
- [ ] Make the webhook request URL point to the public webhook endpoint on `gtm-workers`.
- [ ] Send the webhook secret as a custom header or another explicit authenticated field. Do not rely on obscurity alone.
- [ ] If you use a custom payload template, verify the exact Apify interpolation syntax against the official docs before committing the implementation.
- [ ] Create a method to fetch run details by `apifyRunId`.
- [ ] Create a method to fetch dataset items page by page by dataset ID.
- [ ] Do not assume the dataset always fits in one response.
- [ ] Validate every fetched item with the Apify post schema before importing it.
- [ ] Log enough context to debug invalid items without dumping secrets.
- [ ] Add unit tests using a fake Apify client so tests never hit the real network.

## Trigger Endpoint Flow Checkpoint

- [ ] Implement `startApifyCrawlRun` as the main use case behind `POST /internal/crawl-runs`.
- [ ] Authenticate the caller before doing any work.
- [ ] Validate the request body with `TriggerCrawlRequestSchema`.
- [ ] Build the public webhook URL from `WORKERS_PUBLIC_BASE_URL` plus the fixed webhook path.
- [ ] Build the ad hoc webhook configuration for Apify.
- [ ] Start the actor asynchronously with `start()`.
- [ ] Capture the returned `apifyRunId`, `actorId`, `status`, and `defaultDatasetId` if Apify returns it immediately.
- [ ] Create or upsert a `crawl_runs` row for the started run.
- [ ] Return `202 Accepted` with the run metadata.
- [ ] Do not fetch dataset items here.
- [ ] Do not write to the Redis post queue here.
- [ ] If the actor starts successfully but the local `crawl_runs` write fails, make sure the webhook flow can still recover later by upserting the run by `apifyRunId`.
- [ ] Add integration tests for auth failure, bad request, happy path, and actor-start failure.

## Webhook Import Flow Checkpoint

- [ ] Implement `importApifyRunDataset` as the main use case behind `POST /webhooks/apify/run-finished`.
- [ ] Authenticate the webhook request before parsing or importing anything expensive.
- [ ] Validate the request body with `ApifyRunWebhookSchema`.
- [ ] Normalize the webhook payload into one internal notification type.
- [ ] Upsert or create the `crawl_runs` row by `apifyRunId` if it does not already exist.
- [ ] Mark the crawl run as `webhook_received`.
- [ ] If the webhook says the run failed, timed out, or was aborted, mark the crawl run as `failed`, store the error message if available, return `200`, and do not attempt dataset import.
- [ ] If the crawl run is already marked `completed`, return `200` as a safe no-op because duplicate webhook deliveries are expected.
- [ ] If you use a run-level import lock and it is already held, return a success response that does not start a second concurrent import.
- [ ] Resolve the dataset ID:
- [ ] use `defaultDatasetId` from the webhook if present
- [ ] otherwise fetch the run details from Apify by `apifyRunId`
- [ ] Mark the crawl run as `importing`.
- [ ] Fetch dataset items page by page.
- [ ] For each dataset item, validate it.
- [ ] For each valid item, optionally acquire a temporary URL claim to prevent concurrent double-imports.
- [ ] Check whether the canonical URL was already processed.
- [ ] If the URL is already processed, skip it and record a duplicate counter.
- [ ] If the URL is new, generate a UUIDv7 post ID.
- [ ] Insert the post into Postgres with status `pending`.
- [ ] Publish `{ id, platform: "reddit" }` to the main queue.
- [ ] Only after the insert and publish succeed, permanently mark the URL as processed.
- [ ] If publishing fails after the row was inserted, mark the row as `error` and do not silently continue.
- [ ] If the database insert fails because the URL already exists, treat it as a duplicate and do not enqueue again.
- [ ] Release any temporary URL claim key in a `finally` block.
- [ ] Keep summary counters for `itemsRead`, `itemsImported`, `duplicatesSkipped`, `invalidItems`, and `failedItems`.
- [ ] On full success, mark the crawl run as `completed` with the counters and return `200`.
- [ ] On transient failure, mark the crawl run as `failed`, store the error, and return `5xx` so Apify can retry the webhook safely.
- [ ] Add integration tests for success, duplicate webhook retry, failed-run webhook, invalid item handling, partial import failure, and retry-after-partial-failure scenarios.

## GTM AI Client Checkpoint

- [ ] Create a `GtmAiClient` interface with exactly two methods: `scorePost` and `analyzePost`.
- [ ] Keep the concrete implementation isolated in one module so the rest of the worker does not care whether the transport is HTTP or an official client package.
- [ ] Do not import `gtm-ai` source code directly. `gtm-workers` must treat AI as another service.
- [ ] Build one pure mapper from a database post row to the AI input schema.
- [ ] Always send `requestContext` with `postId`, `platform`, `topic`, `source: "worker"`, and `workerRunId`.
- [ ] Validate the score response with a local schema before using it.
- [ ] Validate the analysis response with a local schema before using it.
- [ ] Decide how to time out slow AI calls and make that timeout configurable.
- [ ] Add tests using a fake GTM AI client for score-below-threshold, not-a-lead, and lead cases.

## dOrg API Client Checkpoint

- [ ] Rewrite the existing `src/dorg-api` scaffold into a proper client module with validated responses.
- [ ] Create typed parameter objects for `claimLead` and `surfaceLead`.
- [ ] Make `claimLead` return a typed success/failure result with a message that can be safely saved to the database.
- [ ] Make `surfaceLead` return a typed success/failure result with a message.
- [ ] Treat non-2xx responses as failures.
- [ ] Treat unexpected response JSON shapes as failures.
- [ ] Make timeout handling explicit and configurable.
- [ ] Never log the bearer token.
- [ ] Add tests for success, known business failure, non-2xx failure, and malformed JSON failure.

## Worker Processing Flow Checkpoint

- [ ] Implement `processQueueLoop` as the main worker use case.
- [ ] On startup, optionally requeue stranded items from the processing list back to the main queue.
- [ ] Generate one `workerRunId` for the process and reuse it in logs and AI request context.
- [ ] Reserve the next queue message from Redis using the safe queue abstraction.
- [ ] Parse and validate the queue payload.
- [ ] Load the post row from Postgres.
- [ ] If the post row does not exist, create a dead-letter entry and acknowledge the raw queue message.
- [ ] If the row is already in a terminal state like `below_threshold`, `not_a_lead`, `claim_failed`, or `completed`, acknowledge the message and skip it.
- [ ] Set status to `scoring`.
- [ ] Call the GTM AI score workflow.
- [ ] Save `leadProbability`.
- [ ] If `leadProbability < LEAD_SCORE_THRESHOLD`, set status to `below_threshold`, acknowledge the queue message, and stop processing this item.
- [ ] Set status to `analyzing`.
- [ ] Call the GTM AI analysis workflow.
- [ ] If the analysis result is `{ isLead: false }`, set status to `not_a_lead`, acknowledge the queue message, and stop processing this item.
- [ ] If the analysis result is a lead, save `whyFit`, `needs`, `timing`, and `contactInfo`.
- [ ] Build a surface brief string in one dedicated helper function.
- [ ] Set status to `claiming`.
- [ ] Call `claimLead`.
- [ ] If `claimLead` fails in an expected business way, set status to `claim_failed`, save the message, acknowledge the queue message, and stop processing this item.
- [ ] If `claimLead` succeeds, save `dorgLeadId` immediately before calling `surfaceLead`.
- [ ] Set status to `surfacing`.
- [ ] Call `surfaceLead`.
- [ ] If `surfaceLead` succeeds, set status to `completed` and acknowledge the queue message.
- [ ] If an unexpected error happens at any stage, set status to `error`, save the error message, write a dead-letter payload, and acknowledge or release the raw queue message safely through the queue abstraction.
- [ ] Decide how retries should behave if the worker crashes after `claimLead` succeeds but before `surfaceLead` succeeds.
- [ ] Recommended v1 behavior: if `dorgLeadId` is already present on the row, skip `claimLead` on retry and continue with `surfaceLead`.
- [ ] Add integration tests for below-threshold, not-a-lead, claim-failed, happy-path lead completion, and unexpected-error-to-DLQ scenarios.

## Brief Builder And Logging Checkpoint

- [ ] Create `build-surface-brief.ts` as a pure helper.
- [ ] Include the post URL in the brief.
- [ ] Include the subreddit topic in the brief.
- [ ] Include the username if available.
- [ ] Include `whyFit`.
- [ ] Include `needs`.
- [ ] Include `timing` and `contactInfo` only when present.
- [ ] Keep the format deterministic so the same input always produces the same brief.
- [ ] If the dOrg API has a size limit for the brief, enforce the limit in one place here.
- [ ] Use structured log messages with keys like `postId`, `url`, `status`, `stage`, `apifyRunId`, `requestId`, and `workerRunId`.
- [ ] Never log secrets, raw bearer tokens, or full environment dumps.
- [ ] Add unit tests for brief formatting and any truncation logic.

## Testing Checkpoint

- [ ] Create `test/fixtures/apify/webhook` with sample webhook payloads for succeeded and failed runs.
- [ ] Create `test/fixtures/apify/dataset` with sample crawler dataset items.
- [ ] Create unit tests for environment parsing.
- [ ] Create unit tests for trigger request validation.
- [ ] Create unit tests for trigger response validation.
- [ ] Create unit tests for Apify webhook validation.
- [ ] Create unit tests for Apify dataset validation.
- [ ] Create unit tests for queue payload validation.
- [ ] Create unit tests for dead-letter payload validation.
- [ ] Create unit tests for the AI input mapper.
- [ ] Create unit tests for the surface brief builder.
- [ ] Create unit tests for the dOrg API client result parsing.
- [ ] Create unit tests for duplicate URL detection logic.
- [ ] Create unit tests for run-level import lock logic.
- [ ] Create integration tests for repository insert and update behavior.
- [ ] Create integration tests for the trigger endpoint use case using a fake Apify client.
- [ ] Create integration tests for the webhook import use case using fake Apify, Redis, and repository layers.
- [ ] Create integration tests for the worker processing flow using fake GTM AI and fake dOrg clients.
- [ ] Make sure tests never call the real Apify API, the real GTM AI service, or the real dOrg API.
- [ ] Make sure at least one test covers a duplicate webhook delivery after a successful import.
- [ ] Make sure at least one test covers a webhook retry after a partial import failure.
- [ ] Make sure at least one test covers a queue message whose database row is missing.
- [ ] Make sure at least one test covers a worker retry where `dorgLeadId` is already saved.
- [ ] Verification step: run `bun test`.

## Documentation And Operations Checkpoint

- [ ] Update `gtm-workers/README.md` so it explains the architecture in plain language.
- [ ] Document the two runtimes clearly: `bun run api` and `bun run worker`.
- [ ] Document the three important HTTP routes: `GET /healthz`, `POST /internal/crawl-runs`, and `POST /webhooks/apify/run-finished`.
- [ ] Document every required environment variable.
- [ ] Document local setup using the root `docker-compose.yml`.
- [ ] Document how to run migrations locally.
- [ ] Document that the external scheduler should call the internal trigger endpoint, not the Apify API directly.
- [ ] Document that the trigger endpoint starts the actor asynchronously and returns immediately.
- [ ] Document that the webhook endpoint must be reachable from Apify over the public internet.
- [ ] Document that the worker expects the `gtm-ai` service to be reachable at `GTM_AI_BASE_URL`.
- [ ] Document where dead-letter messages go and how to inspect or replay them.
- [ ] Add a `Dockerfile` for `gtm-workers`.
- [ ] Decide whether the root `docker-compose.yml` should gain separate `gtm-workers-api` and `gtm-workers-worker` services.
- [ ] Recommended compose behavior: run the API server and the worker as separate services so the scheduler and Apify can reach the API even if the worker is being restarted.

## Final Acceptance Checklist

- [ ] `bun run typecheck` passes.
- [ ] `bun run build` passes.
- [ ] `bun test` passes.
- [ ] No source file imports a module that does not exist.
- [ ] The API server exposes a health route, a trigger route, and an Apify webhook route.
- [ ] The trigger endpoint starts the Apify actor and returns immediately without waiting for completion.
- [ ] The webhook endpoint can import crawler items into Postgres and enqueue them.
- [ ] Duplicate URLs are skipped.
- [ ] Duplicate webhook deliveries are safe.
- [ ] Webhook retries after partial failure are safe.
- [ ] The worker can consume a queue message and update the database correctly.
- [ ] Posts below the lead threshold stop before the expensive analysis workflow.
- [ ] Posts that are not leads stop before the dOrg API.
- [ ] Claim failures are recorded without sending the item to the dead-letter queue.
- [ ] Unexpected failures are recorded and added to the dead-letter queue.
- [ ] A retry after a partial failure does not create a second claimed lead when `dorgLeadId` is already saved.
- [ ] The README and `.env.example` match the real code.
