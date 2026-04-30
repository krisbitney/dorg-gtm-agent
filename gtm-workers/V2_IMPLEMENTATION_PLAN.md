# GTM Workers V2 Implementation Plan

This plan covers the `gtm-workers` implementation for v2 of the lead generation AI system. Track progress by checking off each task as it is completed. If a task is split during implementation, add child checkboxes under that task instead of losing the original milestone.

The worker service should own orchestration, persistence, queues, provider clients, run state, manual control endpoints, and dOrg handoff. The `gtm-ai` service should own LLM workflows, prompt logic, and structured AI outputs.

Do not add any new dependency on `gtm-web-crawler`. Keep support for triggering Apify crawls and importing Apify datasets because existing workflows still need it.

## Success Criteria

- [ ] A human can manually trigger search, lead verification, deep research, message generation, Apify crawls, and Apify dataset imports through HTTP endpoints.
- [ ] A long-running run can loop safely until stop conditions are met, paused, stopped, or gracefully shut down.
- [ ] Search uses `serper.dev` through a replaceable search provider interface.
- [ ] Page scraping uses `context.dev` through a replaceable page scraper interface.
- [ ] URLs and generated search term objects are deduplicated with Redis-backed expiring sets.
- [ ] Search results are filtered before scraping, scraped pages are verified and scored, high-quality leads are enriched, and outreach messages can be generated.
- [ ] A future web or mobile app can monitor runs, update runtime configuration, view leads, filter by state, and trigger lead actions.
- [ ] Existing Apify crawl trigger and dataset import behavior remains supported and covered by tests.

## Phase 1: Confirm Boundaries And Contracts

- [ ] Review the current v1 flow in `src/bin/api.ts`, `src/bin/worker.ts`, `src/http/create-server.ts`, `src/use-cases/process-post-job.ts`, `src/use-cases/import-apify-run-dataset.ts`, `src/storage/repositories/post-repository.ts`, and `src/clients/gtm-ai-client.ts`.
- [ ] Document the v2 worker-owned responsibilities:
  - [ ] run creation and run state tracking;
  - [ ] search provider calls;
  - [ ] page scraper calls;
  - [ ] dedupe checks;
  - [ ] queue publishing and consumption;
  - [ ] database writes;
  - [ ] calls to GTM AI workflows;
  - [ ] calls to dOrg APIs;
  - [ ] HTTP API for human control and monitoring.
- [ ] Document the `gtm-ai` workflow names and request/response payloads that workers need:
  - [ ] search term generation;
  - [ ] search result lead prefiltering;
  - [ ] scraped page lead verification and scoring;
  - [ ] structured lead extraction;
  - [ ] deep research query planning;
  - [ ] deep research result verification and synthesis;
  - [ ] outreach message generation.
- [ ] Decide the first v2-compatible status model before changing code. Prefer adding new statuses to the existing lifecycle instead of replacing all v1 statuses at once.
- [ ] Keep the current post-processing path compatible with Apify-imported records while adding new web-search source records.

## Phase 2: Add Configuration Model

- [ ] Extend `src/config/app-env.ts` and `.env.example` with provider and runtime configuration:
  - [ ] `SERPER_API_KEY`;
  - [ ] `SERPER_BASE_URL`;
  - [ ] `CONTEXT_DEV_API_KEY`;
  - [ ] `CONTEXT_DEV_BASE_URL`;
  - [ ] default search result count per query;
  - [ ] default generated search term count;
  - [ ] default search result prefilter threshold;
  - [ ] default lead quality threshold;
  - [ ] default auto deep research threshold;
  - [ ] default auto message generation threshold;
  - [ ] default run duration limit;
  - [ ] default processed search result limit;
  - [ ] default generated lead limit;
  - [ ] Redis key prefixes for search term, URL, run queue, and dead letter data.
- [ ] Create a persisted agent configuration table so a human-controlled app can update runtime settings without redeploying:
  - [ ] enabled target sites, starting with `reddit`;
  - [ ] default start and end datetime window;
  - [ ] generated search term count;
  - [ ] search results per term;
  - [ ] lead prefilter prompt variables;
  - [ ] lead verification prompt variables;
  - [ ] lead quality threshold;
  - [ ] automatic deep research enabled;
  - [ ] automatic deep research threshold;
  - [ ] automatic message generation enabled;
  - [ ] automatic message generation threshold;
  - [ ] run stop limits.
