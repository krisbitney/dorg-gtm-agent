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

- [x] Build a real `gtm-workers` service with two runtimes:
- [x] an HTTP API process that exposes two endpoints:
- [x] one internal endpoint that starts the Apify actor run
- [x] one webhook endpoint that Apify calls when the run finishes
- [x] a long-running queue worker that reads posts from Redis and performs the AI plus dOrg flow
- [x] Create `bun run api` as the Bun HTTP server.
- [x] Create `bun run worker` as the long-running consumer.
- [x] Make the trigger endpoint, webhook import flow, and worker idempotent enough that retries do not create duplicate posts or duplicate lead claims.
- [x] Keep all service boundaries clean. `gtm-workers` must talk to `gtm-ai` through a client interface and to `gtm-web-crawler` through Apify. Do not import service internals from either project.
- [x] Keep the implementation Bun-first: `bun run`, `bun test`, Bun SQL, Bun Redis, and `Bun.serve()`.

## Runtime Shape To Keep In Your Head

- [x] The external scheduler does not run the crawler directly. It calls an internal HTTP endpoint on `gtm-workers`.
- [x] The internal trigger endpoint starts the Apify actor asynchronously and returns immediately with the Apify run ID.
- [x] The trigger endpoint configures an Apify webhook for the started run.
- [x] When the actor reaches a terminal state, Apify calls the `gtm-workers` webhook endpoint.
- [x] The webhook endpoint fetches the dataset from Apify, deduplicates posts by URL, inserts pending rows into Postgres, and enqueues Redis payloads.
- [x] The worker reads the queue, calls `gtm-ai`, updates the database, claims the lead in dOrg, and surfaces the lead.
- [x] If the webhook is retried by Apify, the import flow must be safe to run again.
- [x] If the worker crashes and restarts, queue handling must not lose messages.

## Current Repo Reality

- [x] Understand that `gtm-workers/src/index.ts` currently only prints `"Hello via Bun!"`.
- [x] Understand that `gtm-workers/package.json` currently does not declare the dependencies or scripts needed for a real service.
- [x] Understand that `src/storage/drizzle-post-repository.ts`, `src/storage/redis-processed-url-store.ts`, and `src/storage/redis-queue-publisher.ts` currently import `../services/interfaces.js`, `../domain/post.js`, and `../config/appConfig.js`, but those files do not exist.
- [x] Understand that the current `posts` table shape is missing AI result fields, dOrg fields, crawl-run tracking, webhook retry support, and better status coverage.
- [x] Understand that the current `docker-compose.yml` runs plain `valkey/valkey` and does not configure RedisBloom. Because of that, you must explicitly decide how v1 deduplication works before coding.

## Non-Negotiable Rules

- [x] Centralize environment parsing in one `zod` config module. Do not read `process.env` all over the codebase.
- [x] Validate all external JSON at the boundary: trigger requests, Apify webhook requests, Apify dataset items, Redis queue messages, GTM AI responses, and dOrg API responses.
- [x] Use named types and schemas instead of `any`.
- [x] Keep functions short and single-purpose.
- [x] Use one export per file.
- [x] Use composition and small use-case functions instead of deep inheritance or giant god-classes.
- [x] Do not wait for the Apify run to finish inside the trigger endpoint. Start the run and return immediately.
- [x] Do not expose the trigger endpoint without authentication.
- [x] Do not accept webhook requests without validating a shared secret or other explicit authentication mechanism.
- [x] The webhook handler must be safe to run more than once for the same Apify run.
- [x] Return `5xx` from the webhook handler for transient import failures so Apify can retry the webhook.
- [x] Do not use a queue pattern that loses a message if the worker crashes after reserving it.
- [x] Do not permanently mark a URL as processed until the database insert and queue publish have both succeeded.
- [x] Do not deduplicate on post content. Deduplicate only on the canonical Reddit post URL, as required by `high_level_design.md`.

## Contracts You Must Freeze Before Coding

### Crawler Output Contract

- [x] Freeze the crawler dataset item shape that the webhook import flow will accept from Apify.
- [x] Base that shape on the current crawler output in `gtm-web-crawler/src/domain/post.ts` and `gtm-web-crawler/src/routes.ts`.
- [x] Validate this input with a schema such as `src/schemas/apify-reddit-post-schema.ts`.
- [x] Treat these fields as the minimum v1 contract: `url`, `username`, `content`, `postedAt`, `nLikes`, `nComments`, and `topic`.
- [x] Record in code comments and tests that `postedAt` is currently a Unix timestamp in milliseconds.
- [x] Treat `url` from the crawler as the canonical dedupe key. The crawler already canonicalizes post URLs before pushing to the dataset.

