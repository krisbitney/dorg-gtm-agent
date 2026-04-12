# GTM AI Implementation Plan

This plan is for building the `gtm-ai` service in this repository. It is based on:

- the product requirements in `high_level_design.md`
- the current `gtm-ai` Mastra scaffold already in the repo
- the official Mastra documentation for agents, tools, workflows, storage, Studio, request context, observability, and evals

Read this plan from top to bottom once before coding. Then implement it in order, checkpoint by checkpoint. Do not skip the verification steps.

## Goal

- [✓] Build a real `gtm-ai` Mastra service that replaces the weather demo code.
- [✓] Expose two stable, production-usable workflows:
- [✓] `leadScoreWorkflow`: takes a parsed crawler post as JSON input and returns a probability from `0` to `1`.
- [✓] `leadAnalysisWorkflow`: takes the same input and returns either `{ isLead: false }` or `{ isLead: true, whyFit, needs, timing, contactInfo }`.
- [✓] Keep the public workflow contracts simple enough that `gtm-workers` can call them reliably later.
- [✓] Make the implementation easy to inspect in Mastra Studio and easy to evaluate with labeled fixtures.

## What You Are Replacing

- [✓] Delete or archive the weather demo files after you understand how they work:
- [✓] `src/mastra/agents/weather-agent.ts`
- [✓] `src/mastra/tools/weather-tool.ts`
- [✓] `src/mastra/workflows/weather-workflow.ts`
- [✓] `src/mastra/scorers/weather-scorer.ts`
- [✓] Remove all weather-related registrations from `src/mastra/index.ts`.
- [✓] Do not leave dead demo code behind. A junior developer should be able to open `src/mastra` and see only GTM-related code.

## Non-Negotiable Rules

- [✓] Use Bun-first commands everywhere: `bun run dev`, `bun run build`, and `bun test`.
- [✓] Keep all environment variable parsing centralized in one config module. Do not read `process.env` all over the codebase.
- [✓] Use Zod schemas for every workflow input and output contract.
- [✓] Keep workflow inputs and outputs machine-friendly. Do not make workers parse free-form text.
- [✓] Keep the first version stateless. Do not enable Mastra `Memory` unless you can explain exactly why a single-post classification workflow needs it.
- [✓] Do not invent tools just to "use tools." In v1, this service mainly needs agents, workflows, schemas, evals, storage, and observability.
- [✓] Keep one export per file.
- [✓] Keep prompts in pure helper files so they can be unit-tested.
- [✓] Every checkpoint must end with a successful `bun run build`. Use `bun test` once tests exist.
- [✓] Never change a workflow registration key after `gtm-workers` starts depending on it unless you update both services together.

## Important Mastra Design Choices

- [✓] Use **agents** for the actual LLM judgment and extraction tasks.
- [✓] Use **workflows** for the two fixed business pipelines because the steps are known in advance.
- [✓] Use **structured output** for both agents so the model returns typed JSON-like data instead of unstructured prose.
- [✓] Register all agents, workflows, scorers, storage, and observability in the top-level Mastra instance.
- [✓] Use Mastra Studio during development to test inputs, inspect traces, inspect step outputs, and run evals.
- [✓] Use request context to attach metadata like `postId`, `platform`, and `topic` to runs for observability.
- [✓] Use these ollama cloud models:
  - small model: ollama-cloud/gemma3:4b 
  - smart model: ollama-cloud/gemma4:31b


## Recommended Target File Layout

Use this as the intended destination layout. You do not need to create every file immediately, but this is the shape you should converge toward.

