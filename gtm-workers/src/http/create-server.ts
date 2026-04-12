import { appEnv } from "../config/app-env.js";
import { RoutePaths } from "../constants/route-paths.js";
import { handleHealthRequest } from "./handle-health-request.js";
import { handleTriggerCrawlRequest } from "./handle-trigger-crawl-request.js";
import { handleApifyWebhookRequest } from "./handle-apify-webhook-request.js";

/**
 * Creates and starts the Bun HTTP server.
 */
export function createServer() {
  return Bun.serve({
    port: appEnv.WORKERS_API_PORT,
    hostname: appEnv.WORKERS_API_HOST,
    async fetch(request) {
      const url = new URL(request.url);
      const path = url.pathname;

      try {
        if (path === RoutePaths.HEALTH && request.method === "GET") {
          return handleHealthRequest();
        }

        if (path === RoutePaths.TRIGGER_CRAWL && request.method === "POST") {
          return await handleTriggerCrawlRequest(request);
        }

        if (path === RoutePaths.APIFY_WEBHOOK && request.method === "POST") {
          return await handleApifyWebhookRequest(request);
        }

        return new Response("Not Found", { status: 404 });
      } catch (error) {
        console.error("HTTP handler error:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
  });
}
