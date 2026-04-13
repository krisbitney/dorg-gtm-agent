import { MastraClient } from "@mastra/client-js";
import { appEnv } from "../config/app-env.js";
import type { Post } from "../storage/schema/posts-table.js";

/**
 * Input for the GTM AI workflows.
 */
export interface GtmAiInput {
  id: string;
  platform: string;
  url: string;
  post: any;
}

/**
 * Result from the lead scoring workflow.
 */
export interface GtmAiScoreResult {
  leadProbability: number;
}

/**
 * Result from the lead analysis workflow.
 */
export type GtmAiAnalysisResult =
  | { isLead: false }
  | {
      isLead: true;
      whyFit: string;
      needs: string;
      timing: string;
      contactInfo: string;
    };

/**
 * Interface for the GTM AI client.
 */
export interface GtmAiClientInterface {
  scorePost(post: GtmAiInput, context: any): Promise<GtmAiScoreResult>;
  analyzePost(post: GtmAiInput, context: any): Promise<GtmAiAnalysisResult>;
}

/**
 * Concrete implementation of GtmAiClient using Mastra AI client SDK to communicate with the mastra service.
 */
export class GtmAiClient implements GtmAiClientInterface {
  private readonly client: MastraClient;
  private readonly timeoutMs: number;

  constructor() {
    this.client = new MastraClient({
      baseUrl: appEnv.GTM_AI_BASE_URL,
    });
    this.timeoutMs = appEnv.GTM_AI_REQUEST_TIMEOUT_MS;
  }

  private async runWithTimeout<T>(
    options: {
      workflowName: string;
      operation: Promise<T>;
    }
  ): Promise<T> {
    const timeoutPromise: Promise<never> = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(`${options.workflowName} timed out after ${this.timeoutMs}ms`)
        );
      }, this.timeoutMs);

      options.operation.finally(() => clearTimeout(timer)).catch(() => {
        // Swallow to avoid unhandled rejection in the timeout helper path.
      });
    });

    return Promise.race([options.operation, timeoutPromise]);
  }

  /**
   * Calls the GTM AI score workflow.
   */
  async scorePost(post: GtmAiInput, context: any): Promise<GtmAiScoreResult> {
    const workflow = this.client.getWorkflow("leadScoreWorkflow");
    const run = await workflow.createRun();
    const result = await this.runWithTimeout({
      workflowName: "leadScoreWorkflow",
      operation: run.startAsync({
        inputData: post,
        requestContext: context,
      }),
    });

    if (result.status !== "success") {
      const errorMsg = result.status === "failed" ? `: ${result.error.message}` : "";
      throw new Error(`GTM AI score workflow failed with status ${result.status}${errorMsg}`);
    }

    return result.result as GtmAiScoreResult;
  }

  /**
   * Calls the GTM AI analysis workflow.
   */
  async analyzePost(post: GtmAiInput, context: any): Promise<GtmAiAnalysisResult> {
    const workflow = this.client.getWorkflow("leadAnalysisWorkflow");
    const run = await workflow.createRun();
    const result = await this.runWithTimeout({
      workflowName: "leadAnalysisWorkflow",
      operation: run.startAsync({
        inputData: post,
        requestContext: context,
      }),
    });

    if (result.status !== "success") {
      const errorMsg = result.status === "failed" ? `: ${result.error.message}` : "";
      throw new Error(`GTM AI analysis workflow failed with status ${result.status}${errorMsg}`);
    }

    return result.result as GtmAiAnalysisResult;
  }
}

/**
 * Maps a database post row to the GTM AI input shape.
 */
export function mapPostToAiInput(post: Post): GtmAiInput {
  return {
    id: post.id,
    platform: post.platform,
    url: post.url,
    post: post.post,
  };
}
