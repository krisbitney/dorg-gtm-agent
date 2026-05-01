# High-Level Technical Design: GTM Agent V2

## 1. Boundary Shift

In the previous design, `gtm-workers` contained substantial business logic — `ProcessPostJob` orchestrated the score → analyze → claim → surface pipeline, `SearchForLeads` orchestrated the search → filter → scrape loop, and so on. The workers were the brain; `gtm-ai` was just an LLM-calling utility.

This design **shifts the boundary**: `gtm-ai` (Mastra) becomes the brain. It owns all decision-making, orchestration logic, agent prompts, and external API calls (via tools). `gtm-workers` becomes a thin infrastructure layer — it handles operational concerns that Mastra is not designed for (persistent queue consumption, concurrency, graceful shutdown, custom auth) and delegates everything else to Mastra workflows.

### Rationale

| Concern | Best Home | Why |
|---|---|---|
| **LLM calls, prompts, structured output** | gtm-ai | Core competency of Mastra agents |
| **Orchestration logic** (what to do, in what order) | gtm-ai | Mastra workflows chain steps natively |
| **External API calls** (dOrg, Serper, ContextDev) | gtm-ai | Mastra tools are the natural abstraction |
| **Observability / tracing** | gtm-ai | Mastra has built-in OpenTelemetry + span export |
| **Persistent queue consumption** (blocking `BRPOPLPUSH`, `while(true)` loops) | gtm-workers | Mastra workflows are finite request/response; they are not infinite polling loops |
| **Concurrent worker pool** (N parallel consumers) | gtm-workers | Mastra has no built-in concurrency control for long-running consumers |
| **Graceful shutdown** (drain in-flight jobs, ack queue, then exit) | gtm-workers | Mastra's lifecycle is request-scoped, not job-drain-scoped |
| **Redis data structures** (bloom sets, TTL-based dedup, queue management) | gtm-workers | Redis is infrastructure; Mastra has no Redis integration |
| **Custom HTTP auth** (Bearer tokens, webhook secrets) | gtm-workers | Mastra's auto-generated endpoints lack per-endpoint auth config |
| **Postgres persistence** (Drizzle ORM, migrations, row-level CRUD) | gtm-workers | Existing Drizzle setup is mature; Mastra uses LibSQL internally |

---

## 2. Service Responsibilities

### gtm-ai (Mastra) — The Brain

Owns all decision-making, orchestration, and external API access:

- **All LLM calls**: agents, prompts, and structured output schemas
- **All orchestration**: workflows that decide what to do, in what order, and what the outcome means
- **All external API calls**: dOrg API, Serper API, and ContextDev API are accessed via Mastra tools
- **Observability**: built-in OpenTelemetry tracing with span export
- **No infrastructure dependencies**: Mastra uses LibSQL and DuckDB internally; no Redis, no Postgres

### gtm-workers (Bun) — Thin Infrastructure Layer

Handles operational concerns that Mastra is not designed for:

1. **Consume Redis queues** — blocking `BRPOPLPUSH` loops, concurrent worker pools — and invoke the appropriate Mastra workflow for each message.
2. **Persist results** to Postgres after workflows complete — workers own the Drizzle schema and run migrations.
3. **Manage Redis state** — bloom filter dedup (`gtm:processed_urls`), search-term TTL sets (`gtm:search-terms`), run state tracking (`gtm:run-state:<id>`), runtime config cache (`gtm:run-config`).
4. **HTTP API with custom auth** — Bearer token endpoints for manual triggers, lead CRUD, configuration, and health checks.
5. **Graceful shutdown** — drain in-flight jobs, ack queues, then exit on `SIGTERM`/`SIGINT`.

Workers contain **no business logic** — no thresholds, no if/else about what-happens-next, no orchestration. They are a dumb pipe: dequeue → call workflow → persist outcome → ack.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      gtm-workers (Bun)                       │
│                      "Thin Infrastructure Layer"              │
│                                                             │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  API Server  │  │ Search Worker  │  │  Lead Worker   │  │
│  │  (Bun.serve) │  │  (N loops)     │  │  (N loops)     │  │
│  │              │  │                │  │                │  │
│  │ - Auth       │  │ while(true):   │  │ while(true):   │  │
│  │ - Routes     │  │   reserveNext  │  │   reserveNext  │  │
│  │ - Validation │  │   → call       │  │   → call       │  │
│  │              │  │     Mastra     │  │     Mastra     │  │
│  │              │  │     workflow   │  │     workflow   │  │
│  │              │  │   → persist    │  │   → persist    │  │
│  │              │  │   → ack/DLQ   │  │   → ack/DLQ   │  │
│  └──────┬───────┘  └───────┬────────┘  └───────┬────────┘  │
│         │                  │                   │            │
│  ┌──────┴──────────────────┴───────────────────┴─────────┐  │
│  │                   Storage Layer                        │  │
│  │  ┌──────────┐  ┌──────────────────────────────────┐   │  │
│  │  │ Postgres │  │  Redis                            │   │  │
│  │  │(Drizzle) │  │  - gtm:posts:queue                │   │  │
│  │  │          │  │  - gtm:search-runs:queue          │   │  │
│  │  │          │  │  - gtm:processed_urls (SET)       │   │  │
│  │  │          │  │  - gtm:search-terms (SET w/ TTL)  │   │  │
│  │  │          │  │  - gtm:run-state:<id> (HASH)      │   │  │
│  │  │          │  │  - gtm:run-config (HASH)          │   │  │
│  │  │          │  │  - gtm:posts:processing (list)    │   │  │
│  │  │          │  │  - gtm:posts:dlq (list)           │   │  │
│  │  └──────────┘  └──────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP (Mastra REST API)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      gtm-ai (Mastra)                         │
│                      "The Brain"                             │
│                                                             │
│  Agents:                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │leadScoreAgent│ │leadAnalysis  │ │searchTermAgent       │ │
│  │              │ │Agent         │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │searchFilter  │ │deepResearch  │ │messageGenAgent       │ │
│  │Agent         │ │Agent *       │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │webSummary    │ │evaluation    │ │learningExtraction    │ │
│  │Agent         │ │Agent         │ │Agent                 │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐                                            │
│  │reportAgent   │                                            │
│  └──────────────┘                                            │
│  * tool-equipped agent (drives research autonomously)         │
│                                                             │
│  Workflows (own all orchestration logic):                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ processLeadWorkflow (NEW — replaces ProcessPostJob)   │   │
│  │  score → normalize → [below_threshold | analyze]     │   │
│  │  → claim → surface → [deep_research | message_gen]   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ searchForLeadsWorkflow (NEW — replaces SearchForLeads)│   │
│  │  generate_terms → search → filter → scrape → enqueue │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ deepResearchWorkflow (research → synthesize → report) │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ generateMessageWorkflow (craft outreach message)      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌────────────────────────────────────┐   │
│  │leadScore     │ │leadAnalysisWorkflow                 │   │
│  │Workflow      │ │(modified: configurable, structured) │   │
│  │(0–100 scale) │ │                                    │   │
│  └──────────────┘ └────────────────────────────────────┘   │
│                                                             │
│  Tools (external API access + agent utilities):             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │searchWeb │ │scrapePage│ │claimLead │ │surfaceLead   │   │
│  │(Serper)  │ │(Context  │ │(dOrg API)│ │(dOrg API)    │   │
│  │          │ │ Dev+summ)│ │          │ │              │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │sendDiscord│ │evaluateResult│ │extractLearnings        │   │
│  │Message   │ │(entity check)│ │(learnings + follow-ups) │   │
│  │(dOrg API)│ │              │ │                        │   │
│  └──────────┘ └──────────────┘ └────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. gtm-ai: The Brain

