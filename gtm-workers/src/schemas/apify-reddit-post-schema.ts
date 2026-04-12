import { z } from "zod";

/**
 * Schema for a single post item in the Apify crawler dataset.
 * Matches the output of the gtm-web-crawler service.
 */
export const apifyRedditPostSchema = z.object({
  url: z.string().url(),
  username: z.string().min(1),
  content: z.string().min(1),
  postedAt: z.number(), // Unix timestamp in milliseconds
  nLikes: z.number().int().nonnegative(),
  nComments: z.number().int().nonnegative(),
  topic: z.string().min(1),
});

export type ApifyRedditPost = z.infer<typeof apifyRedditPostSchema>;
