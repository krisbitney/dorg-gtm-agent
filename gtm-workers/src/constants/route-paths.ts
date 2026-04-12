/**
 * Fixed route paths for the HTTP API.
 */
export const RoutePaths = {
  HEALTH: "/healthz",
  TRIGGER_CRAWL: "/internal/crawl-runs",
  APIFY_WEBHOOK: "/webhooks/apify/run-finished",
} as const;
