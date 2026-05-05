# Bug Audit

## gtm-workers

### 7. Transient dOrg claim errors are treated as terminal lead failures
- Files: `gtm-workers/src/use-cases/process-post-job.ts`, `gtm-workers/src/clients/dorg-api-client.ts`
- Severity: High
- Problem: `claimLead()` converts any non-2xx HTTP response into `{ success: false }`, and `ProcessPostJob` turns that into `claim_failed` and returns normally.
- Impact: Temporary dOrg outages, rate limits, or 5xx responses cause the queue item to be acknowledged instead of retried or dead-lettered, permanently dropping valid leads.
- Evidence: On `!claimResult.success`, `ProcessPostJob` calls `postRepository.markClaimFailed(...)` and `return`s. The caller (`ProcessQueueLoop`) only DLQs thrown errors, so the message is acknowledged.

### 14. Worker process has no graceful shutdown / signal handling
**Files:** `gtm-workers/src/bin/worker.ts`, `gtm-workers/src/bin/api.ts`
Both entry points have infinite loops with no handling of `SIGTERM` or `SIGINT`. When the process receives a termination signal:
- Items in the processing queue will be left stranded. `requeueProcessing` only runs at startup.
- In-flight AI calls are aborted mid-request.
- Database connections (`postgres()` client) are never closed.
- Redis connections (`Bun.redis`) are never disconnected.

---

## Coupling Issues (both packages)

### 16. Workflow name mismatch risk
**Files:** `gtm-ai/src/mastra/index.ts:26-31` and `gtm-workers/src/clients/gtm-ai-client.ts:175,203,231,260`
The gtm-ai Mastra instance registers workflows with camelCase names like `leadScoreWorkflow`, while the gtm-ai-client looks them up with those exact same names. There's no shared constant or type-safe enum — the names are duplicated as magic strings in two packages. Renaming a workflow in gtm-ai silently breaks gtm-workers at runtime.

## Critical

### B1. Timezone bug in Serper date-range formatting
**File:** `gtm-ai/src/mastra/providers/serper-provider.ts:65–71`  
`buildTbs()` converts ISO datetime strings to Google's `cdr` format using `new Date(iso).getMonth()`, `.getDate()`, `.getFullYear()`. These methods return values in the **local server timezone**, but ISO 8601 strings are typically UTC (e.g., `2026-05-05T00:00:00.000Z`). On any server whose timezone is west of UTC, the date will be off by one day (e.g., UTC midnight May 5 → local May 4), producing an incorrect search window. On east-of-UTC servers, dates shift forward. This silently corrupts every date-bounded search.

**Fix:** Parse the date components from the ISO string in UTC — use `.getUTCMonth()`, `.getUTCDate()`, `.getUTCFullYear()`, or construct the format from the string directly.

---

## High

### B4. No error handling for individual content-extraction LLM calls
**File:** `gtm-ai/src/mastra/workflows/search-and-filter-workflow.ts:187–201`  
The `extract-relevant-content` step calls `searchFilterAgent.generate()` in a loop over scraped leads with **no try/catch**. If the LLM call fails for one lead (timeout, rate limit, schema mismatch), the entire workflow fails and all previously extracted leads are lost. Contrast with the `scrape-leads` step (lines 150–154) which *does* wrap individual scrape operations in try/catch.

**Fix:** Wrap the per-lead LLM call in try/catch, log the error, skip that lead, and continue.

---