### Trigger Endpoint Contract

- [x] Freeze the trigger route path early. Recommended v1 path: `POST /internal/crawl-runs`.
- [x] Protect the route with a static token or bearer token. Recommended env var: `TRIGGER_API_TOKEN`.
- [x] Keep the request body intentionally small.
- [x] Recommended v1 request shape: either an empty JSON object or `{ source: "scheduler" | "manual" }`.
- [x] Return `202 Accepted` on success because the run starts asynchronously and the import work will happen later.
- [x] Recommended v1 response shape:

```json
{
  "apifyRunId": "string",
  "actorId": "string",
  "status": "READY|RUNNING",
  "webhookUrl": "string"
}
```

- [x] Do not put dataset import logic in this endpoint.
- [x] Do not put queue write logic in this endpoint.

### Apify Webhook Contract

- [x] Freeze the webhook route path early. Recommended v1 path: `POST /webhooks/apify/run-finished`.
- [x] Protect the route with a shared secret. Recommended env var: `APIFY_WEBHOOK_SECRET`.
- [x] Decide whether to use Apify's default webhook payload or a custom `payloadTemplate`.
- [x] Recommended v1 approach: use an ad hoc webhook with a small custom payload that contains only the fields the webhook handler needs.
- [x] Keep the webhook payload machine-friendly and stable.
- [x] Recommended minimum webhook payload fields:
- [x] `eventType`
- [x] `actorId`
- [x] `apifyRunId`
- [x] `status`
- [x] `defaultDatasetId` if available
- [x] `finishedAt`
- [x] Before coding the payload parser, verify the exact payload field names against the real Apify webhook behavior or the official webhook docs.
- [x] Validate the webhook body with a local schema such as `src/schemas/apify-run-webhook-schema.ts`.
- [x] If the webhook payload does not include `defaultDatasetId`, fetch the run details from Apify by `apifyRunId` before importing.
- [x] Return `200` for successful imports and safe duplicate no-ops.
- [x] Return `4xx` for invalid authentication or invalid payloads.
- [x] Return `5xx` for transient import failures so Apify can retry safely.

### GTM AI Contract

- [x] Freeze the worker-to-AI input to match the current `gtm-ai` schema: `id`, `platform`, `topic`, `url`, `username`, `content`, `ageText`, `likes`, `nComments`, and `capturedAt`.
- [x] Do not invent `ageText`. Until the crawler produces that field, pass `null`.
- [x] Freeze the score response shape as exactly `{ leadProbability: number }`.
- [x] Freeze the analysis response shape as either `{ isLead: false }` or `{ isLead: true, whyFit, needs, timing, contactInfo }`.
- [x] Freeze the lead-score threshold as a single constant inside `gtm-workers`. Recommended value: `0.7`.

### Queue Contract

- [x] Freeze the main queue payload as exactly `{ id: string; platform: "reddit" }`.
- [x] Freeze the dead-letter queue payload as a different schema that includes `id`, `platform`, `stage`, `errorMessage`, `failedAt`, and `originalPayload`.
- [x] Keep queue messages intentionally small. Do not push the full post body into Redis.

### dOrg API Contract

- [x] Freeze `claimLead` to send `{ identifier: post.url, channel: "reddit" }` unless the dOrg API owner confirms a different identifier.
- [x] Freeze `surfaceLead` to send `{ lead_id, brief }`.
- [x] Keep `sendMessage` out of scope for v1 because it is not part of the high-level workers flow.

## Recommended Target File Layout

