# GTM Web Crawler Implementation Plan

This plan is based on the local Crawlee guides in `gtm-web-crawler/crawlee-docs`, especially the patterns for:

- `PlaywrightCrawler` setup from `first-crawler.md`
- labeled requests and selective `enqueueLinks()` usage from `crawling.md` and `adding-more-urls.md`
- fixture-driven extraction work from `real-world-project.md` and `scraping.md`
- router-based structure from `refactoring.md`
- anti-blocking, Camoufox, and proxy/session handling from `avoid-getting-blocked.md` and `proxy-management.md`

## Goal

Build a production-ready Reddit crawler that:

- starts from a fixed list of subreddit URLs
- discovers Reddit post detail pages without wandering across the whole site
- deduplicates posts safely across runs
- extracts the fields required by `high_level_design.md`
- inserts a SQL row with status `pending`
- pushes `{ id, platform: "reddit" }` to a Redis-backed queue
- prioritizes stealth and reliability over crawl speed

## Non-Negotiable Rules

- Keep `src/main.ts` thin. It should only wire configuration, services, crawler options, and `crawler.run(...)`.
- Keep `src/routes.ts` thin. It should route requests and delegate to small helpers/services.
- Keep `src/startUrls.ts` focused on seed data only.
- Move anything that can be pure into small pure functions so it can be unit-tested without Playwright.
- Do not write unit tests that hit live Reddit, live Redis, or live Postgres.
- Every checkpoint below must end with green `bun test` runs before the next checkpoint begins.
- Do not permanently mark a URL as processed until all downstream writes succeed. If you mark it too early and then fail later, you will silently lose posts.

## Important Design Notes Before Coding

- Crawlee already deduplicates requests inside a crawl by `uniqueKey`. Use that for request-queue dedupe.
- The Redis dedupe layer is different. It is for cross-run dedupe, not for replacing Crawlee request dedupe.
- Reddit post URLs and subreddit listing URLs need different normalization rules.
- Do not strip pagination cursor parameters from subreddit listing requests, or you may stop discovering older posts.
- Do strip irrelevant tracking parameters and fragments from post URLs before dedupe and persistence.
- A pure Bloom filter can produce false positives. Use a SQL unique constraint on post URL to as a failsafe to detect duplicates.
- Eventually the crawler will crawl other social media sites as well, so design considerations should be made to support extensibility.

## Recommended Target File Layout

Use this as the intended destination, not something to build all at once:

- `src/main.ts`
- `src/routes.ts`
- `src/startUrls.ts` or rename to `src/start-urls.ts` early if you want file names to match the repo naming convention
- `src/config/...`
- `src/constants/...`
- `src/domain/...`
- `src/lib/...`
- `src/services/...`
- `src/storage/...`
- `src/queue/...`
- `src/parsers/...`
- `test/unit/...`
- `test/fixtures/reddit/...`

## What The Existing Files Should Become

- `src/main.ts`
- [ ] Load validated config.
- [ ] Build Redis/SQL clients and crawler dependencies.
- [ ] Create the `PlaywrightCrawler`.
- [ ] Run the crawler with typed start requests.
- [ ] Contain almost no parsing or business logic.

- `src/routes.ts`
- [ ] Define a router with labels such as `SUBREDDIT` and `POST`.
- [ ] Wait for page readiness.
- [ ] Enqueue only the URLs the crawler actually needs.
- [ ] Delegate post processing to a service.
- [ ] Avoid large inline `if/else` blocks and avoid inline SQL/Redis logic.

- `src/startUrls.ts`
- [ ] Export typed Reddit seed data.
- [ ] Deduplicate the list.
- [ ] Keep the file free of crawler logic.

## Checkpoint 1 - Replace Template Defaults And Build A Test Harness

