import { z } from "zod";

/**
 * Zod schema for the crawler configuration.
 */
export const configSchema = z.object({
  CRAWLER_MAX_CRAWL_DEPTH: z.coerce.number().int().positive().default(5),
  CRAWLER_MAX_REQUESTS_PER_CRAWL: z.coerce.number().int().positive().optional(),
  CRAWLER_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(20),
  CRAWLER_SAME_DOMAIN_DELAY_SECS: z.coerce.number().int().positive().default(3),
  CRAWLER_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  CRAWLER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  CRAWLER_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
});

export type AppConfig = z.infer<typeof configSchema>;

/**
 * Validated configuration object loaded from environment variables.
 */
export const appConfig = process.env.NODE_ENV === "test"
  ? {} as AppConfig
  : configSchema.parse(process.env);
