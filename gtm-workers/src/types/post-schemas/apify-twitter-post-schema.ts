import { z } from "zod";

const indexPairSchema = z.tuple([z.number().int(), z.number().int()]);

const hashtagSchema = z.object({
  indices: indexPairSchema,
  text: z.string().min(1),
});

const timestampSchema = z.object({
  indices: indexPairSchema,
  seconds: z.number().int().nonnegative(),
  text: z.string().min(1),
});

const symbolSchema = z.object({
  indices: indexPairSchema,
  text: z.string().min(1),
  tag: z
    .object({
      info: z.array(z.unknown()),
    })
    .optional(),
});

const userMentionSchema = z.object({
  id_str: z.string().min(1),
  indices: indexPairSchema,
  name: z.string().min(1),
  screen_name: z.string().min(1),
});

const urlEntitySchema = z.object({
  display_url: z.string().min(1),
  expanded_url: z.url(),
  indices: indexPairSchema,
  url: z.url(),
});

const entitiesSchema = z.object({
  hashtags: z.array(hashtagSchema),
  symbols: z.array(symbolSchema),
  urls: z.array(urlEntitySchema),
  user_mentions: z.array(userMentionSchema),
  timestamps: z.array(timestampSchema).optional(),
  media: z.any().optional()
});

const userInfoSchema = z.object({
  screen_name: z.string().min(1),
  name: z.string().min(1),
  created_at: z.string().min(1),
  description: z.string(),
  rest_id: z.string().min(1),
  followers_count: z.number().int().nonnegative(),
  favourites_count: z.number().int().nonnegative(),
  avatar: z.url(),
  url: z.url().nullable(),
  cover_image: z.url(),
  verified_type: z.string().min(1).nullable(),
  verified: z.boolean(),
  friends_count: z.number().int().nonnegative(),
  location: z.string(),
});

const quotedAuthorSchema = z.object({
  rest_id: z.string().min(1),
  created_at: z.string().min(1),
  name: z.string().min(1),
  screen_name: z.string().min(1),
  avatar: z.url(),
  blue_verified: z.boolean(),
});

const quotedTweetSchema = z.object({
  tweet_id: z.string().min(1),
  bookmarks: z.number().int().nonnegative(),
  created_at: z.string().min(1),
  favorites: z.number().int().nonnegative(),
  text: z.string(),
  lang: z.string().min(1),
  views: z.string().min(1),
  quotes: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  retweets: z.number().int().nonnegative(),
  conversation_id: z.string().min(1),
  author: quotedAuthorSchema,
  media: z.any().optional(),
});

export const apifyTwitterPostSchema = z.object({
  type: z.literal("tweet"),
  tweet_id: z.string().min(1),
  screen_name: z.string().min(1),
  bookmarks: z.number().int().nonnegative(),
  favorites: z.number().int().nonnegative(),
  created_at: z.string().min(1),
  text: z.string(),
  lang: z.string().min(1),
  display_text_range: indexPairSchema,
  source: z.string().min(1),
  quotes: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  conversation_id: z.string().min(1),
  retweets: z.number().int().nonnegative(),
  views: z.string().min(1),
  entities: entitiesSchema,
  user_info: userInfoSchema,
  media: z.any().optional(),

  community_id: z.string().min(1).optional(),
  quoted: quotedTweetSchema.optional(),

  in_reply_to_screen_name: z.string().min(1).optional(),
  in_reply_to_status_id_str: z.string().min(1).optional(),
  in_reply_to_user_id_str: z.string().min(1).optional(),
});

/**
 * Schema for a single post item in the Apify crawler dataset.
 * Matches the output of the gtm-web-crawler service.
 * Schema based on output from danek/twitter-scraper-ppr Apify Twitter scraper
 */
export type ApifyTwitterPost = z.infer<typeof apifyTwitterPostSchema>;

export function getTwitterPostUrl(postData: Record<string, any>): string | undefined {
  if (!postData.screen_name || !postData.tweet_id) {
    return undefined;
  }
  return `https://x.com/${postData.screen_name}/status/${postData.tweet_id}`;
}
