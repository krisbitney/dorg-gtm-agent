import { uuidv7 } from "uuidv7";
import { RedisLeadQueue } from "../storage/lead-queue.js";
import { PostRepository } from "../storage/repositories/post-repository.js";
import { GtmAiClient } from "../clients/gtm-ai-client.js";
import { DorgApiClient } from "../clients/dorg-api-client.js";
import { ProcessPostJob } from "../use-cases/process-post-job.js";
import { ProcessQueueLoop } from "../use-cases/process-queue-loop.js";

/**
 * Entry point for the GTM Workers queue consumer.
 */
async function main() {
  const workerRunId = uuidv7();
  console.log(`Starting GTM Workers Queue Consumer (Run ID: ${workerRunId})...`);

  const leadQueue = new RedisLeadQueue();
  const postRepository = new PostRepository();
  const gtmAiClient = new GtmAiClient();
  const dorgApiClient = new DorgApiClient();

  const createJob = (runId: string) => 
    new ProcessPostJob(postRepository, gtmAiClient, dorgApiClient, runId);

  const loop = new ProcessQueueLoop(
    leadQueue,
    postRepository,
    createJob,
    workerRunId
  );

  await loop.execute();
}

main().catch((error) => {
  console.error("Critical worker failure:", error);
  process.exit(1);
});
