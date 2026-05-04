# High Level Design Changes for Go-To-Market Agent V2

This is the plan for v2 of my lead generation agent, which will locate leads for my software development consultancy. This document outlines changes that will be made from the V1 high level design. The core design from V1 remains; we are adding features and reworking some things.

We will end support for apify. Also, the gtm-web-crawler package is no longer needed.

We will use a combination of the serper.dev SERP API (as the search provider) and context.dev (as the page scraper) to search the web and scrape web pages.

## Boundary Shift

We will shift the boundary between gtm-workers and gtm-ai. gtm-ai (Mastra) becomes the brain — it owns all orchestration logic, LLM calls, prompts, and external API access (via Mastra tools). gtm-workers becomes a thin infrastructure layer — it handles persistent queue consumption, concurrency, graceful shutdown, Redis data structures, Postgres persistence, and custom HTTP auth. Workers contain no business logic; they are a dumb pipe that dequeues messages, calls Mastra workflows, and persists the results.

The dOrg API will be accessed via Mastra tools (claimLead, surfaceLead, sendDiscordMessage) rather than a client class in workers.

## New Search Flow

    1. AI workflow creates a set of search terms with the format: { searchQuery: string; site: "reddit", startDateTime: "...", endDateTime: "..." }, where the actual site and datetimes are determined by input parameters and not by the LLM. Note that the search provider manager implementation will handle converting the start/end times to a time-based search (tbs) term.
        - the number of search terms to generate should be configurable
        - hashing each search term object and check/insert into individual Redis keys (`gtm:search-term:<hash>`) with per-key TTL based on the datetimes (Redis SETs don't support per-member TTL, so individual keys are used instead)
    2. for each generated search term, use search provider to search using the site and tbs parameters to specify the target site and time range.
    3. filters search results by checking URLs against bloom filter (redis set) to avoid duplication
    4. filters remaining search results based on likelihood that result might be a lead (using the basic description from the search results returned by the SERP API). The AI assigns a probability score (0–1) to each result, and results below a configurable threshold (e.g., 0.3) are discarded.
        - the probability threshold should be configurable so we can tune the aggressiveness of filtering
        - we should be able to configure this prompt so that it works for other kinds of consultancies as well
        - we do not need to save unpromising search results in any persisted storage
    5. Use context.dev to scrape web pages from search result URLs that were identified as potential leads. The scraped content is summarized by an AI agent that extracts the core relevant post content while dropping irrelevant junk (navigation, ads, sidebar, etc.). The summarized content becomes the "post" for downstream lead processing. Add the extracted post to the processed-URLs bloom filter (redis set).

The search is orchestrated by a Mastra workflow (`search-for-leads-workflow`) that calls tools directly from workflow steps (via `tool.execute()`). The workflow generates a fixed batch of search terms and executes them in a single pass — it does not loop back to generate more terms based on results. The worker simply invokes the workflow and persists the results. Additional coverage is achieved by enqueuing new search runs, not by iterating within a single run.

Redis-based dedup (search term hashes and processed URLs) is accessed via Mastra tools (`dedupSearchTermTool`, `dedupProcessedUrlTool`), keeping all dedup logic inside the workflow where it belongs.

## Enhanced Lead Processing

We will keep the original worker and AI workflows, and rework them so that all orchestration moves into Mastra:

1. A new `process-lead-workflow` in Mastra orchestrates the scoring, analysis, and claiming pipeline: score → normalize → threshold check → analyze → claim → post-completion checks. The worker invokes this workflow and persists the outcome. If the lead qualifies (probability score >= configurable minimum), it is claimed in dOrg via `claimLeadTool`. If the probability score also meets the deep research threshold, the lead is enqueued for deep research. Leads whose probability score is below the deep research threshold are not surfaced until a human manually reviews them and triggers deep research. Surfacing happens after `deep-research-workflow` completes, via `surface-lead-workflow` (called by the worker).
2. checks content from each scraped webpage to verify whether or not it is a lead. Scores the lead on a probability scale of 0-1, where 0 means definitely not a lead and 1 means definitely a lead.
- we should be able to inject terms into the prompt that help configure how the results are filtered, like "if budget is mentioned, must have > $50k budget"
- we should be able to configure this prompt so that it works for other kinds of consultancies as well
- worker updates postgres db
3. For each lead with a probability score above the configurable minimum, extract all useful information with structured output. The workflow claims the lead in dOrg via `claimLeadTool`. The worker updates Postgres with the analysis results and dOrg lead ID, and sets status to `AWAITING_RESEARCH`. If the probability score is at or above the deep research threshold (and auto-deep-research is enabled), the lead is also enqueued for deep research. If the probability score is below the deep research threshold, the lead is left in `AWAITING_RESEARCH` for manual review — deep research and surfacing happen only after a human manually triggers deep research. Surfacing happens after `deep-research-workflow` completes — the worker calls `surface-lead-workflow` which builds a comprehensive markdown brief including the lead analysis, deep research report, and draft outreach message.

## Deep Research

There should be a new ai workflow to do deep research on a lead. It uses an **agent-driven pattern** (inspired by the Mastra deep research template) where the deep research agent is equipped with tools and drives the research autonomously — no worker coordination needed during the research process. The worker simply invokes the workflow and receives a finished report.

This is implemented as a Mastra workflow (`deep-research-workflow`) with two steps:

1. **Execute Deep Research** — The `deepResearchAgent` (equipped with `searchWebTool`, `scrapePageTool`, `evaluateResultTool`, and `extractLearningsTool`) uses a two-phase approach:
    - **Phase 1 — Initial Research**: Breaks down the lead into 2–3 focused search queries based on base lead information (e.g., find LinkedIn profiles, company contact info, funding data). For each query, the agent searches, scrapes relevant pages (auto-summarized to prevent token blowup), evaluates relevance and entity match, and extracts key learnings with follow-up questions.
    - **Phase 2 — Follow-up Research**: Collects all follow-up questions from Phase 1 and searches each one. Scrapes, evaluates, and extracts learnings from results. Stops after Phase 2 — no infinite loops.
    - Entity verification is built into the evaluation tool (e.g., a startup named "Apex" must not be confused with the Apex programming language).
    - `maxSteps: 12` provides a hard token/time budget.
    - The agent always includes the user's social profile if the lead source is a social post.
2. **Synthesize Report** — A dedicated `reportAgent` transforms all extracted learnings, evaluations, and source URLs into a polished, structured markdown report with executive summary, key findings (contact info, company size, budget, business strategy), source references, and confidence assessment.

The lead was already claimed in dOrg during `process-lead-workflow`, so the dOrg lead ID is available from the start. The worker invokes the workflow and persists the finished report.

After `deep-research-workflow` completes, the **worker** orchestrates the remaining steps:
- If automatic message generation is enabled and the lead's probability score meets the message gen threshold, the worker calls `generate-message-workflow` to generate an outreach message.
- The worker then calls `surface-lead-workflow` to build a comprehensive markdown brief (including lead analysis, deep research report, and draft outreach message if available) and surface it via `surfaceLeadTool`, then notify Discord via `sendDiscordMessageTool`.

The number of search terms and search results is limited by the two-phase structure and `maxSteps` to keep token spend under control. A `webSummarizationAgent` summarizes all scraped page content (reducing by 80–95%) before it reaches the research agent's context window.

## Message Generation

There is a `generate-message-workflow` that constructs a high-conversion message for initial outreach to a lead:
1. it should use all available information, which may or may not include a deep research report
2. worker will add the message to the lead entry in the db
3. message generation can be triggered manually (via `POST /leads/:id/generate-message`) or automatically — after `deep-research-workflow` completes, the worker checks whether auto-message-gen is enabled and the probability score meets the threshold, then calls `generate-message-workflow`

## Automation & Manual Control

It should be possible to make deep research and message generation automatically trigger for leads with probability scores greater than or equal to a specified value. The deep research threshold is checked inside `process-lead-workflow`; the message generation threshold is checked by the worker after deep research completes and before calling `generate-message-workflow`.

It should be possible to trigger the new search flow, the new deep research flow, and the new message generation flows manually.

It should be possible for the process to essentially run in a loop, with the ability to control runs with stopping parameters defined in the runtime configuration. These parameters include:
  - `maxDurationMinutes`: maximum time a search run can execute before stopping
  - `maxSearchResults`: maximum number of search results to process before stopping
  - `maxLeads`: maximum number of leads to generate before stopping
As in v1, the workers must track the run state properly and handle graceful shutdown and startup.

A human should be able to adjust the agent's configuration and monitor it while it is running. (e.g., adjust tbs, turn off automatic deep research, turn off automatic message generation, request shutdown/stoppage). The agent will be configurable and monitored through a web/mobile app that we will create after the agent. The app will be used to control the agent like a remote control and view its results. The app will also operate like a CRM, serving as a bridge between the AI agent and human handoff. So we need to make sure the endpoints are available to view leads, filter by their state, request deep research, etc.

Use interfaces to make sure it is easy to replace serp api and context.dev with alternatives later on if we want to (and to swap back as well)
- note that different search providers might handle site and tbs parameters differently, so the interface and implementation needs to be able to handle this