### 4.1 Tools (New)

Tools are Mastra's mechanism for agents/workflows to call external APIs. These replace the client classes that previously lived in gtm-workers.

```typescript
// src/mastra/tools/search-web.tool.ts
export const searchWebTool = createTool({
  id: 'search-web',
  description: 'Searches the web using a SERP API. Returns ranked results with URLs, titles, and snippets.',
  inputSchema: z.object({
    query: z.string(),
    site: z.string().optional(),
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
    num: z.number().default(10),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      url: z.string(),
      title: z.string(),
      snippet: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    // Calls serper.dev API
    // Translates site + startDateTime/endDateTime into serper's tbs parameter
  },
});
```

```typescript
// src/mastra/tools/scrape-page.tool.ts
export const scrapePageTool = createTool({
  id: 'scrape-page',
  description: 'Fetches and extracts clean text content from a web page URL. Content is auto-summarized via webSummarizationAgent to prevent token blowup.',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),        // Summarized content (not raw — reduced by 80–95%)
  }),
  execute: async ({ context }) => {
    // 1. Calls context.dev API to fetch raw page content
    // 2. Passes raw content through webSummarizationAgent to produce summary
    // 3. Returns summary as 'content' (raw text is discarded)
  },
});
```

```typescript
// src/mastra/tools/dorg-claim-lead.tool.ts
export const claimLeadTool = createTool({
  id: 'claim-lead',
  description: 'Claims a lead in the dOrg system by its identifier (URL) and channel (platform).',
  inputSchema: z.object({
    identifier: z.string(),
    channel: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    leadId: z.string().optional(),
    message: z.string().optional(),
  }),
  execute: async ({ context }) => {
    // POST to dOrg API /leads/claim
  },
});
```

```typescript
// src/mastra/tools/dorg-surface-lead.tool.ts
export const surfaceLeadTool = createTool({
  id: 'surface-lead',
  description: 'Surfaces a claimed lead to the dOrg team with a formatted brief.',
  inputSchema: z.object({
    leadId: z.string(),
    brief: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
  }),
  execute: async ({ context }) => {
    // POST to dOrg API /leads/surface
  },
});
```

```typescript
// src/mastra/tools/dorg-send-message.tool.ts
export const sendDiscordMessageTool = createTool({
  id: 'send-discord-message',
  description: 'Sends a message to the dOrg Discord via the dOrg API.',
  inputSchema: z.object({
    content: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
  }),
  execute: async ({ context }) => {
    // POST to dOrg API /discord/post
  },
});
```

```typescript
// src/mastra/tools/evaluate-result.tool.ts
export const evaluateResultTool = createTool({
  id: 'evaluate-result',
  description: 'Evaluates whether a search result is relevant to the lead research query and confirms it refers to the correct entity (not a namesake).',
  inputSchema: z.object({
    query: z.string(),
    result: z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
    }),
    leadContext: z.string(),
    existingUrls: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    isRelevant: z.boolean(),
    reason: z.string(),
    isCorrectEntity: z.boolean(),
  }),
  execute: async (inputData, { mastra }) => {
    // Uses evaluationAgent to assess relevance and entity match
  },
});
```

```typescript
// src/mastra/tools/extract-learnings.tool.ts
export const extractLearningsTool = createTool({
  id: 'extract-learnings',
  description: 'Extracts key learnings from a search result and generates follow-up questions for deeper research.',
  inputSchema: z.object({
    query: z.string(),
    result: z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
    }),
    leadContext: z.string(),
  }),
  outputSchema: z.object({
    learning: z.string(),
    followUpQuestions: z.array(z.string()).max(3),
  }),
  execute: async (inputData, { mastra }) => {
    // Uses learningExtractionAgent to extract insights and follow-up questions
    // Follow-up questions are capped at 3 to limit research breadth
  },
});
```

### 4.2 Agents (Modified & New)

#### Modified: `leadScoreAgent`
- Instructions now accept `ConsultancyConfig` as a runtime parameter (injected via workflow step that reads from `requestContext`).
- Uses `structuredOutput` with `LeadScoreResultSchema` (now `{ qualityScore: number }` where `qualityScore` is 0–100).

#### Modified: `leadAnalysisAgent`
- Instructions accept `ConsultancyConfig`.
- Output schema gains optional `budget` and `companyName` fields.

#### New: `searchTermAgent`
- Generates diverse, high-signal search queries targeting specific platforms.
- Uses `searchWebTool` (optionally — primarily it returns search terms for the worker to execute).
- Model: `GTM_SEARCH_TERM_MODEL`.

