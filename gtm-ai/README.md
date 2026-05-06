# gtm-ai

AI-powered lead discovery and qualification service for [dOrg](https://dorg.tech)'s tech and development consultancy. Built with [Mastra](https://mastra.ai).

## Architecture

The service composes four agents, four workflows, two tools, and one scorer into a single Mastra instance. Two models are used — a fast model for lightweight scoring and filtering, and a capable model for deep analysis.

```
Models            Agents               Workflows                     Tools
──────────        ──────               ─────────                     ─────
GTM_SCORE_MODEL → leadScoreAgent    → leadScoreWorkflow
GTM_ANALYSIS_MODEL→ leadAnalysisAgent → leadAnalysisWorkflow         searchWebTool
GTM_SEARCH_TERM  → searchTermAgent  → searchTermGenerationWorkflow   scrapePageTool
GTM_SEARCH_FILTER→ searchFilterAgent → searchAndFilterWorkflow
```

Storage is layered: LibSQL for Mastra state, DuckDB for observability traces, and Redis for URL deduplication.

## Workflows

### `leadScoreWorkflow`

Fast pre-filter. Estimates whether a post is a lead before running the more expensive analysis.

| Field | Value |
|-------|-------|
| **Workflow ID** | `leadScoreWorkflow` |
| **Input** | [`LeadInput`](#leadinput) |
| **Output** | `{ leadProbability: number }` |
| **Model** | `GTM_SCORE_MODEL` |
| **Threshold** | `0.7` — skip analysis if below |

### `leadAnalysisWorkflow`

Deep analysis of a single post. Determines if it's a lead and extracts structured detail.

| Field | Value |
|-------|-------|
| **Workflow ID** | `leadAnalysisWorkflow` |
| **Input** | [`LeadInput`](#leadinput) |
| **Output** | `{ isLead: false }` or `{ isLead: true, whyFit: string, needs: string, timing: string \| null, contactInfo: string }` |
| **Model** | `GTM_ANALYSIS_MODEL` |

### `searchTermGenerationWorkflow`

Generates search queries tailored to a platform and target description. Used to seed the search-and-filter pipeline.

| Field | Value |
|-------|-------|
| **Workflow ID** | `searchTermGenerationWorkflow` |
| **Input** | `{ numberOfSearchTerms: number, sourceUrl: string, targetDescription: string }` |
| **Output** | `{ queries: string[] }` |
| **Model** | `GTM_SEARCH_TERM_MODEL` |

### `searchAndFilterWorkflow`

End-to-end pipeline: search → filter → scrape → extract. Finds leads on a target platform and returns clean, deduplicated content.

| Field | Value |
|-------|-------|
| **Workflow ID** | `searchAndFilterWorkflow` |
| **State** | `{ searchQuery, sourceUrl, startDateTime, endDateTime, pages, targetDescription }` |
| **Output** | `{ leads: Array<{ url: string, content: string }> }` |
| **Models** | `GTM_SEARCH_FILTER_MODEL` |

**Steps:**

1. **execute-search** — Searches via [Serper](https://serper.dev) across the configured page count, deduplicating URLs against a Redis SET.
2. **filter-results** — The agent scores each result by title and snippet, returning only promising URLs.
3. **scrape-leads** — Fetches full page content in Markdown via [Context.dev](https://context.dev).
4. **extract-relevant-content** — The agent trims irrelevant content from each scraped page, returning clean lead text.

## Tools

Two tools wrap external API providers. They are available to agents that need them.

| Tool | ID | Description |
|------|----|-------------|
| `searchWebTool` | `search-web` | Searches a site with date-range filtering via Serper |
| `scrapePageTool` | `scrape-page` | Scrapes a URL to GitHub Flavored Markdown via Context.dev |

## Scorer

| Scorer | ID | Description |
|--------|----|-------------|
| `leadAnalysisCompletenessScorer` | `lead-analysis-completeness` | If `isLead: false` → score 1. If `isLead: true` → score 1 only when `whyFit` > 10 chars and `needs` > 5 chars, otherwise 0. |

## Types

### LeadInput

```typescript
{
  id: string;               // UUID
  platform: string;         // e.g. "reddit", "x"
  url: string;              // Full URL to the source post
  content: Record<string, unknown>;  // Arbitrary post content
  targetDescription: string;         // What dOrg is looking for
}
```

### RequestContext

Attach a `requestContext` to any workflow execution for tracing:

```typescript
{
  postId: string;
  platform: string;
  source: 'worker' | 'studio' | 'manual-test';
  workerRunId?: string | null;
}
```

## Configuration

All configuration is environment-driven. The Zod schema in `src/mastra/config/app-env.ts` validates at startup and provides defaults.

### Required

| Variable | Purpose |
|----------|---------|
| `SERPER_API_KEY` | Serper Google search API key |
| `CONTEXT_DEV_API_KEY` | Context.dev web scraping API key |
| `REDIS_URL` | Redis connection string for URL deduplication |

### Models

Each agent can target a different model provider and model. To switch providers, change the string (e.g. `openai/gpt-4o`, `anthropic/claude-sonnet-4-6`, `deepseek/deepseek-v4-flash`).

| Variable | Default | Used by |
|----------|---------|---------|
| `GTM_SCORE_MODEL` | `ollama-cloud/gemma4:31b` | `leadScoreAgent` |
| `GTM_ANALYSIS_MODEL` | `ollama-cloud/gemma4:31b` | `leadAnalysisAgent` |
| `GTM_SEARCH_TERM_MODEL` | `ollama-cloud/gemma4:31b` | `searchTermAgent` |
| `GTM_SEARCH_FILTER_MODEL` | `ollama-cloud/gemma4:31b` | `searchFilterAgent` |

### Provider API keys

| Variable | Required | Purpose |
|----------|----------|---------|
| `OLLAMA_API_KEY` | If using Ollama Cloud models | Ollama Cloud authentication |
| `DEEPSEEK_API_KEY` | If using DeepSeek models | DeepSeek authentication |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `MASTRA_HOST` | `0.0.0.0` | Server bind address |
| `MASTRA_PORT` | `4111` | Server port |
| `MASTRA_LOG_LEVEL` | `info` | One of `debug`, `info`, `warn`, `error` |
| `MASTRA_STORAGE_URL` | `file:./mastra.db` | LibSQL URL for Mastra state |
| `MASTRA_OBSERVABILITY_DB_PATH` | `./mastra-observability.db` | DuckDB path for traces |
| `MASTRA_CLOUD_ACCESS_TOKEN` | — | Enables Mastra Cloud trace export |
| `URLS_DEDUP_KEY` | `gtm:urls_dedup` | Redis SET key for URL deduplication |

## Usage

### Running a workflow

```typescript
import { mastra } from './src/mastra';

// ── Scoring ──────────────────────────────────────
const score = await mastra.getWorkflow('leadScoreWorkflow').execute({
  inputData: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    url: 'https://reddit.com/r/ethdev/comments/abc123',
    content: {
      title: 'Looking for solidity dev shop',
      body: 'We need a team to build our DAO governance contracts...',
    },
    targetDescription: 'dOrg is a tech consultancy specializing in Web3...',
  },
  requestContext: {
    postId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'reddit',
    source: 'worker',
  },
});

if (score.leadProbability >= 0.7) {
  // Worth a deeper look
}
```

### Worker integration

Services consuming this one (e.g. `gtm-workers`) should:

1. Score with `leadScoreWorkflow` first.
2. Skip if `leadProbability < 0.7`.
3. Analyze with `leadAnalysisWorkflow` if above threshold.

```typescript
const { leadProbability } = await mastra.getWorkflow('leadScoreWorkflow').execute({
  inputData: post,
  requestContext: { postId: post.id, platform: post.platform, source: 'worker' },
});

if (leadProbability < 0.7) return;

const analysis = await mastra.getWorkflow('leadAnalysisWorkflow').execute({
  inputData: post,
  requestContext: { postId: post.id, platform: post.platform, source: 'worker' },
});

if (analysis.isLead) {
  // analysis.whyFit, analysis.needs, analysis.timing, analysis.contactInfo
}
```

### Generating search terms

```typescript
const { queries } = await mastra.getWorkflow('searchTermGenerationWorkflow').execute({
  inputData: {
    numberOfSearchTerms: 5,
    sourceUrl: 'https://reddit.com',
    targetDescription: 'dOrg is a tech consultancy specializing in Web3 development...',
  },
});
```

### Running the search-and-filter pipeline

```typescript
const { leads } = await mastra.getWorkflow('searchAndFilterWorkflow').execute({
  inputData: {},
  state: {
    searchQuery: 'looking for solidity developer',
    sourceUrl: 'https://reddit.com',
    startDateTime: '2026-04-01',
    endDateTime: '2026-05-01',
    pages: 2,
    targetDescription: 'dOrg is a tech consultancy...',
  },
});

for (const lead of leads) {
  console.log(lead.url, lead.content.slice(0, 200));
}
```

## Getting started

```shell
# Install dependencies
bun install

# Copy and fill in the environment
cp .env.example .env

# Start the dev server
bun run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio — an interactive UI for building, testing, and debugging workflows and agents.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Mastra dev server with hot reload |
| `bun run build` | Build for production |
| `bun run start` | Start the production server |

## Deploy

Build and run with Docker:

```shell
docker build -t gtm-ai .
docker run --env-file .env -p 4111:4111 gtm-ai
```

For managed hosting, see [Mastra Cloud](https://mastra.ai/docs/deployment/overview).

## Resources

- [Mastra documentation](https://mastra.ai/docs/)
- [Mastra course](https://mastra.ai/course)
- [Mastra Discord](https://discord.gg/BTYqqHKUrf)
