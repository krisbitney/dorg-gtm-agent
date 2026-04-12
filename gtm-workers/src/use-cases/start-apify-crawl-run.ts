import { appEnv } from "../config/app-env.js";
import type { ApifyCrawlerClientInterface } from "../clients/apify-crawler-client.js";
import { CrawlRunRepository } from "../storage/repositories/crawl-run-repository.js";
import { RoutePaths } from "../constants/route-paths.js";

/**
 * Use case to start an Apify crawl run.
 */
export class StartApifyCrawlRun {
  constructor(
    private readonly apifyClient: ApifyCrawlerClientInterface,
    private readonly crawlRunRepository: CrawlRunRepository
  ) {}

  /**
   * Orchestrates starting the actor and recording the run in the database.
   */
  async execute(options: { platform: string, actorId?: string, source?: string }) {
    const webhookUrl = `${appEnv.WORKERS_PUBLIC_BASE_URL}${RoutePaths.APIFY_WEBHOOK}?platform=${options.platform}`;
    const actorId = options.actorId || appEnv.APIFY_ACTOR_ID;

    // 1. Start the actor asynchronously
    const run = await this.apifyClient.startActor({
      actorId,
      webhookUrl,
      webhookSecret: appEnv.APIFY_WEBHOOK_SECRET,
    });

    // 2. Record the started run in our database
    await this.crawlRunRepository.upsertStartedRun({
      apifyRunId: run.id,
      actorId: run.actorId,
      source: options.source || "manual",
      defaultDatasetId: run.defaultDatasetId,
    });

    return {
      apifyRunId: run.id,
      actorId: run.actorId,
      status: run.status,
      webhookUrl,
    };
  }
}
