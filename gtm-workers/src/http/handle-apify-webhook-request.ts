import { appEnv } from "../config/app-env.js";
import { apifyRunWebhookSchema } from "../schemas/apify-run-webhook-schema.js";
import { ImportApifyRunDataset } from "../use-cases/import-apify-run-dataset.js";
import { ApifyCrawlerClient } from "../clients/apify-crawler-client.js";
import { CrawlRunRepository } from "../storage/repositories/crawl-run-repository.js";
import { PostRepository } from "../storage/repositories/post-repository.js";
import { RedisProcessedUrlStore } from "../storage/processed-url-store.js";
import { RedisLeadQueue } from "../storage/lead-queue.js";

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

  // 3. Execute the use case
  const apifyClient = new ApifyCrawlerClient();
  const crawlRunRepository = new CrawlRunRepository();
  const postRepository = new PostRepository();
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
    await importDataset.execute(result.data);
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Failed to import dataset:", error);
    // Return 500 for transient failures so Apify can retry
    return new Response(error.message || "Failed to import dataset", { status: 500 });
  }
}