- [x] `src/config/app-env.ts`
- [x] `src/constants/route-paths.ts`
- [x] `src/constants/lead-score-threshold.ts`
- [x] `src/constants/post-status.ts`
- [x] `src/constants/crawl-run-status.ts`
- [x] `src/constants/queue-names.ts`
- [x] `src/schemas/trigger-crawl-request-schema.ts`
- [x] `src/schemas/trigger-crawl-response-schema.ts`
- [x] `src/schemas/apify-run-webhook-schema.ts`
- [x] `src/schemas/apify-reddit-post-schema.ts`
- [x] `src/schemas/queue-payload-schema.ts`
- [x] `src/schemas/dead-letter-payload-schema.ts`
- [x] `src/schemas/dorg-claim-response-schema.ts`
- [x] `src/schemas/dorg-surface-response-schema.ts`
- [x] `src/domain/post-platform.ts`
- [x] `src/domain/post-status.ts`
- [x] `src/domain/crawl-run-status.ts`
- [x] `src/domain/post-record.ts`
- [x] `src/domain/crawl-run-record.ts`
- [x] `src/domain/dead-letter-stage.ts`
- [x] `src/storage/database.ts`
- [x] `src/storage/schema/posts-table.ts`
- [x] `src/storage/schema/crawl-runs-table.ts`
- [x] `src/storage/repositories/post-repository.ts`
- [x] `src/storage/repositories/crawl-run-repository.ts`
- [x] `src/storage/processed-url-store.ts`
- [x] `src/storage/lead-queue.ts`
- [x] `src/clients/apify-crawler-client.ts`
- [x] `src/clients/gtm-ai-client.ts`
- [x] `src/clients/dorg-api-client.ts`
- [x] `src/http/create-server.ts`
- [x] `src/http/handle-health-request.ts`
- [x] `src/http/handle-trigger-crawl-request.ts`
- [x] `src/http/handle-apify-webhook-request.ts`
- [x] `src/use-cases/start-apify-crawl-run.ts`
- [x] `src/use-cases/import-apify-run-dataset.ts`
- [x] `src/use-cases/process-post-job.ts`
- [x] `src/use-cases/process-queue-loop.ts`
- [x] `src/worker/build-surface-brief.ts`
- [x] `src/worker/mark-post-error.ts`
- [x] `src/bin/api.ts`
- [x] `src/bin/worker.ts`
- [x] `drizzle.config.ts`
- [x] `.env.example`
- [x] `README.md`
- [x] `Dockerfile`
- [x] `test/fixtures/apify/webhook/*.json`
- [x] `test/fixtures/apify/dataset/*.json`
- [x] `test/unit/**/*.test.ts`
- [x] `test/integration/**/*.test.ts`

## Package And Scripts Checkpoint

- [x] Rewrite `gtm-workers/package.json` so it describes a real service.
- [x] Add a `build` script. Recommended command: `bun build src/bin/api.ts src/bin/worker.ts --outdir dist --target bun --packages external`.
- [x] Add a `typecheck` script. Recommended command: `bunx tsc --noEmit`.
- [x] Add an `api` script. Recommended command: `bun run src/bin/api.ts`.
- [x] Add a `worker` script. Recommended command: `bun run src/bin/worker.ts`.
- [x] Add a `test` script. Recommended command: `bun test`.
- [x] Add `db:generate` and `db:migrate` scripts using `bunx drizzle-kit`.
- [x] Add runtime dependencies for the actual service. At minimum this should include `zod`, `drizzle-orm`, `apify-client`, and a UUIDv7 package.
- [x] Add dev dependencies for schema generation and local development. At minimum this should include `drizzle-kit`.
- [x] Decide whether to add a logging library. Recommended v1: keep structured `console` logging to reduce moving parts.
- [x] Remove or rewrite any existing source file that still imports modules that do not exist.
- [x] Add `.env.example` because `gtm-workers` currently only has a local `.env` file.
- [x] Verification step: run `bun install`.
- [x] Verification step: run `bun run typecheck`.

## Configuration Checkpoint

- [x] Create `src/config/app-env.ts` and validate every environment variable with `zod`.
- [x] Parse `WORKERS_API_HOST`.
- [x] Parse `WORKERS_API_PORT`.
- [x] Parse `WORKERS_PUBLIC_BASE_URL` because Apify needs a public webhook URL to call.
- [x] Parse `TRIGGER_API_TOKEN`.
- [x] Parse `APIFY_WEBHOOK_SECRET`.
- [x] Parse `DATABASE_URL`.
- [x] Parse `REDIS_URL`.
- [x] Parse `DORG_API_TOKEN`.
- [x] Parse `DORG_API_BASE_URL` with a default of `https://agentsofdorg.tech/api`.
- [x] Parse `APIFY_TOKEN`.
- [x] Parse `APIFY_ACTOR_ID`.
- [x] Parse `APIFY_RUN_TIMEOUT_SECONDS` if you want a hard cap on actor runs.
- [x] Parse `GTM_AI_BASE_URL`.
- [x] Parse `GTM_AI_REQUEST_TIMEOUT_MS` with a safe default.
- [x] Parse `LEAD_SCORE_THRESHOLD` with a default of `0.7`.
- [x] Parse `QUEUE_NAME`, `QUEUE_PROCESSING_NAME`, and `QUEUE_DLQ_NAME` with stable defaults.
- [x] Parse `PROCESSED_URLS_KEY` with a stable default.
- [x] Parse `WORKER_POLL_TIMEOUT_SECONDS` with a stable default for blocking Redis operations.
- [x] Parse `WORKER_REQUEUE_STALE_ON_STARTUP` if you want startup recovery to be configurable.
- [x] Parse numbers with `z.coerce.number()` so string env vars become numbers safely.
- [x] Export one validated `appEnv` object and use it everywhere.
- [x] Update `.env.example` so it matches the real code exactly.
- [x] Verification step: add unit tests for valid env parsing, missing required vars, and invalid number parsing.
- [x] Verification step: run `bun run typecheck`.
- [x] Verification step: run `bun test`.

