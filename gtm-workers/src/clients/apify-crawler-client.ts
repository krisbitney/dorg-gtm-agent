import { ApifyClient } from "apify-client";
import { appEnv } from "../config/app-env.js";

/**
 * Interface for the Apify crawler client.
 */
export interface ApifyCrawlerClientInterface {
  startActor(options: {
    actorId: string;
    webhookUrl: string;
    webhookSecret: string;
  }): Promise<{
    id: string;
    actorId: string;
    status: string;
    defaultDatasetId?: string;
  }>;
  getRun(runId: string): Promise<{
    id: string;
    status: string;
    defaultDatasetId?: string;
  }>;
  getDatasetItems(datasetId: string, options?: { limit: number; offset: number }): Promise<any[]>;
}

/**
 * Concrete implementation of ApifyCrawlerClient using the official Apify JS SDK.
 */
export class ApifyCrawlerClient implements ApifyCrawlerClientInterface {
  private readonly client = new ApifyClient({ token: appEnv.APIFY_TOKEN });

  /**
   * Starts an Apify actor asynchronously and configures a webhook for run terminal states.
   */
  async startActor({
    actorId,
    webhookUrl,
    webhookSecret,
  }: {
    actorId: string;
    webhookUrl: string;
    webhookSecret: string;
  }) {
    // We use a custom payload template to match our ApifyRunWebhook schema
    const payloadTemplate = JSON.stringify({
      eventType: "{{eventType}}",
      actorId: "{{resource.actId}}",
      apifyRunId: "{{resource.id}}",
      status: "{{resource.status}}",
      defaultDatasetId: "{{resource.defaultDatasetId}}",
      finishedAt: "{{resource.finishedAt}}",
    });

    const run = await this.client.actor(actorId).start(undefined, {
      webhooks: [
        {
          eventTypes: [
            "ACTOR.RUN.SUCCEEDED",
            "ACTOR.RUN.ABORTED",
            "ACTOR.RUN.TIMED_OUT",
            "ACTOR.BUILD.FAILED"
          ],
          requestUrl: `${webhookUrl}?secret=${webhookSecret}`,
          payloadTemplate,
        },
      ],
    });

    return {
      id: run.id,
      actorId: run.actId,
      status: run.status,
      defaultDatasetId: run.defaultDatasetId,
    };
  }

  /**
   * Fetches details for a specific actor run.
   */
  async getRun(runId: string) {
    const run = await this.client.run(runId).get();
    if (!run) {
      throw new Error(`Apify run not found: ${runId}`);
    }
    return {
      id: run.id,
      status: run.status,
      defaultDatasetId: run.defaultDatasetId,
    };
  }

  /**
   * Fetches items from an Apify dataset with pagination.
   */
  async getDatasetItems(datasetId: string, options: { limit: number; offset: number } = { limit: 100, offset: 0 }): Promise<any[]> {
    const { items } = await this.client.dataset(datasetId).listItems({
      limit: options.limit,
      offset: options.offset,
    });
    return items;
  }
}
