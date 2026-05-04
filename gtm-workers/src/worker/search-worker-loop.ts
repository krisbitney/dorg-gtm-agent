import type { GtmAiClientInterface } from "../clients/gtm-ai-client.js";
import type { SearchTermDedupStoreInterface } from "../storage/search-term-store.js";
import type { LeadQueueInterface } from "../storage/lead-queue.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import { SearchRunRepository } from "../storage/repositories/search-run-repository.js";
import { SearchWorkerJob } from "./search-worker-job.js";
import { appEnv } from "../config/app-env.js";
import {SupportedPlatforms} from "../schemas/platform.ts";

export class SearchWorkerLoop {
  constructor(
    private readonly gtmAiClient: GtmAiClientInterface,
    private readonly searchTermStore: SearchTermDedupStoreInterface,
    private readonly leadQueue: LeadQueueInterface,
    private readonly leadRepository: LeadRepository,
    private readonly searchRunRepository: SearchRunRepository,
    private readonly workerRunId: string
  ) {}

  async execute(): Promise<void> {
    console.log(`[SearchWorker ${this.workerRunId}] Starting search worker loop...`);

    const job = new SearchWorkerJob(
      this.gtmAiClient,
      this.searchTermStore,
      this.leadQueue,
      this.leadRepository,
      this.searchRunRepository,
      this.workerRunId
    );

    // TODO: handle multiple sites/platforms, rotating between them. The job.execute method should accept a platform, and the job should use it instead of SEARCH_SITE in the appEnv.
    const supportedPlatforms = SupportedPlatforms;

    while (true) {
      // TODO: if the lead queue has more than 50 members (configurable), sleep for search loop delay
      try {
        await job.execute();
      } catch (error: any) {
        console.error(`[SearchWorker ${this.workerRunId}] Search iteration failed:`, error.message);
      }

      console.log(`[SearchWorker ${this.workerRunId}] Waiting ${appEnv.SEARCH_LOOP_DELAY_MS}ms before next iteration...`);
      await Bun.sleep(appEnv.SEARCH_LOOP_DELAY_MS);
    }
  }
}