## HTTP Server Checkpoint

- [x] Build one Bun HTTP server with `Bun.serve()`.
- [x] Create a health route. Recommended path: `GET /healthz`.
- [x] Create the internal trigger route. Recommended path: `POST /internal/crawl-runs`.
- [x] Create the Apify webhook route. Recommended path: `POST /webhooks/apify/run-finished`.
- [x] Reject unsupported methods with `405`.
- [x] Reject unknown routes with `404`.
- [x] Parse JSON request bodies safely and return `400` for invalid JSON.
- [x] Keep HTTP handlers thin. Route handlers should validate input, call one use case, and build the response.
- [x] Do not put business logic directly inside the `fetch()` route switch.
- [x] Add integration tests for route matching, auth failures, bad JSON, and happy-path requests.

## Domain And Status Checkpoint

- [x] Create a `PostPlatform` type and freeze it to `"reddit"` for v1.
- [x] Create a `PostStatus` type or constant list and freeze the exact status names before building repositories or worker logic.
- [x] Recommended post status list:

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

- [x] Create a `CrawlRunStatus` type or constant list for the API plus webhook flow.
- [x] Recommended crawl run status list:

```text
started
webhook_received
importing
completed
failed
```

- [x] Freeze the allowed post status transitions and document them in tests.
- [x] Recommended high-level post transitions:

```text
pending -> scoring -> below_threshold
pending -> scoring -> analyzing -> not_a_lead
pending -> scoring -> analyzing -> claiming -> claim_failed
pending -> scoring -> analyzing -> claiming -> surfacing -> completed
any non-terminal stage -> error
```

- [x] Freeze the allowed crawl run status transitions and document them in tests.
- [x] Recommended high-level crawl run transitions:

```text
started -> webhook_received -> importing -> completed
started -> webhook_received -> failed
importing -> failed
```

- [x] Create a small `workerRunId` helper so each worker process can stamp logs and AI request context consistently.
- [x] Create a small `httpRequestId` helper so the trigger and webhook handlers can correlate logs.
- [x] Create a mapper that converts a database post row into the exact GTM AI input shape.
- [x] Create a mapper that converts an Apify dataset item into a database insert shape.
- [x] Create a mapper that converts the webhook payload into one normalized internal `ApifyRunNotification` type.
- [x] Verification step: add unit tests for all mappers and status transition helpers.
- [x] Verification step: run `bun test`.

## Database Checkpoint

- [x] Replace the current `posts` schema with a shape that supports the full workflow.
- [x] Keep `id` as the primary key and make it UUIDv7.
- [x] Keep `url` unique because it is the real dedupe key.
- [x] Keep `platform`, `topic`, `username`, `content`, `postedAt`, `likes`, and `nComments`.
- [x] Add `capturedAt` so the worker can pass a real `capturedAt` value to GTM AI.
- [x] Add `status`.
- [x] Add `leadProbability`.
- [x] Add `whyFit`.
- [x] Add `needs`.
- [x] Add `timing`.
- [x] Add `contactInfo`.
- [x] Add `dorgLeadId`.
- [x] Add `errorMessage`.
- [x] Add `apifyRunId` so imported posts can be traced back to a crawl.
- [x] Add `apifyDatasetId` so imported posts can be traced back to a dataset.
- [x] Keep `createdAt` and `updatedAt`.
- [x] Use timestamp columns in UTC and be explicit about timezone handling.
- [x] Add an index on `status` because the worker and debugging tools will query by status frequently.

