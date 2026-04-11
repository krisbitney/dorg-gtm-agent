import { ROUTE_LABELS } from "../constants/ROUTE_LABELS.js";
import { canonicalizePostUrl, canonicalizeListingUrl } from "./reddit-url.js";

/**
 * Creates user data for a subreddit listing request.
 * @param topic The subreddit name.
 * @param pageNumber The current page number (default 1).
 */
export function createSubredditUserData(topic: string, pageNumber: number = 1) {
  return {
    label: ROUTE_LABELS.SUBREDDIT,
    topic,
    pageNumber,
  };
}

/**
 * Creates user data for a post detail request.
 * @param topic The subreddit name.
 */
export function createPostUserData(topic: string) {
  return {
    label: ROUTE_LABELS.POST,
    topic,
  };
}

/**
 * Generates a stable uniqueKey for a Reddit post request.
 * Uses the canonical post URL to ensure deduplication.
 * @param url The post URL.
 */
export function getPostUniqueKey(url: string): string {
  return canonicalizePostUrl(url);
}

/**
 * Generates a stable uniqueKey for a subreddit listing request.
 * Uses the canonical listing URL (preserving pagination).
 * @param url The listing URL.
 */
export function getSubredditUniqueKey(url: string): string {
  return canonicalizeListingUrl(url);
}
