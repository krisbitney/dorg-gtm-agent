import { CrawlerPostInput } from "../schemas/crawler-post-input-schema";

export const MAX_CONTENT_LENGTH = 50_000;

/**
 * Formats a crawler post into a deterministic text block for LLM prompts.
 */
export const formatCrawlerPostForLLM = (post: CrawlerPostInput): string => {
  const content =
    post.content.length > MAX_CONTENT_LENGTH
      ? `${post.content.slice(0, MAX_CONTENT_LENGTH)} [TRUNCATED]`
      : post.content;

  return `
Post ID: ${post.id}
Platform: ${post.platform}
Topic: ${post.topic}
URL: ${post.url}
Username: ${post.username ?? "unknown"}
Likes: ${post.likes ?? 0}
Comments: ${post.nComments ?? 0}
Posted At: ${post.postedAt}

Content:
${content}
`.trim();
};