- [x] Add a new `crawl_runs` table because the trigger endpoint and webhook endpoint are now separated in time.
- [x] Keep `apifyRunId` unique in `crawl_runs`.
- [x] Store `actorId`.
- [x] Store `status`.
- [x] Store `defaultDatasetId` if known.
- [x] Store `requestedBy` or `source` if you want to distinguish scheduler vs manual runs.
- [x] Store `errorMessage`.
- [x] Store `startedAt`, `webhookReceivedAt`, `importStartedAt`, `completedAt`, and `updatedAt`.
- [x] Optional but recommended: store counters such as `itemsRead`, `itemsImported`, `duplicatesSkipped`, `invalidItems`, and `failedItems`.
- [x] The webhook handler must be able to upsert a crawl run by `apifyRunId`. Do not assume the trigger endpoint insert always succeeded.
- [x] Create `drizzle.config.ts`.
- [x] Generate the first migration for `gtm-workers`.
- [x] Create repository modules with business-oriented methods instead of raw SQL spread across the app.
- [x] Add a post repository method to insert a new pending post.
- [x] Add a post repository method to fetch a post by ID.
- [x] Add a post repository method to save the lead score result and advance status.
- [x] Add a post repository method to save the lead analysis result and advance status.
- [x] Add a post repository method to save the claimed dOrg lead ID.
- [x] Add a post repository method to mark claim failure.
- [x] Add a post repository method to mark completion.
- [x] Add a post repository method to mark unexpected errors.
- [x] Add a crawl-run repository method to create or upsert a started run.
- [x] Add a crawl-run repository method to mark webhook received.
- [x] Add a crawl-run repository method to mark importing.
- [x] Add a crawl-run repository method to mark completed with counters.
- [x] Add a crawl-run repository method to mark failed with an error message.
- [x] Make every repository write update `updatedAt`.
- [x] Verification step: add tests for migration generation, inserts, updates, and unique URL plus unique run behavior.
- [x] Verification step: run `bun run typecheck`.
- [x] Verification step: run `bun test`.

## Deduplication Checkpoint

- [x] Create a `ProcessedUrlStore` interface so the webhook import flow does not care how deduplication is implemented.
- [x] Decide the v1 implementation now.
- [x] Recommended v1 implementation: use a Redis `SET` because the current local stack does not provide RedisBloom.
- [x] Keep the interface generic so you can add a real RedisBloom-backed implementation later without changing the webhook import logic.
- [x] If you want extra safety against two webhook deliveries importing the same run at the same time, add a temporary run-level claim key such as `import-run:<apifyRunId>`.
- [x] If you want extra safety against duplicate URL imports inside the same time window, add a temporary URL claim key with TTL before writing to the database.
- [x] If you use temporary URL claims, acquire the claim first, then insert into the database, then publish to the queue, then permanently mark the URL as processed, then release the temporary claim.
- [x] Do not permanently mark the URL as processed before queue publish succeeds. If you do that and publishing fails, the post is lost forever.
- [x] Treat a database unique-constraint failure on `url` as a duplicate, not as a fatal crash.
- [x] Add unit tests for duplicate URL detection, run-level import locking, and temporary claim behavior.

## Queue Checkpoint

- [x] Create a `LeadQueue` abstraction with methods like `enqueue`, `reserveNext`, `ack`, `moveToDeadLetter`, and `requeueProcessing`.
- [x] Use Redis lists for v1 because the high-level design only requires a Redis-based queue and lists are simple to implement.
- [x] Use three lists: main queue, processing queue, and dead-letter queue.
- [x] Recommended reserve pattern: atomically move an item from the main queue to the processing queue using a blocking Redis operation.
- [x] Recommended acknowledge pattern: after successful processing, remove the exact raw message from the processing queue.
- [x] On unexpected failure, push a dead-letter payload to the dead-letter queue and then remove the raw message from the processing queue.
- [x] On startup, decide how to recover items stranded in the processing queue after a crash.
- [x] Recommended startup recovery for v1: move all processing items back to the main queue before starting the loop.
- [x] Validate every Redis message with `QueuePayloadSchema` or `DeadLetterPayloadSchema` before acting on it.
- [x] Add tests for enqueue, reserve, acknowledge, dead-lettering, and startup requeue behavior.
- [x] Verification step: run `bun test`.

## Apify Client Checkpoint

