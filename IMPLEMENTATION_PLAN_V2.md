# GTM Agent V2 — Implementation Plan

> **Key principle**: Build gtm-ai first, then rewrite gtm-workers, then delete old logic. Keep existing worker code intact as reference while building its Mastra replacements — do not delete a file until its replacement is built, tested, and working.
>
> **Code style**: Preserve existing code styles, patterns, and conventions unless the technical design explicitly requires a change. Match the style of whatever file you're editing. Only deviate where the design doc mandates it (e.g., 0–100 scoring replaces 0–1, `structuredOutput` replaces manual parsing). When building new files, follow the conventions already established in that package.

---

## Phase 1: Non-Destructive Schema Migrations (gtm-workers)

_Additive only. No columns dropped, no logic deleted._

- [ ] Add new columns to posts table migration:
  - `quality_score` (integer, nullable — replaces `lead_probability` later)
  - `budget` (text, nullable)
  - `company_name` (text, nullable)
  - `deep_research_data` (text, nullable)
  - `outreach_message` (text, nullable)
  - `search_run_id` (text, nullable)
  - `source` (text, nullable — `"search"` or `"manual"`)
- [ ] Create `search_runs` table migration (id, status, config, counters, started_at, stopped_at, error_message, timestamps)
- [ ] Create `run_configuration` table migration (singleton row: consultancy_config, auto_deep_research, auto_message_gen, thresholds)
- [ ] Run migrations

---

## Phase 2: gtm-ai — Environment & Config

- [ ] Add env vars to `gtm-ai/src/mastra/config/app-env.ts`:
  - Serper: `SERPER_API_KEY`, `SERPER_BASE_URL`
  - ContextDev: `CONTEXT_DEV_API_KEY`, `CONTEXT_DEV_BASE_URL`
  - dOrg: `DORG_API_TOKEN`, `DORG_API_BASE_URL`
  - Redis: `REDIS_URL` (for dedup SETs: `gtm:search-terms`, `gtm:processed_urls`)
  - Models: `GTM_SEARCH_TERM_MODEL`, `GTM_SEARCH_FILTER_MODEL`, `GTM_DEEP_RESEARCH_MODEL`, `GTM_MESSAGE_GEN_MODEL`
- [ ] Define `ConsultancyConfig` type in `types/consultancy-config.ts`
- [ ] Define `consultancy-config-schema.ts`
- [ ] Set up Redis connection utility for gtm-ai (used by `dedupSearchTermTool` and `dedupProcessedUrlTool`)

---

## Phase 3: gtm-ai — Tools

_Build tools using the existing gtm-workers clients (`dorg-api-client.ts`, etc.) as reference implementation. Keep those workers files intact._

- [ ] Implement `search-web.tool.ts` — wraps Serper API (query, site, date range → results)
- [ ] Implement `scrape-page.tool.ts` — wraps ContextDev API, auto-summarizes via `webSummarizationAgent`
- [ ] Implement `claim-lead.tool.ts` — POST to dOrg `/leads/claim` (reference: `dorg-api-client.ts`)
- [ ] Implement `surface-lead.tool.ts` — POST to dOrg `/leads/surface` (reference: `dorg-api-client.ts`)
- [ ] Implement `send-discord-message.tool.ts` — POST to dOrg `/discord/post` (reference: `dorg-api-client.ts`)
- [ ] Implement `evaluate-result.tool.ts` — calls `evaluationAgent` to check relevance + entity match
- [ ] Implement `extract-learnings.tool.ts` — calls `learningExtractionAgent` for insights + follow-up questions
- [ ] Implement `dedup-search-term.tool.ts` — Redis `SISMEMBER`/`SADD` on `gtm:search-terms` SET with per-key TTL expiry
- [ ] Implement `dedup-processed-url.tool.ts` — Redis `SISMEMBER`/`SADD` on `gtm:processed_urls` SET for URL bloom-filter dedup

---

## Phase 4: gtm-ai — Agents

_Modify existing agents carefully; build new agents referencing old worker logic where applicable._

### Modify Existing

