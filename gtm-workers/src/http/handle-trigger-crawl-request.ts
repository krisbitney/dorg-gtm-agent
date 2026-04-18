import { appEnv } from "../config/app-env.js";
import { triggerCrawlRequestSchema } from "../schemas/trigger-crawl-request-schema.js";
import { StartApifyCrawlRun } from "../use-cases/start-apify-crawl-run.js";
import { ApifyCrawlerClient } from "../clients/apify-crawler-client.js";
import { CrawlRunRepository } from "../storage/repositories/crawl-run-repository.js";
import {getCrawlerConfig} from "../config/crawler-configs.ts";

/**
 * Handles the internal trigger crawl request.
 */
export async function handleTriggerCrawlRequest(request: Request) {
  // 1. Authenticate the caller
  const authHeader = request.headers.get("Authorization");
  const expectedToken = `Bearer ${appEnv.TRIGGER_API_TOKEN}`;

  if (authHeader !== expectedToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse and validate the request body
  let body;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const result = triggerCrawlRequestSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ errors: result.error.flatten() }, { status: 400 });
  }

  // Set platform-specific actor and inputs
  const platform = result.data.platform;
  const { actorId, input } = getCrawlerConfig(platform);

  // 3. Execute the use case
  const apifyClient = new ApifyCrawlerClient();
  const crawlRunRepository = new CrawlRunRepository();
  const startCrawlRun = new StartApifyCrawlRun(apifyClient, crawlRunRepository);

  try {
    const responseBody = await startCrawlRun.execute({ 
      platform,
      source: result.data.source,
      actorId,
      input,
    });
    return Response.json(responseBody, { status: 202 });
  } catch (error) {
    console.error("Failed to start crawl run:", error);
    return new Response("Failed to start crawl run", { status: 500 });
  }
}