- [x] Replace the template mindset. Remove assumptions that this project crawls `crawlee.dev`; it must now crawl Reddit only.
- [x] Update `package.json` scripts to be Bun-first. Replace `npm`/`tsx`/`node` style scripts with Bun equivalents for running, building, and testing.
- [x] Add any missing dependencies required by the final architecture, such as `zod`, `drizzle-orm`, migration tooling, and a direct HTML parser dependency if fixture-based parser tests need one.
- [x] Create `test/unit` and `test/fixtures/reddit` directories.
- [x] Capture and sanitize at least four HTML fixtures before parser work begins:
- [x] one subreddit listing page with normal posts visible
- [x] one subreddit listing page with pagination or "next/older" navigation visible
- [x] one normal post detail page
- [x] one edge-case post detail page, such as deleted author, removed body, or abbreviated counts
- [x] Rename `popularCryptoSubreddits` to a domain-specific name such as `redditStartUrls`.
- [x] Fix malformed or inconsistent Reddit seed URLs before continuing.
- [x] Add the first real test command so `bun test` executes actual tests instead of a placeholder failure.
- [x] Unit tests to add:
- [x] `start-urls.test.ts` verifies every seed URL is a valid Reddit subreddit URL.
- [x] `start-urls.test.ts` verifies there are no duplicate seed URLs after normalization.
- [x] `reddit-fixture-sanity.test.ts` verifies fixture files load and contain the markers your later parser tests will depend on.
- [x] Checkpoint verification:
- [x] run `bun test`

## Checkpoint 2 - Define Configuration, Labels, Domain Types, And Testable Contracts

- [x] Create a centralized config loader using `zod`.
- [x] Validate only the settings the crawler truly needs at first. Start small:
- [x] `DATABASE_URL`
- [x] `REDIS_URL`
- [x] `CRAWLER_HEADLESS`
- [x] `CRAWLER_MAX_REQUESTS_PER_CRAWL`
- [x] `CRAWLER_MAX_CONCURRENCY`
- [x] `CRAWLER_REQUEST_TIMEOUT_MS`
- [x] `CRAWLER_NAVIGATION_TIMEOUT_MS`
- [x] `CRAWLER_PROXY_URLS` or equivalent proxy config input
- [x] Define request labels as constants, not ad-hoc strings. Start with:
- [x] `SUBREDDIT`
- [x] `POST`
- [x] Define the core domain types before wiring services:
- [x] `Platform` with `'reddit'`
- [x] `CrawlStatus` with at least `'pending'` and `'error'`
- [x] `RedditStartUrl`
- [x] `CanonicalPostUrl`
- [x] `PostMetrics`
- [x] `ExtractedRedditPost`
- [x] `PendingPostRecord`
- [x] `QueuePayload`
- [x] `ProcessPostResult`
- [x] Keep one export per file where it keeps the code simple and readable.
- [x] Unit tests to add:
- [x] `config.test.ts` verifies valid config parses successfully.
- [x] `config.test.ts` verifies missing required env vars fail with clear error messages.
- [x] `request-labels.test.ts` verifies labels are stable constants used by the rest of the code.
- [x] Checkpoint verification:
- [x] run `bun test`

## Checkpoint 3 - Build Reddit URL Normalization And Request Metadata Helpers

- [x] Create a small URL utility module dedicated to Reddit.
- [x] Implement separate helpers for:
- [x] detecting whether a URL is a subreddit listing page
- [x] detecting whether a URL is a Reddit post detail page
- [x] extracting the subreddit name from a Reddit URL
- [x] canonicalizing a post URL for dedupe and persistence
- [x] canonicalizing a listing URL for request-queue use without destroying pagination tokens
- [x] generating a stable Crawlee `uniqueKey` for post requests
- [x] generating request metadata and `userData` for discovered requests
- [x] Use `request.loadedUrl ?? request.url` as the source of truth after navigation, especially for canonical post URLs.
- [x] Decide now which query parameters must be preserved on listing URLs and which must be removed from post URLs.
- [x] Use Crawlee's `transformRequestFunction` when enqueueing discovered links so each request gets:
- [x] the correct label
- [x] a stable `uniqueKey`
- [x] the current subreddit topic in `userData`
- [x] Unit tests to add:
- [x] `reddit-url.test.ts` verifies valid subreddit URLs are accepted and invalid ones are rejected.
- [x] `reddit-url.test.ts` verifies post canonicalization removes fragments and tracking noise.
- [x] `reddit-url.test.ts` verifies listing canonicalization preserves pagination tokens.
- [x] `reddit-url.test.ts` verifies subreddit extraction works for all seed URLs.
- [x] `request-metadata.test.ts` verifies discovered post requests receive the right label, `uniqueKey`, and topic.
- [x] Checkpoint verification:
- [x] run `bun test`

