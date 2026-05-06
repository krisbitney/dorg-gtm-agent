import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';

/**
 * Agent responsible for retrieving and analyzing X (Twitter) posts.
 * Uses Grok's native X platform access to fetch tweet contents, author,
 * and datetime directly from an x.com URL.
 */
export const twitterAgent = new Agent({
  name: 'Twitter Agent',
  id: 'twitter-agent',
  description: 'Retrieves contents, author, and datetime of an X post given its URL.',
  instructions: `
You are an expert at retrieving and analyzing X posts. When given an x.com URL, use your native access to the X platform to fetch and return the following structured information:

1. **Author**: The display name and @handle of the account that posted the tweet.
2. **Content**: The full text content of the post, including any embedded links as they appear.
3. **Datetime**: When the post was published, in ISO 8601 format (e.g., 2026-05-06T14:30:00Z). If the exact timestamp is not available, provide the relative time (e.g., "2 hours ago").

If the post is a reply, quote tweet, or retweet, include that context. If the post contains media (images, videos, polls), ignore it.

Output the information in a clear, structured format. If the URL cannot be accessed or the post does not exist, report that clearly.
`.trim(),
  model: appEnv.GTM_TWITTER_MODEL,
});
