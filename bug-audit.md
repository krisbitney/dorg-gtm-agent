# Bug Audit

## gtm-workers

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

## High

### B4. No error handling for individual content-extraction LLM calls
**File:** `gtm-ai/src/mastra/workflows/search-and-filter-workflow.ts:187–201`  
The `extract-relevant-content` step calls `searchFilterAgent.generate()` in a loop over scraped leads with **no try/catch**. If the LLM call fails for one lead (timeout, rate limit, schema mismatch), the entire workflow fails and all previously extracted leads are lost. Contrast with the `scrape-leads` step (lines 150–154) which *does* wrap individual scrape operations in try/catch.

**Fix:** Wrap the per-lead LLM call in try/catch, log the error, skip that lead, and continue.

---