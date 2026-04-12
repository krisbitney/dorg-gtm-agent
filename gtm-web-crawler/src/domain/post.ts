/**
 * The extracted reddit post contents
 */
export interface ExtractedRedditPost {
  username: string;
  content: string;
  postedAt: number; // unix timestamp
  nLikes: number; // number of upvotes
  nComments: number; // number of comments
  subreddit: string;
}

/**
 * The full reddit post contents
 */
export interface RedditPost {
  url: string;
  username: string;
  content: string;
  postedAt: number; // unix timestamp
  nLikes: number; // number of upvotes
  nComments: number; // number of comments
  subreddit: string;
}
