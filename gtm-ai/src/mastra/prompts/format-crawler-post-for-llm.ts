import { CrawlerPostInput } from "../schemas/lead-input-schema";

/**
 * Formats a crawler post into a deterministic text block for LLM prompts.
 */
export const formatCrawlerPostForLLM = (input: CrawlerPostInput): string => {

  return `
Post ID: ${input.id}
Platform: ${input.platform}
Post URL: ${input.url}

Post: ${JSON.stringify(input.post)};
`.trim();
};