#### New: `searchFilterAgent`
- Cheap model that filters raw SERP results, returning only those that resemble leads.
- Model: `GTM_SEARCH_FILTER_MODEL` (defaults to a small/cheap model like `gemma3:4b`).

#### New: `webSummarizationAgent`
- Summarizes scraped web page content to prevent token limit issues when passing content to other agents.
- Reduces page content by 80–95% while preserving key facts, statistics, and contact information.
- Used by `scrapePageTool` internally — when a page is scraped, the content is summarized before being returned to the calling agent. The original full text is not retained (only the summary is passed forward).
- Model: `GTM_SMALL_MODEL` (cheap model since summarization is high-volume, low-complexity).

#### New: `evaluationAgent`
- Evaluates whether search results are relevant to a lead research query.
- Confirms the result refers to the correct entity — e.g., a startup named "Apex" should not be confused with the Apex programming language.
- Criteria: direct relevance to the query topic, source credibility, information usefulness, and entity match.
- Model: `GTM_SEARCH_FILTER_MODEL` (cheap model — binary decisions with brief reasoning).

#### New: `learningExtractionAgent`
- Extracts the most valuable piece of information from a search result's content.
- Generates 1–3 focused follow-up questions that would deepen the research.
- Focuses on actionable, specific insights rather than general observations.
- Model: `GTM_DEEP_RESEARCH_MODEL`.

#### New: `deepResearchAgent`
- **Agent-driven research**: equipped with `searchWebTool`, `scrapePageTool`, `evaluateResultTool`, and `extractLearningsTool`. The agent drives the research process itself, deciding what to search next based on what it finds — no separate orchestration by the worker.
- Uses a **two-phase approach** (inspired by the Mastra deep research template):

  **Phase 1 — Initial Research:**
  1. Breaks down the lead into 2–3 specific, focused search queries (e.g., LinkedIn profile, company funding, contact information).
  2. For each query, calls `searchWebTool` to search the web.
  3. For promising results, calls `scrapePageTool` to fetch full page content (which is auto-summarized by the tool).
  4. Uses `evaluateResultTool` to confirm relevance and entity match.
  5. For relevant, verified results, uses `extractLearningsTool` to extract key findings and follow-up questions.

  **Phase 2 — Follow-up Research:**
  1. Collects ALL follow-up questions from Phase 1 learnings.
  2. Searches each follow-up question using `searchWebTool`.
  3. Scrapes, evaluates, and extracts learnings from follow-up results.
  4. **Stops after Phase 2** — does not search follow-up questions from Phase 2 results (prevents infinite loops).

- Always includes the user's social profile as a search target if the lead source is a social post.
- `maxSteps: 12` on `agent.generate()` provides a hard stop to control token spend.
- Model: `GTM_DEEP_RESEARCH_MODEL`.

#### New: `reportAgent`
- Synthesizes all extracted learnings, evaluations, and source URLs from the deep research phases into a structured, comprehensive markdown report.
- The report includes: executive summary, key findings (contact info, company size, budget, business strategy), source references with URLs, and confidence assessment.
- Receives the deepResearchAgent's structured output (queries, learnings, follow-up questions, source URLs) and transforms it into a polished report.
- Model: `GTM_DEEP_RESEARCH_MODEL`.

#### New: `messageGenerationAgent`
- Crafts personalized outreach messages using all available lead data (base post, analysis, deep research report if present).
- Model: `GTM_MESSAGE_GEN_MODEL`.

### 4.3 Workflows (New & Modified)

#### New: `processLeadWorkflow` (replaces `ProcessPostJob` in workers)

This is the most significant change. All orchestration logic that was in `ProcessPostJob.execute()` moves into a Mastra workflow.

```
ID: process-lead-workflow
Input: { postId: string, post: LeadInput, runConfig: RunConfig }

Steps:

1. lead-score
   - Calls leadScoreAgent.generate()
   - Output: { qualityScore: number }
   
2. normalize-score
   - Clamps to [0,100], rounds to integer
   
3. below-threshold-check
   - If qualityScore < runConfig.minQualityScore
     → Return { outcome: "below_threshold", qualityScore }
   - Else → continue

4. lead-analysis
   - Calls leadAnalysisAgent.generate()
   - Output: { isLead, whyFit, needs, timing, contactInfo, budget?, companyName? }
   
5. not-a-lead-check
   - If !isLead
     → Return { outcome: "not_a_lead" }
   - Else → continue

6. claim-lead
   - Uses claimLeadTool
   - Input: { identifier: post.url, channel: post.platform }
   - If fails → Return { outcome: "claim_failed", error }
   
7. build-surface-brief
   - Constructs formatted brief string from analysis data
   
8. surface-lead
   - Uses surfaceLeadTool
   - Input: { leadId, brief }
   
9. notify-discord
   - Uses sendDiscordMessageTool
   - Input: { content: brief }

10. post-completion-checks
    - If qualityScore >= runConfig.autoDeepResearchThreshold
      AND runConfig.autoDeepResearch → Return { outcome: "completed", triggerDeepResearch: true }
    - Else → Return { outcome: "completed" }
```

The **worker** calls this workflow and handles the outcome:
- `below_threshold` → update post status, save score, ack queue
- `not_a_lead` → update post status, ack queue
- `claim_failed` → update post status with error, ack queue
- `completed` → update post with all results, ack queue
- `completed` + `triggerDeepResearch` → update post, then enqueue for deep research

#### New: `searchForLeadsWorkflow` (replaces `SearchForLeads` in workers)

This is the other major shift. The search orchestration loop moves into a workflow.