- [ ] Add repository methods to read the active configuration at the start of a run and refresh runtime-editable fields during long-running loops.
- [ ] Add validation schemas for API request overrides. Reject invalid date windows, unknown sites, negative limits, and thresholds outside valid ranges.

## Phase 3: Extend Database Schema

- [ ] Add a `lead_runs` table for loop and manual run tracking:
  - [ ] UUIDv7 primary key;
  - [ ] run type: `search`, `deep_research`, `message_generation`, `apify_crawl`, `apify_import`;
  - [ ] status: `pending`, `running`, `pausing`, `paused`, `stopping`, `stopped`, `completed`, `failed`;
  - [ ] input parameters as JSONB;
  - [ ] effective configuration snapshot as JSONB;
  - [ ] counters for generated search terms, searched queries, processed search results, scraped pages, generated leads, researched leads, generated messages, and errors;
  - [ ] started, heartbeat, stopped, completed, and failed timestamps;
  - [ ] stop reason and error message.
- [ ] Add a `search_terms` table:
  - [ ] UUIDv7 primary key;
  - [ ] run id;
  - [ ] `search_query`;
  - [ ] `site`;
  - [ ] `start_date_time`;
  - [ ] `end_date_time`;
  - [ ] deterministic hash of the complete search term object;
  - [ ] status and error fields;
  - [ ] generated timestamp.
- [ ] Add a `search_results` table:
  - [ ] UUIDv7 primary key;
  - [ ] run id;
  - [ ] search term id;
  - [ ] provider name;
  - [ ] URL;
  - [ ] title;
  - [ ] snippet or description;
  - [ ] rank;
  - [ ] raw provider payload as JSONB;
  - [ ] prefilter decision and rationale;
  - [ ] status and error fields.
- [ ] Evolve the existing `posts` table or add a new `leads` table. Use one canonical lead table if possible, but avoid breaking Apify imports.
- [ ] Store the following lead fields:
  - [ ] source type: `serp`, `apify`, `manual`;
  - [ ] source URL;
  - [ ] platform or site;
  - [ ] scraped page content or normalized content JSON;
  - [ ] scrape provider and raw scrape metadata;
  - [ ] lead quality score from 0 to 100;
  - [ ] lead verification result and rationale;
  - [ ] structured lead details;
  - [ ] deep research report;
  - [ ] outreach message;
  - [ ] dOrg lead id;
  - [ ] processing status;
  - [ ] error message;
  - [ ] created and updated timestamps.
- [ ] Add indexes for run status, lead status, quality score, source URL, dOrg lead id, and created timestamp.
- [ ] Generate and commit Drizzle migrations after schemas are updated.
- [ ] Add repository tests for every new table and important state transition.

## Phase 4: Implement Redis Dedupe And Queues

- [ ] Replace the v1 URL-only processed store with a small reusable Redis dedupe service that supports named sets and expirations.
- [ ] Implement search term object hashing:
  - [ ] canonicalize the object as `{ searchQuery, site, startDateTime, endDateTime }`;
  - [ ] sort object keys before hashing;
  - [ ] hash with SHA-256;
  - [ ] include the site and datetime range in logs for debugging, but never use non-canonical strings for dedupe.
- [ ] Implement expiration based on the search term datetime range:
  - [ ] if `endDateTime` is in the future, expire after the end time plus a configured buffer;
  - [ ] if the range is historical, expire after a configured historical dedupe TTL;
  - [ ] enforce minimum and maximum TTLs.
- [ ] Add URL dedupe checks for search result URLs before scraping.
- [ ] Add separate Redis queues for:
  - [ ] search term execution;
  - [ ] search result prefiltering if done asynchronously;
  - [ ] page scraping;
  - [ ] lead verification and extraction;
  - [ ] deep research;
  - [ ] message generation;
  - [ ] dead letters.