- [✓] `src/mastra/index.ts`
- [✓] `src/mastra/config/app-env.ts`
- [✓] `src/mastra/constants/lead-score-threshold.ts`
- [✓] `src/mastra/constants/model-defaults.ts`
- [✓] `src/mastra/types/gtm-request-context.ts`
- [✓] `src/mastra/schemas/crawler-post-input-schema.ts`
- [✓] `src/mastra/schemas/lead-score-result-schema.ts`
- [✓] `src/mastra/schemas/lead-analysis-result-schema.ts`
- [✓] `src/mastra/schemas/lead-analysis-raw-result-schema.ts`
- [✓] `src/mastra/prompts/build-lead-score-prompt.ts`
- [✓] `src/mastra/prompts/build-lead-analysis-prompt.ts`
- [✓] `src/mastra/prompts/format-crawler-post-for-llm.ts`
- [✓] `src/mastra/agents/lead-score-agent.ts`
- [✓] `src/mastra/agents/lead-analysis-agent.ts`
- [✓] `src/mastra/workflows/lead-score-workflow.ts`
- [✓] `src/mastra/workflows/lead-analysis-workflow.ts`
- [✓] `src/mastra/workflows/normalize-lead-score-result.ts`
- [✓] `src/mastra/workflows/normalize-lead-analysis-result.ts`
- [✓] `src/mastra/scorers/lead-score-accuracy-scorer.ts`
- [✓] `src/mastra/scorers/lead-analysis-completeness-scorer.ts`
- [✓] `src/mastra/storage/create-storage.ts`
- [✓] `src/mastra/observability/create-observability.ts`
- [✓] `test/fixtures/gtm-ai/positive-leads/*.json`
- [✓] `test/fixtures/gtm-ai/negative-leads/*.json`
- [✓] `test/fixtures/gtm-ai/ambiguous-leads/*.json`
- [✓] `test/unit/**/*.test.ts`

## Shared External Contract You Must Freeze Early

Before writing agents, decide the exact JSON input that the workflows accept. Write it down in one schema file and do not let it drift.

- [✓] Define a single shared input type for both workflows. Name it something like `CrawlerPostInput`.
- [✓] Include fields that the crawler or workers can reliably provide now, not fields you merely hope to have later.
- [✓] Start with this minimum shape unless the repo requirements change:
- [✓] `id: string`
- [✓] `platform: 'reddit'`
- [✓] `topic: string`
- [✓] `url: string`
- [✓] `username: string | null`
- [✓] `content: string`
- [✓] `ageText: string | null`
- [✓] `likes: number | null`
- [✓] `nComments: number | null`
- [✓] `capturedAt: string`
- [✓] If workers will actually pass more fields from SQL, add them now and document them once. Do not let prompt builders reach into random optional properties.
- [✓] Decide whether the workflow input is the raw crawler payload or the SQL row shape returned by `gtm-workers`. Pick one and stick to it.
- [✓] Document the exact public workflow outputs in the schema files, not just in comments.

## Public Workflow Output Contracts

### `leadScoreWorkflow`

- [✓] Public output must be exactly one small object, not free-form text.
- [✓] Recommended output schema:
- [✓] `{ leadProbability: number }`
- [✓] Enforce `.min(0).max(1)` at the schema level.
- [✓] Keep any extra reasoning internal to traces or internal raw-result steps. Do not require other services to parse it.

### `leadAnalysisWorkflow`

- [✓] Public output should be a discriminated union so worker code can branch safely.
- [✓] Recommended output schema:
- [✓] `{ isLead: false }`
- [✓] `{ isLead: true, whyFit: string, needs: string, timing: string | null, contactInfo: string | null }`
- [✓] Use `null` for unknown `timing` and `contactInfo`. Do not use empty strings for missing data.
- [✓] Do not let the model invent contact info. If the post does not contain contact information, return `null`.

## Checkpoint 1 - Clean The Scaffold And Lock Down The Domain Contracts

