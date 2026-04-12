import { z } from "zod";

/**
 * Schema for input received from the crawler or workers.
 */
export const CrawlerPostInputSchema = z.object({
  id: z.uuid(),
  platform: z.literal("reddit"),
  topic: z.string(),
  url: z.url(),
  username: z.string().nullable(),
  content: z.string(),
  likes: z.number().int().nullable(),
  nComments: z.number().int().nullable(),
  postedAt: z.iso.datetime(),
});

export type CrawlerPostInput = z.infer<typeof CrawlerPostInputSchema>;