```
ID: search-for-leads-workflow
Input: { 
  runConfig: RunConfig,
  maxSearchTerms: number,
  maxLeads: number,
  searchResults: SearchResult[],       // fed in by worker on iteration
  scrapedPages: ScrapedPage[],         // fed in by worker on iteration
  iteration: number 
}

Steps:

1. generate-search-terms (only on first iteration)
   - Calls searchTermAgent.generate()
   - Output: { searchTerms: Array<{ searchQuery, site, startDateTime, endDateTime }> }
   - If not first iteration, skip

2. select-next-search-terms
   - Returns the next batch of search terms that haven't been executed yet
   - Output: { terms: SearchTerm[] }
   - If no more terms → Return { outcome: "no_more_terms" }

3. wait-for-search-results (suspense step)
   - The workflow returns { outcome: "awaiting_search", terms }
   - The worker executes searches against SerperAPI, feeds results back
   - On resume: receives { searchResults }
   
4. filter-results
   - Calls searchFilterAgent.generate() to assess which results look promising
   - Output: { promising: Array<{ url, reason }>, notPromising: Array<{ url }> }

5. wait-for-scraped-pages (suspense step)
   - The workflow returns { outcome: "awaiting_scrape", urls: promising }
   - The worker scrapes URLs via ContextDev, feeds results back
   - On resume: receives { scrapedPages }

6. check-stopping-conditions
   - If leadsFound >= maxLeads → Return { outcome: "max_leads_reached" }
   - If runtimeExceeded → Return { outcome: "runtime_exceeded" }
   - Else → Loop back to step 2
```

The **search worker** drives this workflow in a loop:
1. Call `searchForLeadsWorkflow` with `iteration: 0`
2. If outcome is `awaiting_search` → execute searches (SerperAPI), call workflow again with `searchResults`
3. If outcome is `awaiting_scrape` → execute scrapes (ContextDev), insert into DB + Redis, call workflow again with `scrapedPages`
4. If outcome is `no_more_terms` / `max_leads_reached` / `runtime_exceeded` → mark search run complete

This keeps the search loop alive while the workflow owns the decision logic. The worker is just a loop that feeds data into the workflow and acts on its instructions.

**Design note — alternatives considered:**
- Having the workflow call `searchWebTool` and `scrapePageTool` directly (via tool-equipped agents) would be cleaner, but each tool call is a single page/query. A search run involves potentially hundreds of queries and scrapes. Running them sequentially inside a single workflow execution would be slow and expensive (LLM context grows with each step). The batch/suspense pattern above lets the worker parallelize the I/O while the workflow only sees aggregated results per iteration.
- If token cost and latency are less of a concern for small runs (e.g., `maxSearchTerms=5`, `maxLeads=3`), the workflow could use tools directly and run synchronously. Both modes could be supported via a `mode` parameter.

#### New: `deepResearchWorkflow`

Unlike `searchForLeadsWorkflow` (which uses the suspense pattern for batch I/O efficiency), deep research uses an **agent-driven pattern** (inspired by the Mastra deep research template). The `deepResearchAgent` is equipped with tools that call external APIs directly — no worker coordination needed. This is appropriate because deep research intentionally limits its scope (2–3 initial queries + follow-ups = ~6–10 total searches), so sequential tool calls are fast enough and the adaptive two-phase approach produces better results.

```
ID: deep-research-workflow
Input: { lead: LeadWithContext, runConfig: RunConfig }

Steps:

1. execute-deep-research
   - Calls deepResearchAgent.generate() with maxSteps: 12
   - The agent uses its tools (searchWebTool, scrapePageTool,
     evaluateResultTool, extractLearningsTool) to drive the two-phase
     research process autonomously.
   - The agent is given a prompt that includes:
       * Lead context (URL, platform, post content, analysis results)
       * Instructions to find contact info, company size, budget,
         business strategy, products, and key decision-makers
       * Instruction to always include the user's social profile
         if the lead source is a social post
       * Instruction to stop after Phase 2 (no infinite loops)
   - structuredOutput enforces the research result schema
   - Output: { queries: string[], learnings: Learning[],
     sourceUrls: string[], followUpQuestions: string[] }

2. synthesize-report
   - Calls reportAgent.generate() with the structured research output
   - Produces a polished, structured markdown report with sections:
       * Executive Summary
       * Key Findings (contact info, company details, budget,
         business strategy)
       * Source References (with URLs)
       * Confidence Assessment
   - Output: { researchReportMarkdown: string }
```

The **worker** calls this workflow synchronously — it invokes `deepResearchWorkflow`, receives the completed markdown report, and persists it to Postgres. No suspense steps, no batch I/O coordination. The deepResearchAgent handles all external API calls itself through its tools.

**Design rationale for agent-driven vs. suspense pattern:**
- Deep research has intentionally limited scope (max 6–10 searches). Sequential tool calls are acceptable.
- The two-phase approach (initial → extract learnings → follow-up → stop) requires the agent to adapt based on what it finds — it cannot know all follow-up questions upfront.
- `maxSteps: 12` provides a hard token/time budget, preventing runaway costs.
- The `webSummarizationAgent` keeps context size manageable by summarizing scraped content before it reaches the agent.
- This keeps the architecture simple: the worker just calls one workflow and gets back a finished report. No coordination loop.

#### New: `generateMessageWorkflow`

```
ID: generate-message-workflow
Input: { lead: LeadWithResearch, runConfig: RunConfig }

Steps:

1. craft-message
   - Calls messageGenerationAgent.generate()
   - Has access to: base post, analysis results, deep research report (if present)
   - Output: { message: string, subject: string, tone: string }
```

This workflow is synchronous (no suspense steps needed). The worker calls it and stores the result.

#### Modified: `leadScoreWorkflow`
- Output schema: `{ qualityScore: number }` (0–100, replaces `leadProbability` 0–1)
- Normalize step: clamps to [0, 100], rounds to integer

#### Modified: `leadAnalysisWorkflow`
- System prompt parameterized with `ConsultancyConfig`
- Output schema gains: `budget` (string | null), `companyName` (string | null)

---

## 5. gtm-workers: The Thin Infrastructure Layer

### 5.1 What Gets Removed (Entirely)

All files that contained business logic. These responsibilities move to Mastra workflows/tools:

