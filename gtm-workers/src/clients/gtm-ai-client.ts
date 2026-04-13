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
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;

  constructor() {
    this.client = new MastraClient({
      baseUrl: appEnv.GTM_AI_BASE_URL,
    });
    this.timeoutMs = appEnv.GTM_AI_REQUEST_TIMEOUT_MS;
    this.maxRetries = appEnv.GTM_AI_MAX_RETRIES;
    this.retryBaseDelayMs = appEnv.GTM_AI_RETRY_BASE_DELAY_MS;
    this.retryMaxDelayMs = appEnv.GTM_AI_RETRY_MAX_DELAY_MS;
  }

  private async runWithRetries<T>(
    options: {
      workflowName: string;
      operation: () => Promise<T>;
    }
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await this.runWithTimeout({
          workflowName: options.workflowName,
          operation: options.operation(),
        });
      } catch (error: any) {
        attempt++;
        const isTimeout = error.message?.includes("timed out");
        
        if (attempt > this.maxRetries || !isTimeout) {
          throw error;
        }

        const delayMs = Math.min(
          this.retryBaseDelayMs * Math.pow(2, attempt - 1),
          this.retryMaxDelayMs
        );

        console.warn(
          `GTM AI client ${options.workflowName} attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`
        );
        
        await Bun.sleep(delayMs);
      }
    }
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
    
    const result = await this.runWithRetries({
      workflowName: "leadScoreWorkflow",
      operation: async () => {
        const run = await workflow.createRun();
        return run.startAsync({
          inputData: post,
          requestContext: context,
        });
      },
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
    
    const result = await this.runWithRetries({
      workflowName: "leadAnalysisWorkflow",
      operation: async () => {
        const run = await workflow.createRun();
        return run.startAsync({
          inputData: post,
          requestContext: context,
        });
      },
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
