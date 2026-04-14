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
  WORKERS_API_HOST: z.string().default("0.0.0.0"),
  WORKERS_API_PORT: z.coerce.number().default(3000),
  WORKERS_PUBLIC_BASE_URL: z.union([z.url(), localhostUrl]),
  
  TRIGGER_API_TOKEN: z.string().min(1),
  APIFY_WEBHOOK_SECRET: z.string().min(1),
  
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  
  DORG_API_TOKEN: z.string().min(1),
  DORG_API_BASE_URL: z.union([z.url(), localhostUrl]).default("https://agentsofdorg.tech/api"),
  
  APIFY_TOKEN: z.string().min(1),
  APIFY_RUN_TIMEOUT_SECONDS: z.coerce.number().default(3600),
  
  GTM_AI_BASE_URL: z.union([z.url(), localhostUrl]),
  GTM_AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(60_000),
  GTM_AI_MAX_RETRIES: z.coerce.number().default(3),
  GTM_AI_RETRY_BASE_DELAY_MS: z.coerce.number().default(1000),
  GTM_AI_RETRY_MAX_DELAY_MS: z.coerce.number().default(10_000),
  LEAD_SCORE_THRESHOLD: z.coerce.number().default(0.5),
  
  QUEUE_NAME: z.string().default("gtm:posts:queue"),
  QUEUE_PROCESSING_NAME: z.string().default("gtm:posts:processing"),
  QUEUE_DLQ_NAME: z.string().default("gtm:posts:dlq"),
  PROCESSED_URLS_KEY: z.string().default("gtm:processed_urls"),
  
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WORKER_POLL_TIMEOUT_SECONDS: z.coerce.number().default(20),
  WORKER_REQUEUE_STALE_ON_STARTUP: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(true),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Validated environment variables for the GTM Workers service.
 */
export const appEnv = envSchema.parse(process.env);