| Removed File | Where Logic Moves |
|---|---|
| `src/use-cases/process-post-job.ts` | `processLeadWorkflow` in gtm-ai |
| `src/use-cases/search-for-leads.ts` | `searchForLeadsWorkflow` in gtm-ai |
| `src/use-cases/start-apify-crawl-run.ts` | N/A (Apify removed) |
| `src/use-cases/import-apify-run-dataset.ts` | N/A (Apify removed) |
| `src/clients/apify-crawler-client.ts` | N/A (Apify removed) |
| `src/clients/dorg-api-client.ts` | `claimLeadTool`, `surfaceLeadTool`, `sendDiscordMessageTool` in gtm-ai |
| `src/clients/gtm-ai-client.ts` | Not needed — workers call Mastra HTTP API directly |
| `src/config/crawler-configs.ts` | N/A (Apify removed) |
| `src/config/crawler-inputs/` | N/A (Apify removed) |
| `src/schemas/post-schemas/apify-reddit-post-schema.ts` | Replaced by generic scraped page handling |
| `src/schemas/post-schemas/apify-twitter-post-schema.ts` | Replaced by generic scraped page handling |
| `src/schemas/platform.ts` | Simplified or removed |
| `src/worker/build-surface-brief.ts` | Logic moves into `processLeadWorkflow` step 7 |
| `src/http/handle-trigger-crawl-request.ts` | N/A (Apify removed) |
| `src/http/handle-apify-webhook-request.ts` | N/A (Apify removed) |
| `src/storage/schema/crawl-runs-table.ts` | N/A |
| `src/storage/repositories/crawl-run-repository.ts` | N/A |
| `src/constants/crawl-run-status.ts` | N/A |

### 5.2 What Stays (or Gets Added)

Workers keep only the operational layer:

```
gtm-workers/src/
├── bin/
│   ├── api.ts                          # HTTP server entry point
│   └── worker.ts                       # Queue consumer entry point
├── clients/
│   ├── mastra-client.ts                # THIN: wraps Mastra HTTP API calls
│   │                                    # (replaces GtmAiClient — just HTTP, no retry logic)
│   ├── serper-api-client.ts            # THIN: wraps serper.dev REST API
│   └── context-dev-client.ts           # THIN: wraps context.dev REST API
├── config/
│   └── app-env.ts                      # Environment variable validation
├── constants/
│   ├── post-status.ts                  # Post status enum
│   └── route-paths.ts                  # HTTP route paths
├── http/
│   ├── create-server.ts                # Bun.serve HTTP server + route dispatch
│   ├── handle-health-request.ts        # GET /healthz
│   ├── handle-search-run-request.ts    # POST /search-runs, GET/POST /search-runs/:id
│   ├── handle-lead-request.ts          # GET /leads, GET/POST /leads/:id/...
│   └── handle-configuration-request.ts # GET/PATCH /configuration
├── schemas/
│   ├── queue-payload-schema.ts         # { id: uuid, platform: string }
│   ├── search-run-request-schema.ts    # Search run request body
│   └── configuration-schema.ts         # Runtime config shape
├── storage/
│   ├── database.ts                     # Drizzle + Postgres connection
│   ├── migrate.ts                      # Migration runner
│   ├── lead-queue.ts                   # Redis lead queue (BRPOPLPUSH pattern)
│   ├── search-run-queue.ts             # Redis search run queue
│   ├── processed-url-store.ts          # Redis dedup set (SISMEMBER/SADD)
│   ├── search-term-store.ts            # Redis SET with per-member TTL
│   ├── run-state-store.ts              # Redis HASH for run state tracking
│   ├── repositories/
│   │   ├── post-repository.ts          # Post CRUD (lean — no orchestration)
│   │   ├── search-run-repository.ts    # Search run CRUD
│   │   └── configuration-repository.ts # Runtime config CRUD
│   └── schema/
│       ├── posts-table.ts              # Drizzle schema: posts
│       ├── search-runs-table.ts        # Drizzle schema: search_runs
│       └── configuration-table.ts      # Drizzle schema: run_configuration
├── worker/
│   └── mark-post-error.ts             # Pure helper: mark post as ERROR in DB
```

### 5.3 The Lead Worker Loop

The worker loop becomes a minimal wrapper around the Mastra workflow:

```typescript
// bin/worker.ts — conceptual sketch

async function runLeadWorkerLoop(workerRunId: string) {
  while (true) {
    let rawPayload: string | null = null;
    try {
      // 1. Block on the queue
      rawPayload = await leadQueue.reserveNext();
      if (!rawPayload) continue;

      // 2. Parse payload
      const { id: postId } = queuePayloadSchema.parse(JSON.parse(rawPayload));

      // 3. Load post from DB
      const post = await postRepository.findById(postId);
      if (!post || isTerminal(post.status)) {
        await leadQueue.ack(rawPayload);
        continue;
      }

      // 4. Load run config from Redis
      const runConfig = await runStateStore.getConfig();

      // 5. Invoke Mastra workflow (all business logic is here)
      const result = await mastraClient.executeWorkflow('processLeadWorkflow', {
        postId,
        post: mapPostToWorkflowInput(post),
        runConfig,
      });

      // 6. Persist results based on workflow outcome
      await handleWorkflowOutcome(postId, result, rawPayload);

    } catch (error) {
      await handleError(rawPayload, postId, error);
    }
  }
}
```

The `handleWorkflowOutcome` function is a pure mapping of workflow results to DB updates — no decision-making, just persistence:

```typescript
async function handleWorkflowOutcome(postId: string, result: ProcessLeadResult, rawPayload: string) {
  switch (result.outcome) {
    case 'below_threshold':
      await postRepository.saveScore(postId, result.qualityScore, PostStatus.BELOW_THRESHOLD);
      break;
    case 'not_a_lead':
      await postRepository.updateStatus(postId, PostStatus.NOT_A_LEAD);
      break;
    case 'claim_failed':
      await postRepository.markClaimFailed(postId, result.error);
      break;
    case 'completed':
      await postRepository.saveLeadResult(postId, result);
      if (result.triggerDeepResearch) {
        await searchRunQueue.enqueueDeepResearch(postId);
      }
      break;
  }
  await leadQueue.ack(rawPayload);
}
```

### 5.4 The Search Worker Loop

The search worker is similarly thin — it drives the workflow and handles I/O:

