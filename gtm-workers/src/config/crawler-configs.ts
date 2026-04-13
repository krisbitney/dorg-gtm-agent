import {oldRedditWeb3SubredditUrls} from "./crawler-start-urls/reddit.ts";

export const getCrawlerConfig = (platform: string): { actorId: string; input: Record<string, any>} => {
  switch (platform) {
    case "reddit":
      return {
        actorId: redditActorId,
        input: redditActorInputs,
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

/**
 * Apify Actor ID for the Reddit crawler.
 */
export const redditActorId = "irreplaceable_nucleus/dorg-gtm-agent";

/**
 * Default actor inputs for the Reddit crawler.
 */
export const redditActorInputs = {
  startUrls: oldRedditWeb3SubredditUrls,
  maxCrawlDepth: 10,
};