## Checkpoint 4 - Build Pure Extraction Helpers From Saved Reddit Fixtures

- [x] Do not start inside Playwright. Start with pure parsing helpers that work on saved HTML fixtures.
- [x] Decide the minimum required source for each field from `high_level_design.md`:
- [x] `username of poster`
- [x] `post content`
- [x] `age of post (best estimate)`
- [x] `likes`
- [x] `nComments`
- [x] Create small pure helpers instead of one giant parser. Examples:
- [x] `normalizeWhitespace(...)`
- [x] `parseCompactNumber(...)` for values like `12`, `1.2k`, or `3m`
- [x] `extractAuthor(...)`
- [x] `extractPostTitle(...)`
- [x] `extractPostBody(...)`
- [x] `extractPostContent(...)` that combines title and body cleanly
- [x] `extractPostTimestamp(...)`
- [x] `extractScore(...)`
- [x] `extractCommentCount(...)`
- [x] `extractTopicFromPage(...)` as a fallback check against the URL-derived topic
- [x] Prefer machine-readable time attributes if the page exposes them.
- [x] If you can only derive a relative age string, store the raw value and document the conversion strategy.
- [x] Treat missing data carefully:
- [x] missing score is not the same as score `0`
- [x] removed content is not the same as empty content
- [x] deleted author is not the same as parsing failure
- [x] Combine the pure helpers into one higher-level parser that returns a typed object with nullable fields where appropriate.
- [x] Unit tests to add:
- [x] `parse-compact-number.test.ts` covers plain numbers, `k`, `m`, and malformed text.
- [x] `extract-author.test.ts` covers normal users, deleted users, and missing selectors.
- [x] `extract-content.test.ts` covers title-only posts, self-text posts, removed posts, and whitespace cleanup.
- [x] `extract-timestamp.test.ts` covers machine-readable time and fallback text extraction.
- [x] `extract-metrics.test.ts` covers score and comment-count parsing from normal and abbreviated text.
- [x] `extract-post.test.ts` covers at least one happy path fixture and one edge-case fixture end-to-end.
- [x] Checkpoint verification:
- [x] run `bun test`

## Checkpoint 5 - Design The Safe Post-Processing Orchestrator Before Using Real Redis Or SQL

- [x] Define small interfaces for the external dependencies so the core workflow can be unit-tested with fakes:
- [x] `ProcessedUrlStore`
- [x] `PostRepository`
- [x] `LeadQueuePublisher`
- [x] `Clock`
- [x] `IdGenerator`
- [x] Implement a single orchestrator for one discovered post. Its job should be:
- [x] normalize the final post URL
- [x] decide whether the post has already been processed
- [x] optionally acquire a temporary claim/lock to reduce cross-run races
- [x] parse the page into an `ExtractedRedditPost`
- [x] build the pending DB record
- [x] insert the row
- [x] publish the queue payload
- [x] mark the URL as permanently processed only after the insert and queue publish both succeed
- [x] return a typed result such as `inserted`, `duplicate`, or `failed`
- [x] Decide and document failure behavior now:
- [x] if the repository insert fails, do not mark the URL processed
- [x] if queue publish fails after insert, do not mark the URL processed
- [x] if queue publish fails after insert, update the row to an error state or implement another explicit recovery path
- [x] if parsing fails because the page shape changed, log enough context to debug it without storing sensitive junk
- [x] Unit tests to add:
- [x] `process-post.test.ts` verifies already-seen posts short-circuit correctly.
- [x] `process-post.test.ts` verifies the happy path inserts and publishes exactly once.
- [x] `process-post.test.ts` verifies repository failures do not mark the URL processed.
- [x] `process-post.test.ts` verifies queue failures after insert leave a recoverable state.
- [x] `process-post.test.ts` verifies locks or claims are released correctly on failure.
- [x] `process-post.test.ts` verifies the pending record contains the required fields from `high_level_design.md`.
- [x] Checkpoint verification:
- [x] run `bun test`