```typescript
async function runSearchWorkerLoop(workerRunId: string) {
  while (true) {
    const rawPayload = await searchRunQueue.reserveNext();
    if (!rawPayload) continue;

    const { searchRunId } = parsePayload(rawPayload);
    const runConfig = await runStateStore.get(searchRunId);

    let workflowState = { iteration: 0 };

    while (true) {
      // Invoke workflow — it tells us what to do next
      const result = await mastraClient.executeWorkflow('searchForLeadsWorkflow', {
        ...workflowState,
        runConfig,
        searchResults: workflowState.pendingSearchResults,
        scrapedPages: workflowState.pendingScrapedPages,
      });

      switch (result.outcome) {
        case 'awaiting_search':
          // Workflow gave us search terms → execute them
          const searchResults = await executeSearches(result.terms);
          workflowState = { ...result, pendingSearchResults: searchResults };
          break;

        case 'awaiting_scrape':
          // Workflow gave us promising URLs → scrape them
          const pages = await scrapeAndPersist(result.urls);
          workflowState = { ...result, pendingScrapedPages: pages };
          break;

        case 'no_more_terms':
        case 'max_leads_reached':
        case 'runtime_exceeded':
          await searchRunRepository.markCompleted(searchRunId, result.counters);
          await searchRunQueue.ack(rawPayload);
          return;
      }
    }
  }
}
```

---

## 6. Database Schema

The workers are the sole owner of Postgres — Mastra uses LibSQL internally and does not interact with these tables.

### Posts Table

| Column | Type | Change |
|---|---|---|
| `id` | `uuid` | preserved |
| `url` | `text` | preserved |
| `platform` | `varchar(50)` | preserved |
| `post` | `jsonb` | preserved |
| `status` | `varchar(50)` | preserved + new values |
| `quality_score` | `integer` | **added** (replaces `lead_probability`) |
| `why_fit` | `text` | preserved |
| `needs` | `text` | preserved |
| `timing` | `text` | preserved |
| `contact_info` | `text` | preserved |
| `budget` | `text` | **added** (from leadAnalysisWorkflow) |
| `company_name` | `text` | **added** (from leadAnalysisWorkflow) |
| `dorg_lead_id` | `text` | preserved |
| `deep_research_data` | `text` | **added** (markdown report) |
| `outreach_message` | `text` | **added** |
| `search_run_id` | `text` | **added** |
| `source` | `text` | **added** (`"search"` or `"manual"`) |
| `error_message` | `text` | preserved |
| `created_at` | `timestamp` | preserved |
| `updated_at` | `timestamp` | preserved |
| `lead_probability` | `float` | **removed** |
| `apify_run_id` | `text` | **removed** |
| `apify_dataset_id` | `text` | **removed** |

### New Tables: `search_runs`, `run_configuration`

```sql
CREATE TABLE search_runs (
  id          uuid PRIMARY KEY,
  status      varchar(50) NOT NULL DEFAULT 'running',
  config      jsonb NOT NULL,
  counters    jsonb NOT NULL DEFAULT '{}',
  started_at  timestamp NOT NULL DEFAULT now(),
  stopped_at  timestamp,
  error_message text,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE run_configuration (
  id                    integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  consultancy_config    jsonb NOT NULL DEFAULT '{}',
  auto_deep_research    boolean NOT NULL DEFAULT true,
  auto_message_gen      boolean NOT NULL DEFAULT true,
  deep_research_threshold integer NOT NULL DEFAULT 90,
  message_gen_threshold   integer NOT NULL DEFAULT 90,
  updated_at            timestamp NOT NULL DEFAULT now()
);
```

---

## 7. Post Status State Machine

```
PENDING → SCORING → [below_threshold | ANALYZING]
ANALYZING → [not_a_lead | CLAIMING]
CLAIMING → [claim_failed | SURFACING]
SURFACING → COMPLETED

After processLeadWorkflow returns triggerDeepResearch=true:
  → DEEP_RESEARCHING → COMPLETED

After deep research completes (and if autoMessageGen threshold met):
  → GENERATING_MESSAGE → MESSAGE_READY

Any state → ERROR
```

---

## 8. Configuration System

### 8.1 Static Configuration (env vars)

**gtm-workers env vars (leaner — no Apify, no dOrg):**
```
# Server
WORKERS_API_HOST=0.0.0.0
WORKERS_API_PORT=3000
TRIGGER_API_TOKEN=...

# Infrastructure
DATABASE_URL=postgres://...
REDIS_URL=redis://...

# Mastra
GTM_AI_BASE_URL=http://localhost:4111

# Serper
SERPER_API_KEY=...
SERPER_BASE_URL=https://google.serper.dev

# ContextDev
CONTEXT_DEV_API_KEY=...
CONTEXT_DEV_BASE_URL=https://api.context.dev

# Queue & Storage Keys
QUEUE_NAME=gtm:posts:queue
QUEUE_PROCESSING_NAME=gtm:posts:processing
QUEUE_DLQ_NAME=gtm:posts:dlq
SEARCH_QUEUE_NAME=gtm:search-runs:queue
PROCESSED_URLS_KEY=gtm:processed_urls
SEARCH_TERMS_SET_KEY=gtm:search-terms

# Worker
WORKER_CONCURRENCY=1
WORKER_POLL_TIMEOUT_SECONDS=20
WORKER_REQUEUE_STALE_ON_STARTUP=true
SEARCH_WORKER_CONCURRENCY=1
```

**gtm-ai env vars (now includes external API keys for tools):**
```
# Server
MASTRA_HOST=0.0.0.0
MASTRA_PORT=4111
MASTRA_LOG_LEVEL=info

# Models
GTM_SMALL_MODEL=ollama-cloud/gemma3:4b
GTM_ANALYSIS_MODEL=ollama-cloud/gemma4:31b
GTM_SEARCH_TERM_MODEL=ollama-cloud/gemma4:31b
GTM_SEARCH_FILTER_MODEL=ollama-cloud/gemma3:4b
GTM_DEEP_RESEARCH_MODEL=ollama-cloud/gemma4:31b
GTM_MESSAGE_GEN_MODEL=ollama-cloud/gemma4:31b
OLLAMA_API_KEY=...

# External APIs (for tools)
SERPER_API_KEY=...
SERPER_BASE_URL=https://google.serper.dev
CONTEXT_DEV_API_KEY=...
CONTEXT_DEV_BASE_URL=https://api.context.dev
DORG_API_TOKEN=...
DORG_API_BASE_URL=https://agentsofdorg.tech/api

# Storage
MASTRA_STORAGE_URL=file:./mastra.db
MASTRA_OBSERVABILITY_DB_PATH=./mastra-observability.db
```

