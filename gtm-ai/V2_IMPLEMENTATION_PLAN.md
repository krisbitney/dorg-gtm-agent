# GTM AI V2 Implementation Plan

This plan covers the `gtm-ai` implementation for v2 of the lead generation AI system. Track progress by checking off each task as it is completed. If implementation reveals smaller tasks, add nested checkboxes under the relevant milestone.

The AI service should own Mastra agents, workflows, prompts, schemas, structured outputs, and evaluation. It should not own database writes, Redis dedupe, search provider calls, page scraper calls, dOrg API calls, or run orchestration. Those responsibilities belong to `gtm-workers`.

Before implementing Mastra code, consult the local Mastra skill and installed package documentation so the workflow, agent, tool, and schema APIs match the version in this project.

## Success Criteria

- [ ] Existing `leadScoreWorkflow` and `leadAnalysisWorkflow` remain available for v1 and Apify-compatible processing.
- [ ] A new search term generation workflow creates configurable search query objects while treating site and datetime values as worker-controlled inputs.
- [ ] A new search result prefilter workflow evaluates SERP result title and snippet before any page is scraped.
- [ ] The lead verification workflow scores scraped content on a 0-100 quality scale.
- [ ] The structured extraction workflow extracts useful lead information only for leads above the worker-configured threshold.
- [ ] The deep research workflow family can plan searches, verify entity matches, and synthesize a concise research report from verified evidence.
- [ ] The outreach message workflow can generate a high-conversion initial message using all available lead information.
- [ ] Prompts are configurable enough to support dOrg and other software consultancies without editing core workflow code.
- [ ] All workflow inputs and outputs are validated with explicit Zod schemas.

## Phase 1: Confirm Current Mastra Patterns

- [ ] Review the existing Mastra structure:
  - [ ] `src/mastra/index.ts`;
  - [ ] `src/mastra/workflows/lead-score-workflow.ts`;
  - [ ] `src/mastra/workflows/lead-analysis-workflow.ts`;
  - [ ] `src/mastra/agents/lead-score-agent.ts`;
  - [ ] `src/mastra/agents/lead-analysis-agent.ts`;
  - [ ] `src/mastra/prompts`;
  - [ ] `src/mastra/schemas`;
  - [ ] `src/mastra/scorers`;
  - [ ] existing unit tests.
- [ ] Verify current Mastra workflow and agent APIs against installed docs before writing code.
- [ ] Decide whether each v2 capability should be a separate workflow or a composed workflow. Prefer separate workflows for worker-controlled orchestration:
  - [ ] `searchTermGenerationWorkflow`;
  - [ ] `searchResultPrefilterWorkflow`;
  - [ ] `leadVerificationWorkflow`;
  - [ ] `leadExtractionWorkflow`;
  - [ ] `deepResearchSearchPlanningWorkflow`;
  - [ ] `deepResearchResultVerificationWorkflow`;
  - [ ] `deepResearchSynthesisWorkflow`;
  - [ ] `outreachMessageGenerationWorkflow`.
- [ ] Keep v1 workflows registered in `src/mastra/index.ts` so workers and tests that depend on them do not break.
- [ ] Define the shared request context fields workers should pass to every workflow:
  - [ ] `runId`;
  - [ ] `leadId`;
  - [ ] `searchTermId`;
  - [ ] `searchResultId`;
  - [ ] `platform` or `site`;
  - [ ] `source`;
  - [ ] `workerRunId` if still used by v1 code.

## Phase 2: Add Shared V2 Schemas

- [ ] Create shared schema files for v2 workflow inputs and outputs under `src/mastra/schemas`.
- [ ] Define `ConsultancyProfileSchema`:
  - [ ] consultancy name;
  - [ ] services offered;
  - [ ] ideal customer profile;
  - [ ] target industries;
  - [ ] exclusion criteria;
  - [ ] qualification rules;
  - [ ] budget rules;
  - [ ] geographic or timezone preferences;
  - [ ] tone and positioning guidance.
- [ ] Define `SearchTermGenerationInputSchema`:
  - [ ] target site;
  - [ ] start datetime;
  - [ ] end datetime;
  - [ ] number of terms to generate;
  - [ ] consultancy profile;
  - [ ] optional seed topics;
  - [ ] optional negative topics.
- [ ] Define `SearchTermSchema` with exactly:
  - [ ] `searchQuery: string`;
  - [ ] `site: "reddit"` initially, but keep the enum easy to extend;
  - [ ] `startDateTime: string`;
  - [ ] `endDateTime: string`.
