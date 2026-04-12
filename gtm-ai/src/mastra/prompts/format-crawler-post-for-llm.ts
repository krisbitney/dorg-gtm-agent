import { CrawlerPostInput } from "../schemas/crawler-post-input-schema";
import { formatRedditPost } from "./platform-formatters/reddit";

/**
 * Formats a crawler post into a deterministic text block for LLM prompts.
 */
export const formatCrawlerPostForLLM = (input: CrawlerPostInput): string => {
  switch (input.platform) {
    case "reddit":
      return formatRedditPost(input.id, input.url, input.post);
    default:
      throw new Error(`Unsupported platform for prompt formatting: ${input.platform}`);
  }
};