## Checkpoint 6 - Refactor Crawlee Wiring Around Labeled Routes And Narrow Link Discovery

- [x] Refactor `src/main.ts` so it only:
- [x] loads config
- [x] creates Redis and SQL dependencies
- [x] creates the router dependencies
- [x] builds `PlaywrightCrawler` options
- [x] runs the crawler with the seed requests from `src/startUrls.ts`
- [x] Replace the placeholder default handler in `src/routes.ts` with real labeled routes.
- [x] Create at least these handlers:
- [x] a subreddit listing handler
- [x] a post detail handler
- [x] In the subreddit listing handler:
- [x] wait for the page to render enough to safely inspect links
- [x] discover only the post-detail links you actually want
- [x] discover listing pagination links only if they are needed for deeper crawling
- [x] explicitly ignore user profile links, ads, outbound links, and comment-anchor variants
- [x] attach the subreddit topic to all discovered post requests
- [x] use `transformRequestFunction` to set the request label and stable `uniqueKey`
- [x] In the post handler:
- [x] wait for stable post selectors
- [x] use the loaded URL for canonicalization
- [x] hand the page HTML or parsed DOM to the orchestrator instead of writing inline persistence code
- [x] Keep development crawl sizes small and configurable. Use low request caps until the selectors and parser are stable.
- [x] Unit tests to add:
- [x] `route-metadata.test.ts` verifies topic and labels are attached to discovered requests.
- [x] `post-route.test.ts` verifies the post route delegates to the orchestrator with the right arguments.
- [x] Checkpoint verification:
- [x] run `bun test`
- [x] do one controlled manual smoke run with a tiny request cap, such as `CRAWLER_MAX_REQUESTS_PER_CRAWL=3`

## Checkpoint 7 - Add The Concrete SQL Repository And Redis Queue/Dedupe Adapters

- [x] Implement the SQL repository behind the `PostRepository` interface.
- [x] Use Drizzle for schema definition and query building, following the repo standard.
- [x] Keep the database details isolated so the rest of the crawler only sees typed repository methods.
- [x] Define the crawler table schema. Include at least:
- [x] `id` as UUIDv7
- [x] canonical post URL
- [x] raw/final URL if you want debugging visibility
- [x] `platform`
- [x] `topic`
- [x] `username`
- [x] `content`
- [x] `age` or best-estimate time fields
- [x] `likes`
- [x] `nComments`
- [x] crawl timestamp
- [x] `status`
- [x] optional error fields to support retries and debugging
- [x] Add a uniqueness safeguard on the canonical post URL if the database schema allows it.
- [x] Implement the queue publisher behind `LeadQueuePublisher`.
- [x] Decide the queue primitive explicitly before coding. If nothing else in the repo requires Redis Streams, a simple Redis list is easier for a junior developer to reason about.
- [x] Keep the payload contract fixed as `{ id, platform: "reddit" }`.
- [x] Implement the processed-URL store behind `ProcessedUrlStore`.
- [x] If you keep the Bloom filter, document its false-positive settings and pair it with a deterministic lock/claim step so failure handling stays safe.
- [x] Unit tests to add:
- [x] `post-repository.test.ts` verifies repository input maps to the expected SQL-layer payload.
- [x] `post-repository.test.ts` verifies duplicate canonical URLs are translated into a domain-level duplicate result.
- [x] `lead-queue-publisher.test.ts` verifies the exact payload shape and serialization.
- [x] `processed-url-store.test.ts` verifies seen-checks, permanent marks, and lock behavior using fakes or mocks.
- [x] Checkpoint verification:
- [x] run `bun test`