- [✓] Read `high_level_design.md` again and copy the GTM AI requirements into your own notes.
- [✓] Create `test/fixtures/gtm-ai` and `test/unit` directories.
- [✓] Remove the weather demo code only after you have the replacement file structure ready.
- [✓] Add a short section to `gtm-ai/README.md` describing the two workflows and their intended input/output contracts.
- [✓] Create the shared schema files first:
- [✓] `crawler-post-input-schema.ts`
- [✓] `lead-score-result-schema.ts`
- [✓] `lead-analysis-result-schema.ts`
- [✓] Create TypeScript types from the schemas with `z.infer` and reuse them everywhere.
- [✓] Create a single constants file for values that should never be magic numbers, especially the worker threshold `0.7`.
- [✓] Decide the exact workflow registration keys now. Recommended keys:
- [✓] `leadScoreWorkflow`
- [✓] `leadAnalysisWorkflow`
- [✓] Document that application code should fetch workflows by registration key, for example `mastra.getWorkflow('leadScoreWorkflow')`, not by guessing with the workflow `id`.
- [✓] Decide the exact workflow IDs now. Recommended IDs:
- [✓] `lead-score-workflow`
- [✓] `lead-analysis-workflow`
- [✓] Decide the exact agent registration keys now. Recommended keys:
- [✓] `leadScoreAgent`
- [✓] `leadAnalysisAgent`
- [✓] Decide the exact agent IDs now. Recommended IDs:
- [✓] `lead-score-agent`
- [✓] `lead-analysis-agent`
- [✓] Unit tests to add:
- [✓] schema test: valid crawler payload parses successfully
- [✓] schema test: invalid payload fails with clear errors
- [✓] schema test: `leadProbability` rejects numbers outside `0..1`
- [✓] schema test: non-lead result does not allow `whyFit`
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 2 - Centralize Configuration And Resolve The Model/Storage Story

The current scaffold has a mismatch: the code uses local LibSQL/DuckDB files, while `docker-compose.yml` passes `DATABASE_URL` and `REDIS_URL`, and `.env.example` only mentions `OLLAMA_API_KEY`.

Resolve that mismatch before the real implementation begins.

- [✓] Create `src/mastra/config/app-env.ts` using Zod.
- [✓] Parse only the env vars the `gtm-ai` service truly needs.
- [✓] Recommended first-pass env vars:
- [✓] `MASTRA_HOST`
- [✓] `MASTRA_PORT`
- [✓] `MASTRA_LOG_LEVEL`
- [✓] `GTM_SMALL_MODEL`
- [✓] `GTM_ANALYSIS_MODEL`
- [✓] provider-specific API key env `OLLAMA_API_KEY`
- [✓] `MASTRA_STORAGE_URL` for LibSQL, for example `file:./mastra.db`
- [✓] `MASTRA_OBSERVABILITY_DB_PATH` for DuckDB, for example `./mastra-observability.db`
- [✓] `MASTRA_CLOUD_ACCESS_TOKEN` only if you intentionally use Mastra Cloud tracing
- [✓] Update `.env.example` so it matches the actual code.
- [✓] Decide whether v1 storage stays local LibSQL plus DuckDB, or whether you want to switch to another provider later.
- [✓] If you keep LibSQL plus DuckDB for v1, remove misleading unused env vars from the `gtm-ai` service section of `docker-compose.yml` later.
- [✓] Use the local Mastra provider registry script before choosing model strings.
- [✓] Record the chosen model strings in the plan comments or README so future developers know they were validated.
- [✓] Prefer one cheaper model for scoring and one stronger model for extraction, but keep them configurable.
- [✓] Do not hardcode model names in more than one place.
- [✓] Unit tests to add:
- [✓] valid env parses successfully
- [✓] missing required model envs fail clearly
- [✓] invalid port values fail clearly
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 3 - Create Pure Prompt Formatting Helpers

A junior programmer should not build prompts inline inside workflow files. Put the prompt logic in pure functions.

- [✓] Create `format-crawler-post-for-llm.ts`.
- [✓] Accept a typed `CrawlerPostInput` object and return a deterministic text block.
- [✓] Format the data in a fixed labeled order so the model always sees the same structure:
- [✓] Post ID
- [✓] Platform
- [✓] Topic
- [✓] URL
- [✓] Username
- [✓] Age
- [✓] Likes
- [✓] Comment count
- [✓] Content
- [✓] Decide how to handle missing values. Recommended pattern: print explicit placeholders like `null` or `unknown`, not blank gaps.
- [✓] Add a max-content-length constant so extremely long posts do not explode token usage.
- [✓] If content is truncated, include a visible marker like `[TRUNCATED]` in the formatted prompt text.
- [✓] Create `build-lead-score-prompt.ts`.
- [✓] Instruct the small model to return only a numeric likelihood-like judgment in the structured schema.
- [✓] Make the prompt describe what counts as a promising lead for dOrg's tech/dev consultancy.
- [✓] Include negative instructions so the model penalizes vague hype, memecoin chatter, job-seeker posts, and unrelated community chatter.
- [✓] Create `build-lead-analysis-prompt.ts`.
- [✓] Tell the stronger model to first decide whether the post is a lead.
- [✓] Tell it to extract only facts supported by the post.
- [✓] Tell it to use `null` when timing or contact info are missing.
- [✓] Tell it not to invent company names, contact details, budgets, or deadlines.
- [✓] Unit tests to add:
- [✓] prompt formatter test: stable section ordering
- [✓] prompt formatter test: missing nullable fields produce explicit placeholders
- [✓] prompt formatter test: long content truncates at the configured constant
- [✓] prompt builder test: score prompt includes the dOrg-fit criteria
- [✓] prompt builder test: analysis prompt includes anti-hallucination instructions
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 4 - Build The Two Agents

