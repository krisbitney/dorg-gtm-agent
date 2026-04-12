import { z } from "zod";

/**
 * Schema for the internal trigger crawl response.
 */
export const triggerCrawlResponseSchema = z.object({
  apifyRunId: z.string().min(1),
  actorId: z.string().min(1),
  status: z.string().min(1),
  webhookUrl: z.url(),
});

export type TriggerCrawlResponse = z.infer<typeof triggerCrawlResponseSchema>;
