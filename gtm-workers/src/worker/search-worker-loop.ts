import type { GtmAiClientInterface } from "../clients/gtm-ai-client.js";
import type { SearchTermDedupStoreInterface } from "../storage/search-term-store.js";
import type { LeadQueueInterface } from "../storage/lead-queue.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import { SearchRunRepository } from "../storage/repositories/search-run-repository.js";
import { SearchWorkerJob } from "./search-worker-job.js";
import { SupportedPlatforms } from "../schemas/platform.js";
import { appEnv } from "../config/app-env.js";
import type {UrlDedupStoreInterface} from "../storage/url-dedup-store.js";

export class SearchWorkerLoop {
  constructor(
    private readonly gtmAiClient: GtmAiClientInterface,
    private readonly searchTermStore: SearchTermDedupStoreInterface,
    private readonly urlDedupStore: UrlDedupStoreInterface,
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
      this.urlDedupStore,
      this.leadQueue,
      this.leadRepository,
      this.searchRunRepository,
      this.workerRunId
    );

    let platformIndex = 0;

    while (true) {
      const queueSize = await this.leadQueue.length();
      if (queueSize >= appEnv.SEARCH_QUEUE_MAX_SIZE) {
        console.log(`[SearchWorker ${this.workerRunId}] Lead queue at ${queueSize} (max ${appEnv.SEARCH_QUEUE_MAX_SIZE}). Backing off for ${appEnv.SEARCH_LOOP_DELAY_MS}ms...`);
        await Bun.sleep(appEnv.SEARCH_LOOP_DELAY_MS);
        continue;
      }

      const platform = SupportedPlatforms[platformIndex]!;
      platformIndex = (platformIndex + 1) % SupportedPlatforms.length;

      console.log(`[SearchWorker ${this.workerRunId}] Running search for platform: ${platform.name} (${platform.url})`);

      try {
        await job.execute(platform);
      } catch (error: any) {
        console.error(`[SearchWorker ${this.workerRunId}] Search iteration failed for ${platform.name}:`, error.message);
      }
    }
  }
}