Keep the agents thin. Their job is to hold instructions, model selection, and optional scorer attachments. The workflows will orchestrate the business flow.

### `leadScoreAgent`

- [✓] Create `src/mastra/agents/lead-score-agent.ts`.
- [✓] Use the validated small-model env setting.
- [✓] Give the agent a narrow job: estimate whether a post is a likely consultancy lead for dOrg.
- [✓] Keep the instructions short and specific.
- [✓] Do not attach tools in v1.
- [✓] Do not attach memory in v1.
- [✓] Add a short description so the agent is understandable in Studio.

### `leadAnalysisAgent`

- [✓] Create `src/mastra/agents/lead-analysis-agent.ts`.
- [✓] Use the validated stronger-model env setting.
- [✓] Give the agent a narrow job: determine if the post is a lead and extract supported fields.
- [✓] Keep the instructions strict about unsupported guesses.
- [✓] Do not attach tools in v1.
- [✓] Do not attach memory in v1.
- [✓] Add a short description so the agent is understandable in Studio.

### Agent-specific sanity checks

- [✓] Confirm both agents use the Mastra `provider/model-name` string format.
- [✓] Confirm the chosen model strings came from the provider registry, not memory.
- [✓] Confirm both agent names, IDs, and registration keys are stable and readable.
- [✓] Unit tests to add:
- [✓] agent config test: both agents can be imported without side effects
- [✓] agent config test: both agents expose the expected IDs
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 5 - Implement `leadScoreWorkflow`

This workflow should stay simple and deterministic.

- [✓] Create `src/mastra/workflows/lead-score-workflow.ts`.
- [✓] Use the shared crawler-post input schema as the workflow input.
- [✓] Use the shared lead-score result schema as the workflow output.
- [✓] Build the workflow in three logical stages:
- [✓] stage 1: map the typed input into `{ prompt: string }`
- [✓] stage 2: run the small agent as a workflow step with structured output
- [✓] Use the Mastra workflow pattern from the docs: create an agent step with `createStep(leadScoreAgent, { structuredOutput: { schema: ... } })` instead of parsing free-form text yourself.
- [✓] stage 3: normalize and clamp the result into the public workflow output shape
- [✓] Create a private raw-result schema for the agent step if useful, for example `{ leadProbability: number, shortReason: string }`.
- [✓] Strip internal reasoning out of the final public workflow output unless another service truly needs it.
- [✓] In the normalization step, guard against nonsense values even if the model schema already restricts them.
- [✓] Round the public probability to a predictable precision if you want stable snapshots, for example three decimals. If you do this, document it.
- [✓] Commit the workflow and export it.
- [✓] Register it later by the stable key `leadScoreWorkflow`.
- [✓] Unit tests to add:
- [✓] result normalizer test: clamps values below `0` to `0`
- [✓] result normalizer test: clamps values above `1` to `1`
- [✓] result normalizer test: preserves valid numbers
- [✓] workflow smoke test: valid input reaches a successful result shape when the agent step is mocked
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 6 - Implement `leadAnalysisWorkflow`

This workflow should return a safe, typed decision that workers can act on.

