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
        - hashing each search term object and check/insert into a bloom filter (redis set) with an expiration timer based on the datetimes
    2. for each generated search term, use search provider to search using the site and tbs parameters to specify the target site and time range.
    3. filters search results by checking URLs against bloom filter (redis set) to avoid duplication
    4. filters remaining search results based on likelihood that result might be a lead (using the basic description from the search results returned by the SERP API)
        - we should be able to configure this prompt so that it works for other kinds of consultancies as well
        - we do not need to save unpromising search results in any persisted storage
    5. Use context.dev to scrape web pages from search result URLs that were identified as potential leads; adds to postgres db, redis queue, bloom filter (redis set)

The search is orchestrated by a Mastra workflow (searchForLeadsWorkflow) that calls tools directly from workflow steps (via `tool.execute()`). The workflow generates a fixed batch of search terms and executes them in a single pass — it does not loop back to generate more terms based on results. The worker simply invokes the workflow and persists the results. Additional coverage is achieved by enqueuing new search runs, not by iterating within a single run.

Redis-based dedup (search term hashes and processed URLs) is accessed via Mastra tools (`dedupSearchTermTool`, `dedupProcessedUrlTool`), keeping all dedup logic inside the workflow where it belongs.

## Enhanced Lead Processing

We will keep the original worker and AI workflows, and rework them so that all orchestration moves into Mastra:

1. A new `processLeadWorkflow` in Mastra orchestrates the full pipeline: score → normalize → threshold check → analyze → claim → surface → notify → post-completion checks. The worker just invokes this workflow and persists the outcome.
2. checks content from each scraped webpage to verify whether or not it is a lead. Scores the lead on a quality scale of 0-100, where 0 is not a lead and 100 is high-quality lead.
- we should be able to inject terms into the prompt that help configure how the results are filtered, like "if budget is mentioned, must have > $50k budget"
- we should be able to configure this prompt so that it works for other kinds of consultancies as well
- worker updates postgres db
3. For each lead with a quality score above 50 (configurable), extract all useful information with structured output
- worker updates postgresql database, claims and surfaces lead with dOrg API (via Mastra tools)

## Deep Research

There should be a new ai workflow to do deep research on a lead. It uses an **agent-driven pattern** (inspired by the Mastra deep research template) where the deep research agent is equipped with tools and drives the research autonomously — no worker coordination needed during the research process. The worker simply invokes the workflow and receives a finished report.

This is implemented as a single Mastra workflow (`deepResearchWorkflow`) with two steps:

1. **Execute Deep Research** — The `deepResearchAgent` (equipped with `searchWebTool`, `scrapePageTool`, `evaluateResultTool`, and `extractLearningsTool`) uses a two-phase approach:
    - **Phase 1 — Initial Research**: Breaks down the lead into 2–3 focused search queries based on base lead information (e.g., find LinkedIn profiles, company contact info, funding data). For each query, the agent searches, scrapes relevant pages (auto-summarized to prevent token blowup), evaluates relevance and entity match, and extracts key learnings with follow-up questions.
    - **Phase 2 — Follow-up Research**: Collects all follow-up questions from Phase 1 and searches each one. Scrapes, evaluates, and extracts learnings from results. Stops after Phase 2 — no infinite loops.
    - Entity verification is built into the evaluation tool (e.g., a startup named "Apex" must not be confused with the Apex programming language).
    - `maxSteps: 12` provides a hard token/time budget.
    - The agent always includes the user's social profile if the lead source is a social post.
2. **Synthesize Report** — A dedicated `reportAgent` transforms all extracted learnings, evaluations, and source URLs into a polished, structured markdown report with executive summary, key findings (contact info, company size, budget, business strategy), source references, and confidence assessment.

3. worker will update lead in db with the markdown report

The number of search terms and search results is limited by the two-phase structure and `maxSteps` to keep token spend under control. A `webSummarizationAgent` summarizes all scraped page content (reducing by 80–95%) before it reaches the research agent's context window.

## Message Generation

There should be a new ai workflow to construct a high-conversion message to send to a lead for initial outreach:
1. it should use all available information, which may or may not include a deep research report
2. worker will add to lead entry in db

## Automation & Manual Control

It should be possible to make deep research and message generation automatically trigger for leads with quality scores greater than or equal to a specified value, such as 90. These thresholds are checked inside the processLeadWorkflow in Mastra.

It should be possible to trigger the new search flow, the new deep research flow, and the new message generation flows manually.

It should be possible for the process to essentially run in a loop, with the ability to control runs with stopping parameters (defined in the request). The parameters might include how long it should run for, how many search results to process before stopping, and how many leads to generate before stopping. As in v1, the workers must track the run state properly and handle graceful shutdown and startup.

A human should be able to adjust the agent's configuration and monitor it while it is running. (e.g., adjust tbs, turn off automatic deep research, turn off automatic message generation, request shutdown/stoppage). The agent will be configurable and monitored through a web/mobile app that we will create after the agent. The app will be used to control the agent like a remote control and view its results. The app will also operate like a CRM, serving as a bridge between the AI agent and human handoff. So we need to make sure the endpoints are available to view leads, filter by their state, request deep research, etc.

Use interfaces to make sure it is easy to replace serp api and context.dev with alternatives later on if we want to (and to swap back as well)
- note that different search providers might handle site and tbs parameters differently, so the interface and implementation needs to be able to handle this