- [ ] Keep the existing v1 lead queue behavior working for Apify-imported posts.
- [ ] Add idempotency tests for duplicate search terms, duplicate URLs, retries, worker restarts, and queue reprocessing.

## Phase 5: Add Replaceable Provider Interfaces

- [ ] Create a search provider interface in `src/clients` or a new `src/providers` directory:
  - [ ] method accepts `{ searchQuery, site, startDateTime, endDateTime, resultLimit }`;
  - [ ] method returns normalized search results with URL, title, snippet, rank, provider metadata, and raw payload;
  - [ ] implementation owns provider-specific conversion of site and datetime range into request parameters.
- [ ] Implement `SerperSearchProvider`:
  - [ ] map `site: "reddit"` to the provider query format needed for Reddit searches;
  - [ ] convert start and end datetimes to the provider's `tbs` or equivalent time-based search parameter;
  - [ ] support configurable result count;
  - [ ] handle rate limit, retryable, and non-retryable errors distinctly;
  - [ ] log provider request ids or useful metadata without logging secrets.
- [ ] Create a page scraper interface:
  - [ ] method accepts `{ url, preferredFormat, timeoutMs }`;
  - [ ] method returns normalized text, title, canonical URL, metadata, fetched timestamp, and raw provider payload.
- [ ] Implement `ContextDevPageScraper`:
  - [ ] scrape search result URLs selected by the prefilter;
  - [ ] normalize content into the shape expected by GTM AI;
  - [ ] handle scrape failures by updating the result and run state without crashing the whole run.
- [ ] Add provider contract tests using mocked responses for Serper and context.dev.
- [ ] Avoid leaking provider-specific request shapes outside concrete provider classes so alternatives can be swapped later.

## Phase 6: Extend GTM AI Client

- [ ] Replace `any` in `src/clients/gtm-ai-client.ts` with explicit request and response types.
- [ ] Add methods for the new workflows:
  - [ ] `generateSearchTerms`;
  - [ ] `prefilterSearchResult`;
  - [ ] `verifyAndScoreLead`;
  - [ ] `extractLeadDetails`;
  - [ ] `planDeepResearch`;
  - [ ] `verifyDeepResearchResult`;
  - [ ] `synthesizeDeepResearch`;
  - [ ] `generateOutreachMessage`.
- [ ] Keep `scorePost` and `analyzePost` while adapting them to the new 0-100 quality score flow if the AI contract changes.
- [ ] Preserve timeout, cancellation, and retry behavior for every new workflow call.
- [ ] Add unit tests that validate workflow names, input mapping, timeout behavior, retry behavior, and failure handling.

## Phase 7: Implement New Search Flow

- [ ] Add a use case such as `StartLeadSearchRun` to create a run from request parameters and active configuration.
- [ ] Validate the request includes or resolves:
  - [ ] target site, starting with `reddit`;
  - [ ] start datetime;
  - [ ] end datetime;
  - [ ] generated search term count;
  - [ ] search results per term;
  - [ ] stop conditions;
  - [ ] automatic deep research and message generation settings.
- [ ] Call GTM AI to generate search terms using the consultancy configuration and input parameters.
- [ ] Enforce worker-side invariants on every returned search term:
  - [ ] overwrite or validate `site` from request parameters;
  - [ ] overwrite or validate `startDateTime` from request parameters;
  - [ ] overwrite or validate `endDateTime` from request parameters;
  - [ ] reject malformed or empty `searchQuery` values.
- [ ] Hash each search term object and check the Redis dedupe set before inserting or queueing it.
- [ ] Insert accepted search terms into Postgres and enqueue them.
- [ ] Process each search term by calling the search provider manager.
- [ ] Persist normalized search results and raw provider payloads.
- [ ] Filter search result URLs with the Redis URL dedupe set.
- [ ] Call GTM AI to prefilter remaining search results using title and snippet only.
- [ ] Make the prefilter prompt variables configurable through persisted agent configuration.
- [ ] Scrape only likely lead results with context.dev.
- [ ] Insert scraped pages as lead candidates in Postgres.
- [ ] Add scraped URLs to the URL dedupe set only after successful insert, so failed DB writes can retry safely.
- [ ] Queue lead candidates for verification and extraction.

