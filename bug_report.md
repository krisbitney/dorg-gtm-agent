# Bug Report: gtm-ai & gtm-workers Comprehensive Audit

Date: 2026-05-04
Packages audited: `gtm-ai/` (excl. test/), `gtm-workers/` (excl. test/)

---

## LOW

### BUG 16 — `saveAnalysis` param type `timing: string` doesn't match nullable DB column

**File:** `gtm-workers/src/storage/repositories/lead-repository.ts:57`

```typescript
async saveAnalysis(id: string, analysis: { timing: string; ... }, ...): Promise<void>
```

**What happens:** The parameter type declares `timing: string` (non-nullable), but the DB column `leads.timing` is `text("timing")` (nullable). The gtm-ai LLM can return `null` for timing. TypeScript won't catch the mismatch because the caller `process-lead-job.ts:91` gets `timing` from `GtmAiAnalysisResult` which also declares `string` (but receives `null` at runtime from the LLM).

**Impact:** Type system lies about nullability. Related to BUG 6.

---

### BUG 17 — Inconsistent import extensions in `process-lead-job.ts`

**File:** `gtm-workers/src/worker/process-lead-job.ts:6,8`

```typescript
import { buildSurfaceBrief } from "./build-surface-brief.ts";            // .ts
import { defaultTargetConsultancyDescription } from "../constants/default-target-consultancy-description.ts"; // .ts
```

**What happens:** Two imports use `.ts` extensions while every other file in the package (including other imports in the same file on lines 1-5) uses `.js` extensions. With `verbatimModuleSyntax: true` in tsconfig, Bun handles both, but the inconsistency breaks project convention.

**Impact:** Confusing to developers; may cause issues with certain bundlers or tooling.

---

### BUG 18 — `runWithTimeout` has unguarded async `setTimeout` callback

**File:** `gtm-workers/src/clients/gtm-ai-client.ts:154-161`

```typescript
const timer = setTimeout(async () => {
    if (options.onTimeout) {
        await options.onTimeout();   // If this throws...
    }
    reject(...);
}, this.timeoutMs);
```

**What happens:** The `setTimeout` callback is `async`. If `onTimeout()` were to throw (despite its own try-catch), the returned promise rejects with no handler, producing an unhandled promise rejection.

**Impact:** Low — the current `onTimeout` implementation catches its own errors. But any future change that removes that try-catch would produce an unhandled rejection.

---

## Summary by severity

| Severity | Count | IDs |
|----------|-------|-----|
| CRITICAL | 5 | #1, #2, #3, #4, #5 |
| HIGH | 1 | #6 |
| MEDIUM | 8 | #7, #8, #9, #10, #11, #12, #13, #14, #15 |
| LOW | 3 | #16, #17, #18 |

## Root cause patterns

1. **`CLAUDE.md` instructs using `Bun.redis`** — a non-existent API. This directly caused BUG #2 (and the dead code in BUG #12). The `CLAUDE.md` should be updated to recommend a real Redis client (e.g., `ioredis`).

2. **No integration tests** — the field name mismatch (BUG #1) and prompt/schema mismatch (BUG #3) would be caught immediately by an integration test that calls gtm-ai from gtm-workers. The test directories are known to be outdated.

3. **Stringly-typed cross-package contracts** — field names are passed as plain objects with no shared schema validation at the boundary. BUG #1 and BUG #6 would be prevented by a single shared Zod schema imported by both packages.