- [ ] Update `leadScoreAgent` — 0–100 scale output, parameterized with `ConsultancyConfig`
- [ ] Update `leadScoreResultSchema` — `qualityScore: number` replaces `leadProbability`
- [ ] Update `leadAnalysisAgent` — accept `ConsultancyConfig`, add `budget` and `companyName` to output schema
- [ ] Update `leadAnalysisResultSchema` — add optional `budget`, `companyName` fields

### New Agents

- [ ] Implement `searchTermAgent` — generates diverse `searchQuery` strings targeting specific platforms. The `site`, `startDateTime`, and `endDateTime` are injected by the workflow step from `runConfig` input parameters — the LLM does not set them (model: `GTM_SEARCH_TERM_MODEL`)
- [ ] Implement `searchFilterAgent` — cheap model, filters raw SERP results to promising leads (model: `GTM_SEARCH_FILTER_MODEL`)
- [ ] Implement `webSummarizationAgent` — summarizes scraped content by 80–95%, preserves key facts (model: `GTM_SMALL_MODEL`)
- [ ] Implement `evaluationAgent` — binary relevance + entity match decisions (model: `GTM_SEARCH_FILTER_MODEL`)
- [ ] Implement `learningExtractionAgent` — extracts key learnings + 1–3 follow-up questions (model: `GTM_DEEP_RESEARCH_MODEL`)
- [ ] Implement `deepResearchAgent` — tool-equipped (searchWeb, scrapePage, evaluateResult, extractLearnings), two-phase research, `maxSteps: 12` (model: `GTM_DEEP_RESEARCH_MODEL`)
- [ ] Implement `reportAgent` — synthesizes learnings into structured markdown report (model: `GTM_DEEP_RESEARCH_MODEL`)
- [ ] Implement `messageGenerationAgent` — crafts personalized outreach messages (model: `GTM_MESSAGE_GEN_MODEL`)

---

## Phase 5: gtm-ai — Prompts & Schemas

_Reference existing prompt builders in gtm-ai and business logic in gtm-workers while writing new prompts._

### Prompt Builders

- [ ] Update `build-lead-score-prompt.ts` — accept `ConsultancyConfig`, 0–100 scale
- [ ] Update `build-lead-analysis-prompt.ts` — accept `ConsultancyConfig`
- [ ] Implement `build-search-term-prompt.ts` — prompt only generates `searchQuery` strings; `site` and datetime fields are injected separately by the workflow step
- [ ] Implement `build-search-filter-prompt.ts`
- [ ] Implement `build-deep-research-prompt.ts` — two-phase instructions, maxSteps guidance, entity verification
- [ ] Implement `build-message-generation-prompt.ts`
- [ ] Port `build-surface-brief.ts` from gtm-workers to gtm-ai (keep original until verified)

### Schemas

- [ ] Update `lead-score-result-schema.ts` — `qualityScore: number`
- [ ] Update `lead-analysis-result-schema.ts` — add `budget`, `companyName`
- [ ] Implement `process-lead-result-schema.ts` — outcome union type (`below_threshold` | `not_a_lead` | `claim_failed` | `completed` + optional `triggerDeepResearch`)
- [ ] Implement `search-term-result-schema.ts`
- [ ] Implement `search-filter-result-schema.ts`
- [ ] Implement `deep-research-result-schema.ts`
- [ ] Implement `message-generation-result-schema.ts`

### Types

- [ ] Update `gtm-request-context.ts` — add `ConsultancyConfig`

---

## Phase 6: gtm-ai — Workflows

_Reference `process-post-job.ts` and `search-for-leads.ts` in gtm-workers for the orchestration logic. Do not delete those files yet._

### Modify Existing

- [ ] Update `leadScoreWorkflow` — output `qualityScore: 0–100`, normalize step clamps and rounds
- [ ] Update `leadAnalysisWorkflow` — parameterized with `ConsultancyConfig`, updated output schema

### New Workflows

- [ ] Implement `processLeadWorkflow` — full pipeline (reference: `process-post-job.ts`):
  - `lead-score` → `normalize-score` → `below-threshold-check` → `lead-analysis` → `not-a-lead-check` → `claim-lead` → `build-surface-brief` → `surface-lead` → `notify-discord` → `post-completion-checks`