## Phase 8: Improve Existing Lead Processing Flow

- [ ] Update `ProcessPostJob` or introduce a v2 `ProcessLeadCandidateJob` that works for both Apify posts and context.dev scraped pages.
- [ ] For each scraped page or imported Apify item, call GTM AI to verify whether it is a lead and assign a quality score from 0 to 100.
- [ ] Make the verification prompt configurable with injected terms such as budget requirements.
- [ ] Persist the quality score, verification decision, and rationale.
- [ ] If quality score is below the configurable threshold, mark the candidate as below threshold and stop processing.
- [ ] For leads above the threshold, call GTM AI to extract structured useful information.
- [ ] Persist structured lead details, including:
  - [ ] fit rationale;
  - [ ] stated needs;
  - [ ] timing;
  - [ ] budget;
  - [ ] company or organization;
  - [ ] requester identity;
  - [ ] contact information;
  - [ ] source evidence.
- [ ] Claim the lead with the dOrg API only after structured extraction succeeds.
- [ ] Surface the lead with the dOrg API after claim succeeds.
- [ ] Keep claim and surface calls idempotent by checking existing `dorgLeadId` and terminal statuses.
- [ ] Continue to move unexpected failures to the dead letter queue and update database status to `error`.

## Phase 9: Implement Deep Research Flow

- [ ] Add a manual endpoint and queue job for deep research on an existing lead.
- [ ] Add optional automatic deep research after lead extraction when quality score is greater than or equal to the configured threshold.
- [ ] Call GTM AI to generate a limited set of deep research searches from base lead information.
- [ ] Enforce worker-side limits on:
  - [ ] number of generated searches;
  - [ ] search results per generated search;
  - [ ] total pages scraped;
  - [ ] total runtime.
- [ ] Ensure the deep research plan includes the source user profile when the main content is a social media post.
- [ ] Use the search provider interface for deep research searches, including anchors such as LinkedIn, public company databases, ZoomInfo-like public sites, company websites, social profiles, and relevant public profiles.
- [ ] Use context.dev to scrape selected deep research result URLs.
- [ ] Call GTM AI to verify each scraped result belongs to the correct entity before using it.
- [ ] Store rejected research results with the rejection reason for auditability.
- [ ] Call GTM AI to synthesize the verified findings into a deep research report.
- [ ] Update the lead record with:
  - [ ] contact information;
  - [ ] company size;
  - [ ] funding or budget signals;
  - [ ] business strategy;
  - [ ] products;
  - [ ] relevant people;
  - [ ] source citations;
  - [ ] confidence and unresolved questions.
- [ ] Update run counters and lead status when research completes, fails, or is skipped.

## Phase 10: Implement Outreach Message Generation

- [ ] Add a manual endpoint and queue job for outreach message generation on an existing lead.
- [ ] Add optional automatic message generation after lead extraction or deep research when quality score is greater than or equal to the configured threshold.
- [ ] Call GTM AI with all available lead information, including deep research when present.
- [ ] Persist:
  - [ ] generated message;
  - [ ] subject line if generated;
  - [ ] message strategy;
  - [ ] personalization notes;
  - [ ] warnings or missing information.
- [ ] Do not automatically send outreach unless a separate explicit send action exists.
- [ ] Add tests for manual generation, automatic generation, missing research data, and regeneration.

## Phase 11: Add HTTP API For Remote Control And CRM UI

- [ ] Extend route constants and HTTP handlers for:
  - [ ] `POST /internal/search-runs`;
  - [ ] `POST /internal/search-runs/:id/stop`;
  - [ ] `POST /internal/search-runs/:id/pause`;
  - [ ] `POST /internal/search-runs/:id/resume`;
  - [ ] `GET /internal/runs`;
  - [ ] `GET /internal/runs/:id`;
  - [ ] `GET /internal/leads`;
  - [ ] `GET /internal/leads/:id`;
  - [ ] `POST /internal/leads/:id/deep-research`;
  - [ ] `POST /internal/leads/:id/message`;
  - [ ] `GET /internal/config`;
  - [ ] `PUT /internal/config`;
  - [ ] existing Apify crawl trigger and webhook endpoints.
