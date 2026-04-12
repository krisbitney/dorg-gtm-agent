import { z } from "zod";

export const RedditPostSchema = z.object({
  subreddit: z.string(),
  username: z.string().nullable(),
  content: z.string(),
  likes: z.number().int().nullable(),
  nComments: z.number().int().nullable(),
  postedAt: z.iso.datetime(),
});