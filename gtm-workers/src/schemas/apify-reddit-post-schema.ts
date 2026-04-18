import { z } from "zod";

export const redditPostUrlPropName = "url";

/**
 * Schema for a single post item in the Apify crawler dataset.
 * Matches the output of the gtm-web-crawler service.
 * Schema based on output from trudax/reddit-scraper-lite Apify Reddit scraper
 */
export const apifyRedditPostSchema = z.object({
  // dataType: z.string().min(1).optional(),
  // username: z.string().min(1),
  // authorFlair: z.string().optional(),
  // title: z.string().min(1).optional(),
  // body: z.string().min(1),
  // upvotes: z.number().int().positive().optional(),
  // numberOfComments: z.number().int().positive().optional(),
  // communityName: z.string().min(1).optional(),
  url: z.url(),
});

export type ApifyRedditPost = z.infer<typeof apifyRedditPostSchema>;