Note: `DORG_API_*`, `SERPER_API_*`, and `CONTEXT_DEV_*` env vars now live in **both** services. gtm-ai needs them because tools call these APIs directly from workflows. gtm-workers needs `SERPER_*` and `CONTEXT_DEV_*` because the search worker loop executes searches and scrapes in batch (the `awaiting_search` / `awaiting_scrape` suspense pattern). dOrg calls happen entirely inside workflows via tools, so gtm-workers does **not** need dOrg env vars.

### 8.2 Runtime Configuration

Stored in `run_configuration` table + Redis `gtm:run-config` hash. Workers read config on each job iteration and pass it as `runConfig` to workflows. Changes take effect immediately without restart.

---

## 9. API Endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/healthz` | Health check | none |
| `POST` | `/search-runs` | Trigger a new search run | `TRIGGER_API_TOKEN` |
| `POST` | `/search-runs/:id/stop` | Stop a running search | `TRIGGER_API_TOKEN` |
| `GET` | `/search-runs/:id` | Get search run status | `TRIGGER_API_TOKEN` |
| `POST` | `/leads/:id/deep-research` | Manually trigger deep research | `TRIGGER_API_TOKEN` |
| `POST` | `/leads/:id/generate-message` | Manually trigger message gen | `TRIGGER_API_TOKEN` |
| `GET` | `/leads` | List leads (filterable by status, score) | `TRIGGER_API_TOKEN` |
| `GET` | `/leads/:id` | Get single lead with full data | `TRIGGER_API_TOKEN` |
| `PATCH` | `/configuration` | Update runtime config | `TRIGGER_API_TOKEN` |
| `GET` | `/configuration` | Get current config | `TRIGGER_API_TOKEN` |

---

## 10. Data Flow: End-to-End Lead Processing

```
                              ┌─────────────────────────┐
                              │   gtm-workers            │
                              │   Lead Worker Loop       │
                              └────────────┬────────────┘
                                           │
  1. BRPOPLPUSH gtm:posts:queue           │
     → { id: "uuid-123", platform: "reddit" }
                                           │
  2. Load post from Postgres              │
     Load runConfig from Redis             │
                                           │
  3. POST /api/workflows/processLeadWorkflow/execute
     ┌─────────────────────────────────────┼──────────────────────────┐
     │               gtm-ai                │                          │
     │                                     ▼                          │
     │  processLeadWorkflow.execute():                                │
     │                                                                 │
     │  Step 1: lead-score                                            │
     │    leadScoreAgent.generate(prompt, structuredOutput)            │
     │    → { qualityScore: 78 }                                      │
     │                                                                 │
     │  Step 2: normalize-score                                       │
     │    → { qualityScore: 78 }                                      │
     │                                                                 │
     │  Step 3: below-threshold-check                                 │
     │    78 >= 50 → continue                                         │
     │                                                                 │
     │  Step 4: lead-analysis                                         │
     │    leadAnalysisAgent.generate(prompt, structuredOutput)         │
     │    → { isLead: true, whyFit: "...", needs: "...", ... }        │
     │                                                                 │
     │  Step 5: not-a-lead-check                                      │
     │    isLead: true → continue                                     │
     │                                                                 │
     │  Step 6: claim-lead                                            │
     │    claimLeadTool.execute({ identifier: url, channel: "reddit" })│
     │    → { success: true, leadId: "dorg-lead-456" }                │
     │                                                                 │
     │  Step 7: build-surface-brief                                   │
     │    Construct formatted brief from analysis                     │
     │                                                                 │
     │  Step 8: surface-lead                                          │
     │    surfaceLeadTool.execute({ leadId: "dorg-lead-456", brief }) │
     │    → { success: true }                                         │
     │                                                                 │
     │  Step 9: notify-discord                                        │
     │    sendDiscordMessageTool.execute({ content: brief })           │
     │    → { success: true }                                         │
     │                                                                 │
     │  Step 10: post-completion-checks                               │
     │    78 >= 90? No → { outcome: "completed" }                     │
     │                                                                 │
     └─────────────────────────────────────────────────────────────────┘
                                           │
  4. Worker receives result               │
     → outcome: "completed"                │
     → Update Postgres: quality_score=78, status=COMPLETED,           │
       why_fit="...", needs="...", dorg_lead_id="dorg-lead-456"
     → LREM gtm:posts:processing (ack)                                │
                                           │
                                     Done. No more steps.
```

---

## 11. Provider Swap Interfaces

The `SearchProvider` and `PageScraper` interfaces live in **both** services:

- **gtm-ai**: Used by `searchWebTool` and `scrapePageTool` for synchronous tool calls within workflows.
- **gtm-workers**: Used by the search worker loop for batch search/scrape execution (the suspense pattern in `searchForLeadsWorkflow`). `deepResearchWorkflow` uses the agent-driven pattern — search/scrape happens inside gtm-ai tools, so workers do not need these clients for deep research.

