import { z } from "zod";

/**
 * Schema for the internal trigger crawl request.
 */
export const triggerCrawlRequestSchema = z.object({
  source: z.enum(["scheduler", "manual"]).default("manual"),
}).optional();

export type TriggerCrawlRequest = z.infer<typeof triggerCrawlRequestSchema>;
