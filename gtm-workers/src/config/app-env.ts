import { z } from "zod";

const localhostUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}, { message: "Must be a valid localhost URL" });

const envSchema = z.object({
  /** Workers API server host */
  WORKERS_API_HOST: z.string().default("0.0.0.0"),
  /** Workers API server port */
  WORKERS_API_PORT: z.coerce.number().default(3000),

  /** PostgreSQL database connection URL */
  DATABASE_URL: z.string().min(1),
  /** Redis connection URL */
  REDIS_URL: z.string().min(1),

  /** API token for the dOrg agents API */
  DORG_API_TOKEN: z.string().min(1),
  /** Base URL for the dOrg agents API */
  DORG_API_BASE_URL: z.union([z.url(), localhostUrl]).default("https://agentsofdorg.tech/api"),

  /** Base URL of the GTM AI Mastra server */
  GTM_AI_BASE_URL: z.union([z.url(), localhostUrl]),
  /** Request timeout for GTM AI calls (ms) */
  GTM_AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(600_000),
  /** Maximum retry attempts for GTM AI calls */
  GTM_AI_MAX_RETRIES: z.coerce.number().default(3),
  /** Initial delay between retries (ms) */
  GTM_AI_RETRY_BASE_DELAY_MS: z.coerce.number().default(1000),
  /** Maximum delay between retries (ms) */
  GTM_AI_RETRY_MAX_DELAY_MS: z.coerce.number().default(10_000),
  /** Minimum score to consider a lead worthwhile */
  LEAD_SCORE_THRESHOLD: z.coerce.number().default(0.5),

  /** Redis list key for the main job queue */
  QUEUE_NAME: z.string().default("gtm:posts:queue"),
  /** Redis list key for jobs currently being processed */
  QUEUE_PROCESSING_NAME: z.string().default("gtm:posts:processing"),
  /** Redis list key for dead-letter queue */
  QUEUE_DLQ_NAME: z.string().default("gtm:posts:dlq"),
  /** Redis set key for tracking processed URLs */
  PROCESSED_URLS_KEY: z.string().default("gtm:processed_urls"),
  /** Redis key prefix for search-term deduplication entries */
  SEARCH_TERM_DEDUP_PREFIX: z.string().default("gtm:search_term:"),
  /** TTL for search-term dedup entries (seconds) */
  SEARCH_TERM_DEDUP_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  /** Redis set key for URL deduplication */
  URLS_DEDUP_KEY: z.string().default("gtm:urls_dedup"),

  /** Number of concurrent worker jobs */
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  /** How long to block waiting for new jobs (ms) */
  WORKER_POLL_TIMEOUT_MS: z.coerce.number().default(30_000),
  /** Re-queue stale processing jobs on startup */
  WORKER_REQUEUE_STALE_ON_STARTUP: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(true),

  /** Number of search terms to generate per batch */
  SEARCH_TERMS_GENERATION_COUNT: z.coerce.number().int().positive().default(50),
  /** Lookback window for search freshness (days) */
  SEARCH_DAYS_BACK: z.coerce.number().int().positive().default(7),
  /** Number of search result pages to fetch */
  SEARCH_PAGES: z.coerce.number().int().positive().default(3),
  /** Delay between search loops (ms) */
  SEARCH_LOOP_DELAY_MS: z.coerce.number().int().positive().default(5_000),
  /** Maximum number of items allowed in the search queue */
  SEARCH_QUEUE_MAX_SIZE: z.coerce.number().int().positive().default(50),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Validated environment variables for the GTM Workers service.
 */
export const appEnv = envSchema.parse(process.env);
