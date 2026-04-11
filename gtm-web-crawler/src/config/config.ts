import { z } from "zod";

/**
 * Zod schema for the crawler configuration.
 */
export const configSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  CRAWLER_HEADLESS: z.preprocess((val) => {
    if (typeof val === "string") {
      if (val.toLowerCase() === "true") return true;
      if (val.toLowerCase() === "false") return false;
    }
    return val;
  }, z.boolean().default(true)),
  CRAWLER_MAX_REQUESTS_PER_CRAWL: z.coerce.number().int().positive().default(20),
  CRAWLER_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  CRAWLER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  CRAWLER_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  CRAWLER_PROXY_URLS: z.preprocess((val) => {
    if (typeof val === "string" && val.length > 0) {
      return val.split(",").map(url => url.trim());
    }
    return val;
  }, z.array(z.string().url()).optional()),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Validated configuration object loaded from environment variables.
 */
export const config = process.env.NODE_ENV === "test"
  ? {} as Config
  : configSchema.parse(process.env);
