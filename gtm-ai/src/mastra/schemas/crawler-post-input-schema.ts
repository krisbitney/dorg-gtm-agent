import { z } from "zod";

/**
 * Schema for input received from the crawler or workers.
 */
export const CrawlerPostInputSchema = z.object({
  id: z.uuid(),
  platform: z.string(),
  url: z.url(),
  post: z.json(),
});

export type CrawlerPostInput = z.infer<typeof CrawlerPostInputSchema>;
