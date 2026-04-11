/**
 * Request labels for Crawlee routing.
 */
export const LABELS = Object.freeze({
  SUBREDDIT: "SUBREDDIT",
  POST: "POST",
} as const);

export type Label = keyof typeof LABELS;