- [ ] Add filters for lead list endpoints:
  - [ ] status;
  - [ ] source type;
  - [ ] site or platform;
  - [ ] quality score range;
  - [ ] has deep research;
  - [ ] has generated message;
  - [ ] claimed or unclaimed;
  - [ ] created date range.
- [ ] Return pagination metadata from list endpoints.
- [ ] Protect all internal control endpoints with the existing token scheme or a clearly documented replacement.
- [ ] Design response payloads for web and mobile clients. Avoid exposing raw provider payloads by default.
- [ ] Add integration tests for endpoint validation, authorization, filtering, and state transitions.

## Phase 12: Implement Run Loop And Graceful Runtime Controls

- [ ] Add a run coordinator that can process work until one of the stop conditions is reached:
  - [ ] max runtime;
  - [ ] max search results processed;
  - [ ] max leads generated;
  - [ ] manual stop requested;
  - [ ] graceful shutdown signal received.
- [ ] Persist heartbeat and counters frequently enough for monitoring.
- [ ] Refresh runtime-editable configuration between work batches:
  - [ ] time window or `tbs` behavior;
  - [ ] automatic deep research enabled;
  - [ ] automatic message generation enabled;
  - [ ] thresholds;
  - [ ] stop conditions.
- [ ] On pause, stop claiming new work but finish or safely requeue the current unit.
- [ ] On stop, finish or safely requeue the current unit and mark the run stopped with a reason.
- [ ] On process shutdown, update the run state and avoid losing in-flight work.
- [ ] On startup, recover runs stuck in `running`, `pausing`, or `stopping` based on heartbeat age.
- [ ] Add tests that simulate SIGTERM, stale heartbeat recovery, pause, resume, stop, and stop limits.

## Phase 13: Preserve Apify Support

- [ ] Keep `POST /internal/crawl-runs` behavior for triggering Apify actors.
- [ ] Keep `POST /webhooks/apify/run-finished` behavior for importing finished datasets.
- [ ] Keep support for importing existing Apify datasets manually if it already exists or add a manual endpoint if missing.
- [ ] Normalize Apify-imported records into the same lead candidate processing path used by context.dev scraped pages.
- [ ] Keep URL dedupe behavior for Apify posts.
- [ ] Add regression tests proving Apify trigger, webhook import, duplicate URL handling, and v2 lead processing still work.

## Phase 14: Observability And Operations

- [ ] Add structured logs for each run id, lead id, search term id, search result id, provider request, and queue job.
- [ ] Add counters for:
  - [ ] search terms generated;
  - [ ] duplicate search terms skipped;
  - [ ] search results fetched;
  - [ ] duplicate URLs skipped;
  - [ ] prefilter accepted and rejected results;
  - [ ] pages scraped;
  - [ ] verified leads;
  - [ ] leads below threshold;
  - [ ] deep research runs;
  - [ ] generated messages;
  - [ ] provider errors;
  - [ ] dead letter jobs.
- [ ] Add health output that distinguishes API health, database connectivity, Redis connectivity, and provider configuration presence.
- [ ] Add safe redaction for API keys, contact data, and provider payloads in logs.
- [ ] Update `README.md` with v2 setup, required environment variables, endpoints, and worker processes.

## Phase 15: Verification Checklist

- [ ] Run `bun run typecheck`.
- [ ] Run `bun test` for unit and integration tests.
- [ ] Run database migrations against local test Postgres.
- [ ] Manually trigger a short search run with one search term and one result.
- [ ] Verify duplicate search terms are skipped.
- [ ] Verify duplicate URLs are skipped.
- [ ] Verify a likely lead is scraped, scored, extracted, claimed, and surfaced.
- [ ] Verify a low-quality lead stops below threshold.
- [ ] Verify automatic deep research triggers only at or above the configured threshold.
- [ ] Verify automatic message generation triggers only at or above the configured threshold.
- [ ] Verify manual deep research and message generation endpoints work.
- [ ] Verify pause, resume, stop, and graceful shutdown behavior.
- [ ] Verify existing Apify dataset import still works.
