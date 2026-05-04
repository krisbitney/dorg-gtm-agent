import { z } from "zod";

/**
 * Schema for input received from the crawler or workers.
 */
export const LeadInputSchema = z.object({
  id: z.uuid(),
  platform: z.string(),
  url: z.url(),
  post: z.record(z.string(), z.unknown()),
});

export type CrawlerPostInput = z.infer<typeof LeadInputSchema>;
