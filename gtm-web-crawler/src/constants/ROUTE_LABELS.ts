/**
 * Request labels for Crawlee routing.
 */
export const ROUTE_LABELS = Object.freeze({
  SUBREDDIT: "SUBREDDIT",
  POST: "POST",
} as const);

export type RouteLabel = keyof typeof ROUTE_LABELS;
