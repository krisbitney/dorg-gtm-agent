import { RedditPostSchema } from "../../schemas/platform-schemas";

const MAX_CONTENT_LENGTH = 50_000;

/**
 * Formats a Reddit post into a text block for LLM prompts.
 */
export const formatRedditPost = (id: string, url: string, postJson: unknown): string => {
  const post = RedditPostSchema.parse(postJson);

  const content =
    post.content.length > MAX_CONTENT_LENGTH
      ? `${post.content.slice(0, MAX_CONTENT_LENGTH)} [TRUNCATED]`
      : post.content;

  return `
Post ID: ${id}
Platform: reddit
Subreddit: ${post.subreddit}
URL: ${url}
Username: ${post.username ?? "unknown"}
Likes: ${post.likes ?? 0}
Comments: ${post.nComments ?? 0}
Posted At: ${post.postedAt}

Content:
${content}
`.trim();
};
