import { z } from "zod";

/**
 * Schema for the internal trigger crawl request.
 */
export const triggerCrawlRequestSchema = z.object({
  platform: z.string(),
  source: z.enum(["scheduler", "manual"]).default("manual"),
});

export type TriggerCrawlRequest = z.infer<typeof triggerCrawlRequestSchema>;