- [✓] Create `src/mastra/workflows/lead-analysis-workflow.ts`.
- [✓] Use the shared crawler-post input schema as the workflow input.
- [✓] Use the discriminated union result schema as the workflow output.
- [✓] Create a raw-result schema for the analysis agent step. Recommended shape:
- [✓] `isLead: boolean`
- [✓] `whyFit: string | null`
- [✓] `needs: string | null`
- [✓] `timing: string | null`
- [✓] `contactInfo: string | null`
- [✓] stage 1: map the typed input into `{ prompt: string }`
- [✓] stage 2: run the stronger agent as a structured-output step
- [✓] Use the same Mastra pattern here: `createStep(leadAnalysisAgent, { structuredOutput: { schema: ... } })`.
- [✓] stage 3: normalize the raw model output into the public union
- [✓] In the normalizer, if `isLead` is `false`, return exactly `{ isLead: false }`.
- [✓] In the normalizer, if `isLead` is `true`, ensure `whyFit` and `needs` are non-empty strings.
- [✓] In the normalizer, convert blank strings like `''` or `'unknown'` into `null` for `timing` and `contactInfo` if that matches your product rules.
- [✓] Decide how to handle a model response that says `isLead: true` but leaves `whyFit` empty. Recommended behavior: fail normalization loudly so you fix the prompt instead of shipping partial junk.
- [✓] Keep the workflow deterministic after the agent step. All cleanup should happen in pure TypeScript, not another LLM call.
- [✓] Commit the workflow and export it.
- [✓] Register it later by the stable key `leadAnalysisWorkflow`.
- [✓] Unit tests to add:
- [✓] normalizer test: non-lead returns exact minimal object
- [✓] normalizer test: lead result requires `whyFit` and `needs`
- [✓] normalizer test: blank optional fields become `null`
- [✓] workflow smoke test: valid mocked agent output becomes valid public output
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 7 - Register Everything In The Mastra Instance Cleanly

The current `src/mastra/index.ts` is a useful example but should be refactored into clearer GTM-specific modules.