- [ ] Add schema descriptions or comments making it clear that workers, not the LLM, determine `site`, `startDateTime`, and `endDateTime`.
- [ ] Define `SearchResultPrefilterInputSchema`:
  - [ ] URL;
  - [ ] title;
  - [ ] snippet or description;
  - [ ] site;
  - [ ] search query;
  - [ ] consultancy profile;
  - [ ] configurable prompt terms.
- [ ] Define `SearchResultPrefilterOutputSchema`:
  - [ ] `isPotentialLead: boolean`;
  - [ ] `confidence: number`;
  - [ ] `rationale: string`;
  - [ ] optional `detectedNeed`;
  - [ ] optional `riskFlags`.
- [ ] Define `ScrapedPageLeadInputSchema`:
  - [ ] source URL;
  - [ ] canonical URL;
  - [ ] title;
  - [ ] normalized text;
  - [ ] metadata;
  - [ ] source site;
  - [ ] source search query if available;
  - [ ] consultancy profile;
  - [ ] configurable qualification terms.
- [ ] Define `LeadVerificationOutputSchema`:
  - [ ] `isLead: boolean`;
  - [ ] `qualityScore: number` from 0 to 100;
  - [ ] `rationale: string`;
  - [ ] `disqualifyingReasons: string[]`;
  - [ ] `evidence: string[]`.
- [ ] Define `LeadExtractionOutputSchema`:
  - [ ] requester identity;
  - [ ] company or organization;
  - [ ] role;
  - [ ] stated need;
  - [ ] why the consultancy is a fit;
  - [ ] timing;
  - [ ] budget;
  - [ ] decision process;
  - [ ] contact information;
  - [ ] project type;
  - [ ] urgency;
  - [ ] recommended next action;
  - [ ] supporting evidence.
- [ ] Define deep research planning, result verification, synthesis, and outreach message schemas before implementing prompts.
- [ ] Add schema unit tests for valid payloads, invalid payloads, threshold boundaries, and missing optional data.

## Phase 3: Implement Prompt Configuration

- [ ] Create prompt builder utilities that receive the consultancy profile and task-specific prompt terms as typed inputs.
- [ ] Make prompts configurable for other software consultancies without changing workflow code:
  - [ ] services;
  - [ ] ideal customer profile;
  - [ ] positive lead signals;
  - [ ] negative lead signals;
  - [ ] budget requirements;
  - [ ] preferred project sizes;
  - [ ] industries or communities;
  - [ ] outreach tone.
- [ ] Add explicit dOrg defaults in test fixtures or example configuration, not hardcoded inside generic prompt logic.
- [ ] For budget-sensitive filters, support prompt terms such as: "if budget is mentioned, it must be greater than $50k."
- [ ] In every prompt, require the model to cite evidence from the input text when making a positive decision.
- [ ] In every prompt, require the model to be conservative when evidence is weak.
- [ ] Add prompt tests that snapshot or assert important sections are present:
  - [ ] consultancy profile;
  - [ ] configurable qualification terms;
  - [ ] evidence requirement;
  - [ ] structured output instructions;
  - [ ] anti-hallucination instructions.

## Phase 4: Search Term Generation Workflow

- [ ] Create a `search-term-generation-agent` or reuse a generic planning agent if that pattern already exists.
- [ ] Create `searchTermGenerationWorkflow`.
- [ ] Input should include target site, datetime range, requested count, seed topics, negative topics, and consultancy profile.
- [ ] The LLM should generate only the `searchQuery` content.
- [ ] The workflow or a deterministic post-processing step should set or validate:
  - [ ] `site` from input;
  - [ ] `startDateTime` from input;
  - [ ] `endDateTime` from input.
- [ ] Enforce the configured number of search terms:
  - [ ] if too many are returned, trim deterministically;
  - [ ] if too few are returned, either accept the smaller set or run one repair step with a strict limit.
- [ ] Reject vague, empty, duplicated, or overly broad search queries.
- [ ] Include Reddit-oriented query examples for dOrg, such as users asking for development help, audits, MVP builds, smart contract work, product builds, or technical cofounder alternatives.
- [ ] Do not include `site:` operators or time filters in `searchQuery`; the worker search provider manager handles site and time parameters.
- [ ] Output a list of `{ searchQuery, site, startDateTime, endDateTime }`.
- [ ] Add tests proving the workflow preserves worker-controlled site and datetime values even if the model output tries to alter them.

## Phase 5: Search Result Prefilter Workflow

