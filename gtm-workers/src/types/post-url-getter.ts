import type {Platform} from "./platform.ts";
import {getRedditPostUrl} from "./post-schemas/apify-reddit-post-schema.ts";
import {getTwitterPostUrl} from "./post-schemas/apify-twitter-post-schema.ts";

/**
 * Mapping of platform names to their respective Apify dataset url prop names.
 */
export type PostUrlGetter = (postData: Record<string, any>) => string | undefined;

export const postUrlGetters: Record<Platform, PostUrlGetter> = {
  reddit: getRedditPostUrl,
  twitter: getTwitterPostUrl
};