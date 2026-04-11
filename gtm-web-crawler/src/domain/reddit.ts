/**
 * Data extracted from a single Reddit post page.
 */
export interface ExtractedRedditPost {
  username: string;
  content: string;
  postedAt: number; // unix timestamp
  nLikes: number; // number of upvotes
  nComments: number; // number of comments
  topic: string; // subreddit
}
