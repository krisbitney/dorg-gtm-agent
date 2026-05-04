import { RedisLeadQueue } from "../storage/lead-queue.js";
import { RedisSearchTermStore } from "../storage/search-term-store.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import { SearchRunRepository } from "../storage/repositories/search-run-repository.js";
import { GtmAiClient } from "../clients/gtm-ai-client.js";
import { DorgApiClient } from "../clients/dorg-api-client.js";
import { ProcessLeadJob } from "../worker/process-lead-job.js";
import { ProcessQueueLoop } from "../worker/process-queue-loop.js";
import { SearchWorkerLoop } from "../worker/search-worker-loop.js";
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
  const searchTermStore = new RedisSearchTermStore();
  const postRepository = new LeadRepository();
  const searchRunRepository = new SearchRunRepository();
  const gtmAiClient = new GtmAiClient();
  const dorgApiClient = new DorgApiClient();

  // 1. Startup recovery: move stranded items back to main queue (run once)
  if (appEnv.WORKER_REQUEUE_STALE_ON_STARTUP) {
    console.log("Main: Requeueing stale processing items...");
    await leadQueue.requeueProcessing();
  }

  const concurrency = appEnv.WORKER_CONCURRENCY;
  console.log(`Main: Starting ${concurrency} concurrent lead processing loop(s)...`);

  const createJob = (runId: string) =>
    new ProcessLeadJob(postRepository, gtmAiClient, dorgApiClient, runId);

  // Start the lead processing loops concurrently
  for (let i = 0; i < concurrency; i++) {
    const loopRunId = `${processRunId}-lead-loop-${i}`;
    const loop = new ProcessQueueLoop(
      leadQueue,
      postRepository,
      createJob,
      loopRunId
    );

    loop.execute().catch((error) => {
      console.error(`Lead processing loop ${i} (ID: ${loopRunId}) failed:`, error);
    });
  }

  console.log(`Main: All ${concurrency} lead processing loop(s) are running.`);

  // Start the search worker loop
  const searchLoopRunId = `${processRunId}-search-loop`;
  const searchLoop = new SearchWorkerLoop(
    gtmAiClient,
    searchTermStore,
    leadQueue,
    postRepository,
    searchRunRepository,
    searchLoopRunId
  );

  console.log("Main: Starting search worker loop...");
  searchLoop.execute().catch((error) => {
    console.error(`Search worker loop (ID: ${searchLoopRunId}) failed:`, error);
  });

  console.log("Main: All worker loops are running.");
}

main().catch((error) => {
  console.error("Critical worker failure:", error);
  process.exit(1);
});