The concrete implementations (`SerperApiClient`, `ContextDevClient`) can be shared via a small internal package or duplicated (they're thin wrappers — ~30 lines each). Given the Karpathy guidelines (no premature abstraction), they should be duplicated in each service until sharing becomes a clear win.

---

## 12. File Structure

### gtm-ai (new/modified)

```
gtm-ai/src/mastra/
├── index.ts                                    # Register everything
├── config/
│   └── app-env.ts                              # + Serper, ContextDev, dOrg env vars
├── agents/
│   ├── lead-score-agent.ts                     # Modified: 0–100, parameterized prompt
│   ├── lead-analysis-agent.ts                  # Modified: parameterized prompt
│   ├── search-term-agent.ts                    # New
│   ├── search-filter-agent.ts                  # New
│   ├── web-summarization-agent.ts              # New: summarizes scraped content (cheap model)
│   ├── evaluation-agent.ts                     # New: relevance + entity match checks
│   ├── learning-extraction-agent.ts            # New: extracts learnings + follow-up questions
│   ├── deep-research-agent.ts                  # New: tool-equipped, two-phase research
│   ├── report-agent.ts                         # New: synthesizes learnings into markdown report
│   └── message-generation-agent.ts             # New
├── tools/
│   ├── search-web.tool.ts                      # New: Serper API wrapper
│   ├── scrape-page.tool.ts                     # New: ContextDev wrapper + auto-summarization
│   ├── evaluate-result.tool.ts                 # New: relevance + entity match evaluation
│   ├── extract-learnings.tool.ts               # New: learning extraction + follow-up questions
│   ├── claim-lead.tool.ts                      # New: dOrg /leads/claim
│   ├── surface-lead.tool.ts                    # New: dOrg /leads/surface
│   └── send-discord-message.tool.ts            # New: dOrg /discord/post
├── workflows/
│   ├── lead-score-workflow.ts                  # Modified: 0–100 output
│   ├── lead-analysis-workflow.ts               # Modified: configurable
│   ├── process-lead-workflow.ts                # New: replaces ProcessPostJob
│   ├── search-for-leads-workflow.ts            # New: replaces SearchForLeads
│   ├── deep-research-workflow.ts               # New
│   └── generate-message-workflow.ts            # New
├── prompts/
│   ├── build-lead-score-prompt.ts              # Modified: accepts ConsultancyConfig
│   ├── build-lead-analysis-prompt.ts           # Modified: accepts ConsultancyConfig
│   ├── build-search-term-prompt.ts             # New
│   ├── build-search-filter-prompt.ts           # New
│   ├── build-deep-research-prompt.ts           # New
│   ├── build-message-generation-prompt.ts      # New
│   ├── build-surface-brief.ts                  # New (moved from workers)
│   ├── format-crawler-post-for-llm.ts          # Preserved
│   └── platform-formatters/                    # Preserved
├── schemas/
│   ├── crawler-post-input-schema.ts            # Preserved
│   ├── lead-score-result-schema.ts             # Modified: qualityScore
│   ├── lead-analysis-result-schema.ts          # Modified: +budget, +companyName
│   ├── process-lead-result-schema.ts           # New
│   ├── search-term-result-schema.ts            # New
│   ├── search-filter-result-schema.ts          # New
│   ├── deep-research-result-schema.ts          # New
│   ├── message-generation-result-schema.ts     # New
│   └── consultancy-config-schema.ts            # New
├── scorers/                                    # Updated for new schemas
├── observability/                              # Preserved
├── storage/                                    # Preserved
└── types/
    ├── gtm-request-context.ts                  # Modified
    └── consultancy-config.ts                   # New
```

### gtm-workers (slimmed down)

```
gtm-workers/src/
├── bin/
│   ├── api.ts
│   └── worker.ts
├── clients/
│   ├── mastra-client.ts                        # Thin HTTP wrapper (no retry logic)
│   ├── serper-api-client.ts                    # Thin Serper wrapper
│   └── context-dev-client.ts                   # Thin ContextDev wrapper
├── config/
│   └── app-env.ts
├── constants/
│   ├── post-status.ts
│   └── route-paths.ts
├── http/
│   ├── create-server.ts
│   ├── handle-health-request.ts
│   ├── handle-search-run-request.ts
│   ├── handle-lead-request.ts
│   └── handle-configuration-request.ts
├── schemas/
│   ├── queue-payload-schema.ts
│   ├── search-run-request-schema.ts
│   └── configuration-schema.ts
├── storage/
│   ├── database.ts
│   ├── migrate.ts
│   ├── lead-queue.ts
│   ├── search-run-queue.ts
│   ├── processed-url-store.ts
│   ├── search-term-store.ts
│   ├── run-state-store.ts
│   ├── repositories/
│   │   ├── post-repository.ts
│   │   ├── search-run-repository.ts
│   │   └── configuration-repository.ts
│   └── schema/
│       ├── posts-table.ts
│       ├── search-runs-table.ts
│       └── configuration-table.ts
└── worker/
    └── mark-post-error.ts
```

---

## 13. Key Design Decisions

| Decision | Rationale |
|---|---|
| **All orchestration logic moves to Mastra workflows** | Workers become a dumb pipe. Business rules (thresholds, auto-triggers, state transitions) live in one place — the workflows. This makes the system easier to test (workflows can be tested without Redis/Postgres), easier to change, and easier to understand. |
| **dOrg API calls become Mastra tools** | These are natural tool calls — "claim this lead", "surface this lead". Moving them to tools means the `processLeadWorkflow` can call them inline rather than having the worker make a separate HTTP call after the workflow completes. |
| **Search/Scrape use a suspense pattern in `searchForLeadsWorkflow`** | The workflow declares what it needs (`awaiting_search`, `awaiting_scrape`), and the worker does the heavy I/O in batch. This avoids the workflow making hundreds of sequential tool calls (slow + token-expensive) while keeping decision logic out of the worker. |
| **Deep research uses an agent-driven pattern (not suspense)** | Deep research has intentionally limited scope (~6–10 searches). The `deepResearchAgent` is equipped with tools and drives a two-phase research process autonomously — the worker just calls the workflow and gets back a finished report. The two-phase approach (initial searches → learnings → follow-up → stop) requires the agent to adapt based on findings, which the suspense pattern's upfront search generation cannot do. `maxSteps: 12` and content summarization via `webSummarizationAgent` keep token spend bounded. |
| **Workers retain Serper/ContextDev clients for batch execution** | Workflows use tools for synchronous single calls; workers need batch execution for the search loop. The thin clients are duplicated across services for now (30 lines each) — not worth a shared package yet. |
| **Workers remain the sole owner of Postgres** | Mastra uses LibSQL internally. Keeping Postgres in workers avoids schema conflicts and keeps a single source of truth for lead data. The CRM/management app will query the workers' API, not Mastra's. |
| **Runtime config flows as `runConfig` in every workflow call** | Agents rebuild their system prompts per execution using the config from `requestContext`. This makes config changes take effect instantly — no need to restart agents. |
| **No retry logic in workers' Mastra client** | Retry logic for transient failures belongs in Mastra's agent configuration (`maxRetries`, `maxProcessorRetries`). The worker's HTTP call to Mastra is a simple fetch — if it fails, the worker moves the message to the DLQ (the queue's BRPOPLPUSH guarantees no message loss). |
