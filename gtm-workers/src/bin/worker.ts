import { RedisLeadQueue } from "../storage/lead-queue.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import { GtmAiClient } from "../clients/gtm-ai-client.js";
import { DorgApiClient } from "../clients/dorg-api-client.js";
import { ProcessLeadJob } from "../use-cases/process-lead-job.js";
import { ProcessQueueLoop } from "../use-cases/process-queue-loop.js";
import { appEnv } from "../config/app-env.js";
import { runMigrations } from "../storage/migrate.js";

/**
 * Entry point for the GTM Workers queue consumer.
 */
async function main(): Promise<void> {
  const processRunId = Bun.randomUUIDv7();
  console.log(`Starting GTM Workers Queue Consumer Process (ID: ${processRunId})...`);
  console.log("Ensuring database schema is up to date...");
  await runMigrations();

  const leadQueue = new RedisLeadQueue();
  const postRepository = new LeadRepository();
  const gtmAiClient = new GtmAiClient();
  const dorgApiClient = new DorgApiClient();

  // 1. Startup recovery: move stranded items back to main queue (run once)
  if (appEnv.WORKER_REQUEUE_STALE_ON_STARTUP) {
    console.log("Main: Requeueing stale processing items...");
    await leadQueue.requeueProcessing();
  }

  const concurrency = appEnv.WORKER_CONCURRENCY;
  console.log(`Main: Starting ${concurrency} concurrent async worker loops...`);

  const createJob = (runId: string) => 
    new ProcessLeadJob(postRepository, gtmAiClient, dorgApiClient, runId);

  // Start the loops concurrently
  for (let i = 0; i < concurrency; i++) {
    const loopRunId = `${processRunId}-loop-${i}`;
    const loop = new ProcessQueueLoop(
      leadQueue,
      postRepository,
      createJob,
      loopRunId
    );

    // Start the loop without awaiting it
    loop.execute().catch((error) => {
      console.error(`Worker loop ${i} (ID: ${loopRunId}) failed:`, error);
    });
  }

  console.log(`Main: All ${concurrency} worker loops are running.`);
}

main().catch((error) => {
  console.error("Critical worker failure:", error);
  process.exit(1);
});