- [x] Create an `ApifyCrawlerClient` interface so the trigger endpoint and webhook import use case do not depend on the raw SDK everywhere.
- [x] Implement it with the official `apify-client` package.
- [x] The trigger endpoint must use `actor(APIFY_ACTOR_ID).start(...)`, not `call(...)`, because the endpoint should not wait for the run to finish.
- [x] Configure ad hoc webhooks when starting the run.
- [x] Recommended event coverage: `ACTOR.RUN.SUCCEEDED`, `ACTOR.RUN.FAILED`, `ACTOR.RUN.ABORTED`, and `ACTOR.RUN.TIMED-OUT`.
- [x] Make the webhook request URL point to the public webhook endpoint on `gtm-workers`.
- [x] Send the webhook secret as a custom header or another explicit authenticated field. Do not rely on obscurity alone.
- [x] If you use a custom payload template, verify the exact Apify interpolation syntax against the official docs before committing the implementation.
- [x] Create a method to fetch run details by `apifyRunId`.
- [x] Create a method to fetch dataset items page by page by dataset ID.
- [x] Do not assume the dataset always fits in one response.
- [x] Validate every fetched item with the Apify post schema before importing it.
- [x] Log enough context to debug invalid items without dumping secrets.
- [x] Add unit tests using a fake Apify client so tests never hit the real network.

## Trigger Endpoint Flow Checkpoint

- [x] Implement `startApifyCrawlRun` as the main use case behind `POST /internal/crawl-runs`.
- [x] Authenticate the caller before doing any work.
- [x] Validate the request body with `TriggerCrawlRequestSchema`.
- [x] Build the public webhook URL from `WORKERS_PUBLIC_BASE_URL` plus the fixed webhook path.
- [x] Build the ad hoc webhook configuration for Apify.
- [x] Start the actor asynchronously with `start()`.
- [x] Capture the returned `apifyRunId`, `actorId`, `status`, and `defaultDatasetId` if Apify returns it immediately.
- [x] Create or upsert a `crawl_runs` row for the started run.
- [x] Return `202 Accepted` with the run metadata.
- [x] Do not fetch dataset items here.
- [x] Do not write to the Redis post queue here.
- [x] If the actor starts successfully but the local `crawl_runs` write fails, make sure the webhook flow can still recover later by upserting the run by `apifyRunId`.
- [x] Add integration tests for auth failure, bad request, happy path, and actor-start failure.

## Webhook Import Flow Checkpoint

- [x] Implement `importApifyRunDataset` as the main use case behind `POST /webhooks/apify/run-finished`.
- [x] Authenticate the webhook request before parsing or importing anything expensive.
- [x] Validate the request body with `ApifyRunWebhookSchema`.
- [x] Normalize the webhook payload into one internal notification type.
- [x] Upsert or create the `crawl_runs` row by `apifyRunId` if it does not already exist.
- [x] Mark the crawl run as `webhook_received`.
- [x] If the webhook says the run failed, timed out, or was aborted, mark the crawl run as `failed`, store the error message if available, return `200`, and do not attempt dataset import.
- [x] If the crawl run is already marked `completed`, return `200` as a safe no-op because duplicate webhook deliveries are expected.
- [x] If you use a run-level import lock and it is already held, return a success response that does not start a second concurrent import.
- [x] Resolve the dataset ID:
- [x] use `defaultDatasetId` from the webhook if present
- [x] otherwise fetch the run details from Apify by `apifyRunId`
- [x] Mark the crawl run as `importing`.
- [x] Fetch dataset items page by page.
- [x] For each dataset item, validate it.
- [x] For each valid item, optionally acquire a temporary URL claim to prevent concurrent double-imports.
- [x] Check whether the canonical URL was already processed.
- [x] If the URL is already processed, skip it and record a duplicate counter.
- [x] If the URL is new, generate a UUIDv7 post ID.
- [x] Insert the post into Postgres with status `pending`.
- [x] Publish `{ id, platform: "reddit" }` to the main queue.
- [x] Only after the insert and publish succeed, permanently mark the URL as processed.
- [x] If publishing fails after the row was inserted, mark the row as `error` and do not silently continue.
- [x] If the database insert fails because the URL already exists, treat it as a duplicate and do not enqueue again.
- [x] Release any temporary URL claim key in a `finally` block.
- [x] Keep summary counters for `itemsRead`, `itemsImported`, `duplicatesSkipped`, `invalidItems`, and `failedItems`.
- [x] On full success, mark the crawl run as `completed` with the counters and return `200`.
- [x] On transient failure, mark the crawl run as `failed`, store the error, and return `5xx` so Apify can retry the webhook safely.
- [x] Add integration tests for success, duplicate webhook retry, failed-run webhook, invalid item handling, partial import failure, and retry-after-partial-failure scenarios.

