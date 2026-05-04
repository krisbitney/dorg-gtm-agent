import { appEnv } from "../config/app-env.js";
import { apifyRunWebhookSchema } from "../schemas/apify-run-webhook-schema.js";
import { ImportApifyRunDataset } from "../use-cases/import-apify-run-dataset.js";
import { ApifyCrawlerClient } from "../clients/apify-crawler-client.js";
import { CrawlRunRepository } from "../storage/repositories/crawl-run-repository.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import { RedisProcessedUrlStore } from "../storage/processed-url-store.js";
import { RedisLeadQueue } from "../storage/lead-queue.js";

import {isPlatform} from "../schemas/platform.ts";

/**
 * Handles the Apify run finished webhook.
 */
export async function handleApifyWebhookRequest(request: Request) {
  // 1. Authenticate the webhook request
  const url = new URL(request.url);
  const secretFromQuery = url.searchParams.get("secret");
  const secretFromHeader = request.headers.get("X-Apify-Webhook-Secret");
  
  if (secretFromQuery !== appEnv.APIFY_WEBHOOK_SECRET && secretFromHeader !== appEnv.APIFY_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse and validate the webhook body
  const platform = url.searchParams.get("platform");
  if (!platform) {
    return new Response("Missing platform parameter", { status: 400 });
  }
  if (!isPlatform(platform)) {
    return new Response("Invalid platform", { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const result = apifyRunWebhookSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ errors: result.error.flatten() }, { status: 400 });
  }
  console.log(
    `[apify-webhook] Received run-finished event: runId=${result.data.apifyRunId} status=${result.data.status} platform=${platform}`
  );

  // 3. Execute the use case
  const apifyClient = new ApifyCrawlerClient();
  const crawlRunRepository = new CrawlRunRepository();
  const postRepository = new LeadRepository();
  const processedUrlStore = new RedisProcessedUrlStore();
  const leadQueue = new RedisLeadQueue();

  const importDataset = new ImportApifyRunDataset(
    apifyClient,
    crawlRunRepository,
    postRepository,
    processedUrlStore,
    leadQueue
  );

  try {
    await importDataset.execute(result.data, platform);
    console.log(
      `[apify-webhook] Successfully processed run: runId=${result.data.apifyRunId} platform=${platform}`
    );
    return new Response("OK", { status: 200 });
  } catch (error: unknown) {
    console.error("Failed to import dataset:", error);
    // Return 500 for transient failures so Apify can retry
    const errorMessage = error instanceof Error ? error.message : "Failed to import dataset";
    return new Response(errorMessage, { status: 500 });
  }
}