- [✓] Create `src/mastra/storage/create-storage.ts`.
- [✓] Move storage setup out of `index.ts`.
- [✓] Keep the existing idea of composite storage if you want local traces separated from general storage:
- [✓] LibSQL as the default storage
- [✓] DuckDB for the observability domain
- [✓] Make the file paths configurable through env.
- [✓] Create `src/mastra/observability/create-observability.ts`.
- [✓] Move observability setup out of `index.ts`.
- [✓] Keep `DefaultExporter` so traces appear in Studio.
- [✓] Keep `SensitiveDataFilter` so secrets or tokens are redacted in spans.
- [✓] Enable `CloudExporter` only if the required token is configured intentionally.
- [✓] Add `requestContextKeys` once you define the request context shape.
- [✓] Refactor `src/mastra/index.ts` so it becomes a small composition root.
- [✓] Register both workflows.
- [✓] Register both agents.
- [✓] Register any scorers you add.
- [✓] Register the logger.
- [✓] Register the storage instance.
- [✓] Register the observability instance.
- [✓] Explicitly configure the server host and port so Docker behavior is predictable.
- [✓] Recommended first-pass server settings:
- [✓] host `0.0.0.0`
- [✓] port from env, default `4111`
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun run dev`
- [✓] open Studio and confirm both workflows and both agents appear

## Checkpoint 8 - Add Request Context For Traceability

Mastra supports request context, and you should use it so traces are tied back to the originating post.

- [✓] Create `src/mastra/types/gtm-request-context.ts`.
- [✓] Define a small request-context type. Recommended keys:
- [✓] `postId: string`
- [✓] `platform: string`
- [✓] `topic: string`
- [✓] `source: 'worker' | 'studio' | 'manual-test'`
- [✓] `workerRunId: string | null`
- [✓] Update observability config to include the most useful request context keys in trace metadata.
- [✓] Update local manual test code or future worker integration examples so workflows are called with request context.
- [✓] Do not put giant payloads into request context. Only put metadata needed for tracing.
- [✓] Add a README example showing a workflow run with request context.
- [✓] Unit tests to add:
- [✓] request-context type test or helper test if you create builders
- [✓] Checkpoint verification:
- [✓] run `bun run build`
- [✓] run `bun test`

## Checkpoint 9 - Add Scorers And Evaluation Data

Do not wait until the end to think about quality. Build a small labeled dataset early.

### Dataset work

- [✓] Create at least 12 labeled fixture inputs before tuning prompts heavily.
- [✓] Split them across categories:
- [✓] obvious leads
- [✓] obvious non-leads
- [✓] ambiguous borderline posts
- [✓] posts with timing/contact info
- [✓] posts without timing/contact info
- [✓] For each fixture, save the expected outputs in a machine-readable way.
- [✓] For score fixtures, store the expected boolean lead label and optionally an expected probability band.
- [✓] For analysis fixtures, store the expected `isLead` flag and expected extracted fields.

### Scorer work

- [✓] Create `lead-score-accuracy-scorer.ts`.
- [✓] First version can be rule-based: convert the numeric probability into a boolean using the shared threshold and compare it to the ground-truth label.
- [✓] Create `lead-analysis-completeness-scorer.ts`.
- [✓] First version should verify that when `isLead` is true, `whyFit` and `needs` are populated.
- [✓] Add a second analysis scorer if needed to penalize hallucinated contact info or timing.
- [✓] Register scorers in the Mastra instance.
- [✓] Attach scorers to the appropriate agents or workflow steps with explicit sampling rates.
- [✓] Keep sampling at `1` during development so you see every result.
- [✓] If you later reduce sampling in production, document the reason.

### Experiment work

- [✓] Add a small eval script or documented manual process for running experiments against the dataset.
- [✓] Compare at least two prompt/model combinations for the score workflow.
- [✓] Compare at least two prompt/model combinations for the analysis workflow.
- [✓] Record the winning settings in the README.
- [✓] Checkpoint verification:
- [✓] run `bun run dev`
- [✓] use Studio to inspect scorer results and traces
- [✓] run at least one experiment per workflow

## Checkpoint 10 - Add Real Tests Instead Of Trusting Studio Alone

Studio is for interactive debugging. It is not a replacement for repeatable tests.

- [✓] Add pure unit tests for every schema file.
- [✓] Add pure unit tests for every prompt helper.
- [✓] Add pure unit tests for every result-normalization helper.
- [✓] Add a composition smoke test that imports the Mastra instance and confirms the GTM workflows are registered.
- [✓] Add fixture-driven tests for positive, negative, and ambiguous lead examples.
- [✓] Mock the agent boundary when testing workflow normalization logic. Do not make unit tests call a live model.
- [✓] If you add any integration tests that hit a real model, mark them clearly and keep them out of the default test path unless the env is configured.
- [✓] Add at least one test that ensures `leadAnalysisWorkflow` returns `{ isLead: false }` exactly, not `{ isLead: false, whyFit: null, ... }`.
- [✓] Add at least one test that ensures missing contact info comes back as `null`, not an invented email or Discord handle.
- [✓] Checkpoint verification:
- [✓] run `bun test`
- [✓] run `bun run build`

## Checkpoint 11 - Manual QA In Mastra Studio

Before handing the service off to worker integration, manually test it in Studio.

- [✓] Start the service with `bun run dev`.
- [✓] Open Mastra Studio at `http://localhost:4111`.
- [✓] Verify both agents appear and are named clearly.
- [✓] Verify both workflows appear and accept the expected input schema.
- [✓] Run `leadScoreWorkflow` with an obvious lead fixture.
- [✓] Run `leadScoreWorkflow` with an obvious non-lead fixture.
- [✓] Run `leadAnalysisWorkflow` with a lead fixture that contains contact info.
- [✓] Run `leadAnalysisWorkflow` with a lead fixture that has no contact info.
- [✓] Run `leadAnalysisWorkflow` with a clear non-lead fixture.
- [✓] Inspect the traces for each run.
- [✓] Confirm request-context metadata appears in the trace if you passed it in.
- [✓] Confirm no secrets are exposed in observable span payloads.
- [✓] Confirm the final workflow outputs match the schema exactly.

## Checkpoint 12 - Worker Integration Preparation

Even if `gtm-workers` is not implemented yet, prepare the contracts now so the next developer does not guess.