## GTM AI Client Checkpoint

- [x] Create a `GtmAiClient` interface with exactly two methods: `scorePost` and `analyzePost`.
- [x] Keep the concrete implementation isolated in one module so the rest of the worker does not care whether the transport is HTTP or an official client package.
- [x] Do not import `gtm-ai` source code directly. `gtm-workers` must treat AI as another service.
- [x] Build one pure mapper from a database post row to the AI input schema.
- [x] Always send `requestContext` with `postId`, `platform`, `topic`, `source: "worker"`, and `workerRunId`.
- [x] Validate the score response with a local schema before using it.
- [x] Validate the analysis response with a local schema before using it.
- [x] Decide how to time out slow AI calls and make that timeout configurable.
- [x] Add tests using a fake GTM AI client for score-below-threshold, not-a-lead, and lead cases.

## dOrg API Client Checkpoint

- [x] Rewrite the existing `src/dorg-api` scaffold into a proper client module with validated responses.
- [x] Create typed parameter objects for `claimLead` and `surfaceLead`.
- [x] Make `claimLead` return a typed success/failure result with a message that can be safely saved to the database.
- [x] Make `surfaceLead` return a typed success/failure result with a message.
- [x] Treat non-2xx responses as failures.
- [x] Treat unexpected response JSON shapes as failures.
- [x] Make timeout handling explicit and configurable.
- [x] Never log the bearer token.
- [x] Add tests for success, known business failure, non-2xx failure, and malformed JSON failure.

## Worker Processing Flow Checkpoint

- [x] Implement `processQueueLoop` as the main worker use case.
- [x] On startup, optionally requeue stranded items from the processing list back to the main queue.
- [x] Generate one `workerRunId` for the process and reuse it in logs and AI request context.
- [x] Reserve the next queue message from Redis using the safe queue abstraction.
- [x] Parse and validate the queue payload.
- [x] Load the post row from Postgres.
- [x] If the post row does not exist, create a dead-letter entry and acknowledge the raw queue message.
- [x] If the row is already in a terminal state like `below_threshold`, `not_a_lead`, `claim_failed`, or `completed`, acknowledge the message and skip it.
- [x] Set status to `scoring`.
- [x] Call the GTM AI score workflow.
- [x] Save `leadProbability`.
- [x] If `leadProbability < LEAD_SCORE_THRESHOLD`, set status to `below_threshold`, acknowledge the queue message, and stop processing this item.
- [x] Set status to `analyzing`.
- [x] Call the GTM AI analysis workflow.
- [x] If the analysis result is `{ isLead: false }`, set status to `not_a_lead`, acknowledge the queue message, and stop processing this item.
- [x] If the analysis result is a lead, save `whyFit`, `needs`, `timing`, and `contactInfo`.
- [x] Build a surface brief string in one dedicated helper function.
- [x] Set status to `claiming`.
- [x] Call `claimLead`.
- [x] If `claimLead` fails in an expected business way, set status to `claim_failed`, save the message, acknowledge the queue message, and stop processing this item.
- [x] If `claimLead` succeeds, save `dorgLeadId` immediately before calling `surfaceLead`.
- [x] Set status to `surfacing`.
- [x] Call `surfaceLead`.
- [x] If `surfaceLead` succeeds, set status to `completed` and acknowledge the queue message.
- [x] If an unexpected error happens at any stage, set status to `error`, save the error message, write a dead-letter payload, and acknowledge or release the raw queue message safely through the queue abstraction.
- [x] Decide how retries should behave if the worker crashes after `claimLead` succeeds but before `surfaceLead` succeeds.
- [x] Recommended v1 behavior: if `dorgLeadId` is already present on the row, skip `claimLead` on retry and continue with `surfaceLead`.
- [x] Add integration tests for below-threshold, not-a-lead, claim-failed, happy-path lead completion, and unexpected-error-to-DLQ scenarios.

## Brief Builder And Logging Checkpoint

