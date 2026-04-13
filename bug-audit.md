# Bug Audit

## 2026-04-12

### 5. Dataset import can permanently orphan posts if queue publish fails after DB insert
- Files: `gtm-workers/src/use-cases/import-apify-run-dataset.ts`, `gtm-workers/src/storage/schema/posts-table.ts`
- Severity: High
- Problem: The importer inserts the post row first, then enqueues it, and only after that marks the URL as processed. If enqueueing fails, the insert remains committed but the URL is not marked processed.
- Impact: A retry sees the URL as unprocessed, attempts the insert again, hits the unique `posts.url` constraint, and never re-enqueues the already-inserted row. The post stays stranded in Postgres and is never processed by the worker.
- Evidence: `postRepository.insert(...)` runs before `leadQueue.enqueue(...)`; the `catch` path does not mark the URL as processed or enqueue the existing row, and `posts.url` is unique.

### 7. Transient dOrg claim errors are treated as terminal lead failures
- Files: `gtm-workers/src/use-cases/process-post-job.ts`, `gtm-workers/src/clients/dorg-api-client.ts`
- Severity: High
- Problem: `claimLead()` converts any non-2xx HTTP response into `{ success: false }`, and `ProcessPostJob` turns that into `claim_failed` and returns normally.
- Impact: Temporary dOrg outages, rate limits, or 5xx responses cause the queue item to be acknowledged instead of retried or dead-lettered, permanently dropping valid leads.
- Evidence: On `!claimResult.success`, `ProcessPostJob` calls `postRepository.markClaimFailed(...)` and `return`s. The caller (`ProcessQueueLoop`) only DLQs thrown errors, so the message is acknowledged.