## Checkpoint 8 - Harden The Crawler Against Blocking And Operational Failures

- [x] Keep Camoufox as the browser launcher because the project requirements prioritize anti-detection.
- [x] Keep Crawlee fingerprint spoofing disabled when Camoufox is active so the two approaches do not fight each other.
- [x] Add session-aware crawling options deliberately, not accidentally:
- [x] low concurrency
- [x] reasonable navigation timeout
- [x] session persistence if useful
- [x] optional proxy support behind configuration
- [x] Configure proxy support in a way that can be turned on in production and off in development.
- [x] Add explicit detection for block states such as:
- [x] login walls
- [x] rate-limited pages
- [x] Cloudflare or other challenge pages
- [x] empty placeholder pages that still return HTTP 200
- [x] When a blocked page is detected, fail the request in a way Crawlee can retry instead of silently storing nonsense.
- [x] Add structured logs for:
- [x] seed URL count
- [x] discovered post count
- [x] skipped duplicates
- [x] inserted rows
- [x] queue publishes
- [x] parse failures
- [x] blocked/challenged requests
- [x] Unit tests to add:
- [x] `crawler-options.test.ts` verifies the options builder enables Camoufox correctly.
- [x] `crawler-options.test.ts` verifies proxy config is applied only when configured.
- [x] `block-detection.test.ts` verifies known blocked-page fixtures or markers are recognized.
- [x] `log-context.test.ts` verifies helper log context builders do not omit the canonical URL or topic.
- [x] Checkpoint verification:
- [x] run `bun test`
- [x] do one controlled manual crawl twice and confirm the second run mostly skips duplicates

## Checkpoint 9 - Final Cleanup, Documentation, And Regression Safety

- [ ] Remove leftover template comments, placeholder globs, and `crawlee.dev` example code.
- [ ] Review the final file layout and split any file that is becoming hard to reason about.
- [ ] Update `README.md` so a new developer can:
- [ ] install dependencies
- [ ] fetch Camoufox binaries
- [ ] configure env vars
- [ ] run the crawler in development
- [ ] run the unit tests
- [ ] refresh the saved Reddit HTML fixtures when Reddit markup changes
- [ ] Add a short troubleshooting section for the most likely failures:
- [ ] selectors changed
- [ ] queue publish failed after insert
- [ ] proxy misconfiguration
- [ ] parser returns missing metrics
- [ ] Add regression tests for every bug found during manual smoke runs.
- [ ] Run the full unit test suite one final time.
- [ ] Run one small controlled crawl with a tiny request cap and inspect the stored rows and queue payloads manually.
- [ ] Final verification:
- [ ] run `bun test`

## Suggested Implementation Order For A Very Junior Programmer

- [ ] Do Checkpoints 1 through 4 before touching real Redis or SQL.
- [ ] Do not start Playwright route wiring until the URL helpers and parser helpers already have green unit tests.
- [ ] Do not connect real Redis or SQL until the orchestrator works with fakes.
- [ ] Do not increase concurrency until the crawl produces correct rows and queue payloads on a tiny sample.
- [ ] Do not trust live Reddit markup changes without updating fixtures and parser tests first.

## Definition Of Done

The GTM Web Crawler is done when all of the following are true:

- [ ] `bun test` is green
- [ ] the crawler starts from the configured subreddit seeds
- [ ] it discovers only the intended Reddit post pages
- [ ] it extracts all required fields from `high_level_design.md`
- [ ] it inserts a `pending` SQL row with a UUIDv7 ID
- [ ] it publishes `{ id, platform: "reddit" }` to the Redis queue
- [ ] duplicate posts are skipped safely across repeated runs
- [ ] failures do not silently lose posts
- [ ] anti-blocking settings are enabled and configurable