- [ ] Create `search-result-prefilter-agent`.
- [ ] Create `searchResultPrefilterWorkflow`.
- [ ] Input should use only SERP result data: URL, title, snippet, search query, site, consultancy profile, and prompt terms.
- [ ] The workflow should decide whether a result is worth scraping.
- [ ] The prompt should favor recall enough to avoid missing likely leads but reject obvious noise:
  - [ ] job seekers;
  - [ ] tutorial content;
  - [ ] unrelated product marketing;
  - [ ] old generic discussions;
  - [ ] results with no buying intent or project need.
- [ ] Output `isPotentialLead`, confidence, rationale, detected need, and risk flags.
- [ ] Add fixture tests for:
  - [ ] likely Reddit lead snippets;
  - [ ] ambiguous snippets;
  - [ ] non-lead snippets;
  - [ ] consultancy profile changes.

## Phase 6: Lead Verification And Quality Scoring

- [ ] Create `lead-verification-agent`.
- [ ] Create `leadVerificationWorkflow`.
- [ ] Input should be normalized scraped page content plus source metadata and consultancy profile.
- [ ] Score lead quality from 0 to 100:
  - [ ] 0 means not a lead;
  - [ ] 1-49 means weak or unlikely lead;
  - [ ] 50-74 means plausible lead with incomplete information;
  - [ ] 75-89 means strong lead;
  - [ ] 90-100 means very high-quality lead suitable for automatic deep research and message generation if enabled.
- [ ] Make the threshold a worker-side decision. The workflow outputs the score; workers decide whether to continue.
- [ ] Include prompt logic for configurable qualification rules, including budget constraints.
- [ ] Require evidence quotes or concise evidence summaries for positive scores.
- [ ] Require disqualifying reasons for low scores.
- [ ] Add tests for score boundaries, budget rule behavior, and cases where the content is related to software but not a buying signal.

## Phase 7: Structured Lead Extraction

- [ ] Create `lead-extraction-agent`.
- [ ] Create `leadExtractionWorkflow`.
- [ ] Input should include the scraped content, verification result, source metadata, and consultancy profile.
- [ ] Extract all useful information that can help a human qualify or contact the lead.
- [ ] Use structured output and avoid free-form blobs for fields that the CRM UI will filter on.
- [ ] Include confidence or evidence fields for important extracted values such as budget, timing, contact info, and company.
- [ ] Return null or empty arrays for unknown values instead of inventing details.
- [ ] Include an `recommendedNextAction` field suitable for the worker to surface with the lead.
- [ ] Add tests for complete, partial, and sparse lead content.

## Phase 8: Improve Existing V1 Workflows

- [ ] Keep `leadScoreWorkflow` registered and compatible with existing workers.
- [ ] Consider adapting `leadScoreWorkflow` internals to share prompt rules with `leadVerificationWorkflow`, while preserving the `{ leadProbability: number }` output.
- [ ] Keep `leadAnalysisWorkflow` registered and compatible with existing workers.
- [ ] Consider adapting `leadAnalysisWorkflow` internals to share extraction logic with `leadExtractionWorkflow`, while preserving the existing output shape.
- [ ] Keep current platform formatters for Reddit and Twitter unless the worker input contract changes.
- [ ] Add regression tests using existing positive and negative fixtures.

## Phase 9: Deep Research Search Planning

- [ ] Create `deep-research-search-planning-agent`.
- [ ] Create `deepResearchSearchPlanningWorkflow`.
- [ ] Input should include:
  - [ ] base lead details;
  - [ ] source URL and source site;
  - [ ] extracted requester identity;
  - [ ] company or organization;
  - [ ] known contact information;
  - [ ] max search term count;
  - [ ] max result count per term;
  - [ ] consultancy profile.
- [ ] Output a limited list of research search plans.
- [ ] Include anchors for:
  - [ ] LinkedIn;
  - [ ] public company websites;
  - [ ] public company databases;
  - [ ] ZoomInfo-like publicly accessible pages;
  - [ ] GitHub or technical profiles when relevant;
  - [ ] social media user profiles;
  - [ ] funding or investor pages;
  - [ ] product pages and docs.
- [ ] Always include the user profile when the original source is a social media post and the profile URL can be derived or is present.
- [ ] Each planned search should state the intended entity and what information it is trying to find.
- [ ] Do not let the LLM exceed worker-provided limits.
- [ ] Add tests for social media leads, company leads, individual consultant requests, and sparse leads.

## Phase 10: Deep Research Result Verification

- [ ] Create `deep-research-result-verification-agent`.
- [ ] Create `deepResearchResultVerificationWorkflow`.
- [ ] Input should include:
  - [ ] base lead identity;
  - [ ] target entity;
  - [ ] search query;
  - [ ] scraped result URL;
  - [ ] scraped result title;
  - [ ] scraped result text;
  - [ ] known aliases or disambiguation hints.