- [✓] Add README examples for calling each workflow with sample JSON input.
- [✓] Clearly document the workflow registration keys that workers must use.
- [✓] Clearly document the threshold constant workers should use when deciding whether to skip the expensive workflow.
- [✓] Clearly document whether the smarter workflow should still be called for borderline scores or only for scores at or above the threshold.
- [✓] Write down the error behavior expected by worker callers:
- [✓] what a schema validation failure looks like
- [✓] what a model failure looks like
- [✓] what a workflow execution failure looks like
- [✓] If you later add `@mastra/client-js` to `gtm-workers`, keep the GTM AI workflow keys stable and document them in one place.

## Checkpoint 13 - Final Cleanup Before Calling The Implementation Done

- [✓] Remove all references to the weather example from source files, docs, comments, and logs.
- [✓] Remove unused dependencies if the final GTM AI code does not need them.
- [✓] Make sure file names use kebab-case.
- [✓] Make sure every file has a single clear purpose.
- [✓] Make sure every public module has a short JSDoc comment if it exports a public function or constant used elsewhere.
- [✓] Make sure no file reads env vars directly except the config module.
- [✓] Make sure no prompt text is duplicated across multiple files.
- [✓] Make sure no magic constants like `0.7` or a truncation limit are duplicated across files.
- [✓] Run final verification:
- [✓] `bun test`
- [✓] `bun run build`
- [✓] `bun run dev`
- [✓] a final manual Studio smoke test

## Recommended Order Of Implementation

If you are very junior, do the work in exactly this order:

- [ ] 1. schema files
- [ ] 2. config file
- [ ] 3. constants
- [ ] 4. prompt-formatting helpers
- [ ] 5. agents
- [ ] 6. workflow normalizer helpers
- [ ] 7. workflows
- [ ] 8. Mastra registration in `index.ts`
- [ ] 9. fixture files
- [ ] 10. unit tests
- [ ] 11. scorers and evals
- [ ] 12. manual Studio QA
- [ ] 13. README and worker-integration notes

## Common Mistakes To Avoid

- [ ] Do not send raw database rows straight to the LLM without a formatting helper.
- [ ] Do not let workers depend on free-form agent text.
- [ ] Do not leave output cleanup to the model if TypeScript can enforce it after the model step.
- [ ] Do not enable memory just because the scaffold shows it.
- [ ] Do not hardcode one model string inside agents and a different one inside docs or tests.
- [ ] Do not bury the `0.7` threshold inside a prompt.
- [ ] Do not keep weather-demo storage and observability code without refactoring it into GTM-specific modules.
- [ ] Do not treat Studio success as proof that the service is production-ready.

## Definition Of Done

The GTM AI implementation is done only when all of the following are true:

- [ ] the weather demo is gone
- [ ] both GTM workflows are implemented and registered
- [ ] both workflows accept validated typed JSON input
- [ ] both workflows return validated typed JSON output
- [ ] model names come from centralized config
- [ ] storage and observability are configured intentionally, not accidentally inherited from the demo
- [ ] request context is available for traceability
- [ ] labeled fixtures exist
- [ ] scorers exist
- [ ] `bun test` passes
- [ ] `bun run build` passes
- [ ] manual Mastra Studio smoke tests pass
- [ ] `gtm-workers` has enough documentation to call the workflows without guessing

## Official Mastra Docs To Keep Open While Implementing

- [ ] `https://mastra.ai/llms.txt`
- [ ] `https://mastra.ai/docs/agents/overview`
- [ ] `https://mastra.ai/docs/agents/using-tools`
- [ ] `https://mastra.ai/docs/workflows/overview`
- [ ] `https://mastra.ai/docs/workflows/agents-and-tools`
- [ ] `https://mastra.ai/docs/workflows/error-handling`
- [ ] `https://mastra.ai/docs/server/request-context`
- [ ] `https://mastra.ai/docs/server/mastra-client`
- [ ] `https://mastra.ai/docs/studio/overview`
- [ ] `https://mastra.ai/docs/evals/overview`
- [ ] `https://mastra.ai/docs/evals/datasets/running-experiments`
- [ ] `https://mastra.ai/reference/storage/libsql`
- [ ] `https://mastra.ai/reference/storage/composite`
- [ ] `https://mastra.ai/reference/observability/tracing/configuration`