- [ ] Implement `searchForLeadsWorkflow` — search orchestration (reference: `search-for-leads.ts`):
  - `generate-search-terms` (LLM generates `searchQuery` strings; workflow step injects `site`, `startDateTime`, `endDateTime` from `runConfig`; hashes and dedupes via `dedupSearchTermTool`) → `execute-searches` (parallel tool calls) → `filter-results` (dedupes URLs via `dedupProcessedUrlTool`, then LLM filter) → `scrape-pages` (parallel tool calls) → `evaluate-and-enqueue` (inserts scraped URLs into `dedupProcessedUrlTool`, checks stopping conditions)
- [ ] Implement `deepResearchWorkflow` — agent-driven research:
  - `execute-deep-research` (agent with tools, maxSteps 12) → `synthesize-report` (reportAgent)
- [ ] Implement `generateMessageWorkflow` — single step: `craft-message` via `messageGenerationAgent`
- [ ] Register all new workflows, agents, and tools in `src/mastra/index.ts`

---

## Phase 7: gtm-workers — Thin Layer Rewrite

_Now that gtm-ai has all the replacement logic, rewrite workers as a thin pipe. Reference existing worker code for queue patterns, DB access, and HTTP routes._

### 7.1 Mastra Client

- [ ] Rewrite `mastra-client.ts` as thin `@mastra/client-js` wrapper (reference old `gtm-ai-client.ts`):
  - `createRun()` + `startAsync()` for workflow execution
  - No retry/timeout logic (Mastra handles retries; worker moves to DLQ on failure)
  - Typed workflow input/output

### 7.2 Worker Loop

- [ ] Rewrite `bin/worker.ts` — lead worker loop (reference old loop structure):
  - `BRPOPLPUSH` dequeue → load post from DB → load runConfig from Redis → call `processLeadWorkflow` → persist outcome → ack/DLQ
- [ ] Implement `handleWorkflowOutcome()` — pure mapping function: outcome → DB update + optional deep research enqueue
- [ ] Implement `mark-post-error.ts` — helper to mark post as ERROR in DB

### 7.3 Search Worker Loop

- [ ] Implement search worker loop:
  - Dequeue search run → load config → call `searchForLeadsWorkflow` → persist counters → ack/DLQ

### 7.4 HTTP API

- [ ] Implement `POST /search-runs` — trigger new search run
- [ ] Implement `POST /search-runs/:id/stop` — stop running search
- [ ] Implement `GET /search-runs/:id` — get search run status
- [ ] Implement `POST /leads/:id/deep-research` — manually trigger deep research
- [ ] Implement `POST /leads/:id/generate-message` — manually trigger message generation
- [ ] Update `GET /leads` — filterable by status, score
- [ ] Update `GET /leads/:id` — full lead data including research report + message
- [ ] Implement `PATCH /configuration` — update runtime config
- [ ] Implement `GET /configuration` — get current config
- [ ] Retain `GET /healthz`

### 7.5 Repositories

- [ ] Update `post-repository.ts` — add new column accessors
- [ ] Implement `search-run-repository.ts` — CRUD for search_runs
- [ ] Implement `configuration-repository.ts` — CRUD for run_configuration

### 7.6 Redis Data Structures

_Note: Dedup SETs (`gtm:processed_urls`, `gtm:search-terms`) are now owned by gtm-ai via Mastra tools. Workers only manage the Redis structures below._

- [ ] Implement `run-state-store.ts` — run state HASH (`gtm:run-state:<id>`)
- [ ] Wire up runtime config cache (`gtm:run-config` HASH)
- [ ] Refine `lead-queue.ts` — `BRPOPLPUSH` pattern for `gtm:posts:queue` → `gtm:posts:processing`
- [ ] Implement `search-run-queue.ts` — same pattern for `gtm:search-runs:queue`
- [ ] Implement DLQ support (`gtm:posts:dlq` list) for failed messages

### 7.7 Environment Variables