- [ ] Output:
  - [ ] `isRelatedToLeadEntity`;
  - [ ] confidence;
  - [ ] matched entity name;
  - [ ] mismatch reason;
  - [ ] useful facts;
  - [ ] evidence.
- [ ] Prompt must explicitly prevent entity confusion, such as confusing a startup named "Apex" with the Apex programming language.
- [ ] Require the model to reject pages that are topically similar but not about the right person or company.
- [ ] Add tests for name collisions, common company names, unrelated LinkedIn profiles, and correct profile matches.

## Phase 11: Deep Research Synthesis

- [ ] Create `deep-research-synthesis-agent`.
- [ ] Create `deepResearchSynthesisWorkflow`.
- [ ] Input should include base lead details and verified research facts only.
- [ ] Output a structured research report:
  - [ ] summary;
  - [ ] contact information;
  - [ ] company size;
  - [ ] funding or budget signals;
  - [ ] business strategy;
  - [ ] products;
  - [ ] relevant people;
  - [ ] likely pain points;
  - [ ] recommended outreach angle;
  - [ ] source citations;
  - [ ] confidence;
  - [ ] unresolved questions.
- [ ] Do not include rejected or unverified research facts in the final report.
- [ ] Add tests that prove synthesis uses only verified facts.

## Phase 12: Outreach Message Generation

- [ ] Create `outreach-message-agent`.
- [ ] Create `outreachMessageGenerationWorkflow`.
- [ ] Input should include:
  - [ ] lead source content;
  - [ ] verification score and rationale;
  - [ ] structured lead details;
  - [ ] deep research report if available;
  - [ ] consultancy profile;
  - [ ] tone and channel preferences;
  - [ ] optional message constraints.
- [ ] Output:
  - [ ] subject line if appropriate for the channel;
  - [ ] initial outreach message;
  - [ ] personalization notes;
  - [ ] value proposition used;
  - [ ] call to action;
  - [ ] confidence;
  - [ ] risks or missing information.
- [ ] The message should be concise, specific, and grounded in the available evidence.
- [ ] The prompt should avoid unsupported claims, fake familiarity, and high-pressure sales language.
- [ ] Support cases with and without deep research.
- [ ] Add tests for high-quality researched leads, high-quality unresearched leads, low-information leads, and different tone settings.

## Phase 13: Register Workflows, Agents, And Scorers

- [ ] Register every new workflow in `src/mastra/index.ts`.
- [ ] Register every new agent in `src/mastra/index.ts`.
- [ ] Add scorers or evals where useful:
  - [ ] search result prefilter accuracy;
  - [ ] lead verification quality;
  - [ ] extraction completeness;
  - [ ] deep research entity match accuracy;
  - [ ] outreach message quality.
- [ ] Keep registrations organized so v1 and v2 workflows are easy to find.
- [ ] Update `README.md` with workflow names, inputs, outputs, and worker integration notes.

## Phase 14: Testing And Evaluation

- [ ] Add unit tests for all schemas.
- [ ] Add prompt builder tests for required prompt sections.
- [ ] Add workflow tests for all new workflow contracts.
- [ ] Add fixture data for:
  - [ ] likely Reddit software development leads;
  - [ ] non-leads;
  - [ ] weak leads;
  - [ ] high-quality leads;
  - [ ] company name collisions;
  - [ ] social profile research;
  - [ ] public company research;
  - [ ] outreach message generation.
- [ ] Mock model outputs in unit tests where deterministic behavior is required.
- [ ] Add evaluation examples that can be run repeatedly as prompt logic changes.
- [ ] Confirm all existing v1 tests still pass.

## Phase 15: Verification Checklist

- [ ] Run `bun run build` from `gtm-ai`.
- [ ] Run the existing unit tests with the project test command if one is added or available.
- [ ] Manually exercise each workflow from Mastra Studio or the Mastra client.
- [ ] Verify search term generation returns the requested object shape.
- [ ] Verify generated search terms do not include provider-specific `site:` or `tbs` logic in `searchQuery`.
- [ ] Verify worker-controlled site and datetimes are preserved.
- [ ] Verify prefiltering works from SERP title and snippet alone.
- [ ] Verify lead verification returns a 0-100 score and evidence.
- [ ] Verify structured extraction returns nulls instead of hallucinated missing data.
- [ ] Verify deep research result verification rejects wrong entities.
- [ ] Verify deep research synthesis uses only verified facts.
- [ ] Verify outreach generation works with and without a deep research report.
- [ ] Verify all workflow names and output schemas match the `gtm-workers` client contract.