- [x] Create `build-surface-brief.ts` as a pure helper.
- [x] Include the post URL in the brief.
- [x] Include the subreddit topic in the brief.
- [x] Include the username if available.
- [x] Include `whyFit`.
- [x] Include `needs`.
- [x] Include `timing` and `contactInfo` only when present.
- [x] Keep the format deterministic so the same input always produces the same brief.
- [x] If the dOrg API has a size limit for the brief, enforce the limit in one place here.
- [x] Use structured log messages with keys like `postId`, `url`, `status`, `stage`, `apifyRunId`, `requestId`, and `workerRunId`.
- [x] Never log secrets, raw bearer tokens, or full environment dumps.
- [x] Add unit tests for brief formatting and any truncation logic.

## Testing Checkpoint

- [x] Create `test/fixtures/apify/webhook` with sample webhook payloads for succeeded and failed runs.
- [x] Create `test/fixtures/apify/dataset` with sample crawler dataset items.
- [x] Create unit tests for environment parsing.
- [x] Create unit tests for trigger request validation.
- [x] Create unit tests for trigger response validation.
- [x] Create unit tests for Apify webhook validation.
- [x] Create unit tests for Apify dataset validation.
- [x] Create unit tests for queue payload validation.
- [x] Create unit tests for dead-letter payload validation.
- [x] Create unit tests for the AI input mapper.
- [x] Create unit tests for the surface brief builder.
- [x] Create unit tests for the dOrg API client result parsing.
- [x] Create unit tests for duplicate URL detection logic.
- [x] Create unit tests for run-level import lock logic.
- [x] Create integration tests for repository insert and update behavior.
- [x] Create integration tests for the trigger endpoint use case using a fake Apify client.
- [x] Create integration tests for the webhook import use case using fake Apify, Redis, and repository layers.
- [x] Create integration tests for the worker processing flow using fake GTM AI and fake dOrg clients.
- [x] Make sure tests never call the real Apify API, the real GTM AI service, or the real dOrg API.
- [x] Make sure at least one test covers a duplicate webhook delivery after a successful import.
- [x] Make sure at least one test covers a webhook retry after a partial import failure.
- [x] Make sure at least one test covers a queue message whose database row is missing.
- [x] Make sure at least one test covers a worker retry where `dorgLeadId` is already saved.
- [x] Verification step: run `bun test`.

## Documentation And Operations Checkpoint

- [x] Update `gtm-workers/README.md` so it explains the architecture in plain language.
- [x] Document the two runtimes clearly: `bun run api` and `bun run worker`.
- [x] Document the three important HTTP routes: `GET /healthz`, `POST /internal/crawl-runs`, and `POST /webhooks/apify/run-finished`.
- [x] Document every required environment variable.
- [x] Document local setup using the root `docker-compose.yml`.
- [x] Document how to run migrations locally.
- [x] Document that the external scheduler should call the internal trigger endpoint, not the Apify API directly.
- [x] Document that the trigger endpoint starts the actor asynchronously and returns immediately.
- [x] Document that the webhook endpoint must be reachable from Apify over the public internet.
- [x] Document that the worker expects the `gtm-ai` service to be reachable at `GTM_AI_BASE_URL`.
- [x] Document where dead-letter messages go and how to inspect or replay them.
- [x] Add a `Dockerfile` for `gtm-workers`.
- [x] Decide whether the root `docker-compose.yml` should gain separate `gtm-workers-api` and `gtm-workers-worker` services.
- [x] Recommended compose behavior: run the API server and the worker as separate services so the scheduler and Apify can reach the API even if the worker is being restarted.

## Final Acceptance Checklist

- [x] `bun run typecheck` passes.
- [x] `bun run build` passes.
- [x] `bun test` passes.
- [x] No source file imports a module that does not exist.
- [x] The API server exposes a health route, a trigger route, and an Apify webhook route.
- [x] The trigger endpoint starts the Apify actor and returns immediately without waiting for completion.
- [x] The webhook endpoint can import crawler items into Postgres and enqueue them.
- [x] Duplicate URLs are skipped.
- [x] Duplicate webhook deliveries are safe.
- [x] Webhook retries after partial failure are safe.
- [x] The worker can consume a queue message and update the database correctly.
- [x] Posts below the lead threshold stop before the expensive analysis workflow.
- [x] Posts that are not leads stop before the dOrg API.
- [x] Claim failures are recorded without sending the item to the dead-letter queue.
- [x] Unexpected failures are recorded and added to the dead-letter queue.
- [x] A retry after a partial failure does not create a second claimed lead when `dorgLeadId` is already saved.
- [x] The README and `.env.example` match the real code.