- [ ] Remove env vars that moved to gtm-ai (dOrg, Serper, ContextDev)
- [ ] Remove Apify env vars
- [ ] Add `GTM_AI_BASE_URL`
- [ ] Add queue key env vars (`SEARCH_QUEUE_NAME`)
- [ ] Add `SEARCH_WORKER_CONCURRENCY`

### 7.8 Graceful Shutdown & Run State

- [ ] Implement graceful shutdown on `SIGTERM`/`SIGINT`:
  - Stop accepting new queue messages
  - Drain in-flight jobs (wait for Mastra workflow calls to complete)
  - Ack processed messages, return unprocessed to queue
  - Exit cleanly
- [ ] Implement run state tracking via Redis HASH:
  - Track active search runs with stopping parameters (max leads, max time, max results)
  - Resume stopped runs correctly on startup (`WORKER_REQUEUE_STALE_ON_STARTUP`)
- [ ] Implement runtime config cache invalidation — read from Redis each iteration so changes take effect immediately

---

## Phase 8: Integration & Verification

_Only proceed here once gtm-ai workflows are working and gtm-workers thin layer is talking to them correctly._

- [ ] End-to-end smoke test: manual search run → lead processing → deep research → message generation
- [ ] Verify Mastra observability / OpenTelemetry tracing exports correctly
- [ ] Verify graceful shutdown drains jobs without loss
- [ ] Verify runtime config changes take effect without restart

---

## Phase 9: Provider Swap Interfaces (gtm-ai)

- [ ] Define `SearchProvider` interface — abstract over Serper API (query, site, date range → results)
- [ ] Define `PageScraper` interface — abstract over ContextDev API (URL → page content)
- [ ] Implement Serper-backed `SearchProvider`
- [ ] Implement ContextDev-backed `PageScraper`
- [ ] Wire interfaces into `searchWebTool` and `scrapePageTool` so providers can be swapped

---

## Phase 10: Cleanup — Delete Old Logic

_Only after everything above is working end-to-end. You now have working replacements for every deleted file._

### 10.1 Remove Apify

- [ ] Delete `gtm-web-crawler/` package
- [ ] Delete Apify files from gtm-workers:
  - `use-cases/start-apify-crawl-run.ts`
  - `use-cases/import-apify-run-dataset.ts`
  - `clients/apify-crawler-client.ts`
  - `config/crawler-configs.ts`
  - `config/crawler-inputs/`
  - `schemas/post-schemas/apify-reddit-post-schema.ts`
  - `schemas/post-schemas/apify-twitter-post-schema.ts`
  - `http/handle-trigger-crawl-request.ts`
  - `http/handle-apify-webhook-request.ts`
  - `storage/schema/crawl-runs-table.ts`
  - `storage/repositories/crawl-run-repository.ts`
  - `constants/crawl-run-status.ts`
- [ ] Drop `apify_run_id`, `apify_dataset_id` columns from posts table
- [ ] Drop `lead_probability` column from posts table
- [ ] Drop `crawl_runs` table

### 10.2 Remove Old Business Logic (now replaced by gtm-ai)

- [ ] Delete `use-cases/process-post-job.ts` (replaced by `processLeadWorkflow`)
- [ ] Delete `use-cases/search-for-leads.ts` (replaced by `searchForLeadsWorkflow`)
- [ ] Delete `clients/dorg-api-client.ts` (replaced by Mastra tools: claimLead, surfaceLead, sendDiscordMessage)
- [ ] Delete `worker/build-surface-brief.ts` (moved into `processLeadWorkflow` step 7)
- [ ] Delete `schemas/platform.ts` if no longer needed

### 10.3 Remove Old Mastra Client

- [ ] Delete old `clients/gtm-ai-client.ts` (replaced by thin `mastra-client.ts`)

---

## Phase 11: Documentation

- [ ] Update `CLAUDE.md` to note the boundary shift (worker = thin pipe, Mastra = brain)
- [ ] Document the new env vars in README or equivalent
- [ ] Document the post status state machine (PENDING → SCORING → ANALYZING → CLAIMING → SURFACING → COMPLETED, plus DEEP_RESEARCHING, GENERATING_MESSAGE)
