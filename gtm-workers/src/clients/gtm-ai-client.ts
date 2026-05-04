import { MastraClient } from "@mastra/client-js";
import { appEnv } from "../config/app-env.js";
import type { Lead } from "../storage/schema/leads-table.js";

/**
 * Input for the scoring and analysis GTM AI workflows.
 */
export interface LeadScoreAndAnalysisInput {
  id: string;
  platform: string;
  url: string;
  content: any;
  targetDescription: string;
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
      timing: string | null;
      contactInfo: string;
    };

/** Input for the search term generation workflow. */
export interface SearchTermGenerationInput {
  numberOfSearchTerms?: number;
  /** Target site to search on (e.g. "https://reddit.com", "https://linkedin.com") */
  sourceUrl: string;
  targetDescription: string;
}

/** Output from the search term generation workflow. */
export interface SearchTermGenerationOutput {
  queries: string[];
}

/** State for the search-and-filter workflow (persists across steps). */
export interface SearchAndFilterState {
  searchQuery: string;
  /** Target site to search on (e.g. "https://reddit.com", "https://linkedin.com") */
  sourceUrl: string;
  startDateTime: string;
  endDateTime: string;
  pages?: number;
  targetDescription: string;
}

/** A raw scraped lead from the search-and-filter workflow. */
export interface ScrapedLead {
  url: string;
  content: string;
}

/** Output from the search-and-filter workflow. */
export interface SearchAndFilterOutput {
  leads: ScrapedLead[];
}

/**
 * Interface for the GTM AI client.
 */
export interface GtmAiClientInterface {
  scoreLead(lead: LeadScoreAndAnalysisInput, context: any): Promise<GtmAiScoreResult>;
  analyzeLead(lead: LeadScoreAndAnalysisInput, context: any): Promise<GtmAiAnalysisResult>;
  generateSearchTerms(input: SearchTermGenerationInput, context: any): Promise<SearchTermGenerationOutput>;
  searchAndFilter(state: SearchAndFilterState, context: any): Promise<SearchAndFilterOutput>;
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

  // TODO: handle other retryable error types
  private async runWithRetries<T>(
    options: {
      workflowName: string;
      operation: () => Promise<{ run: any; promise: Promise<T> }>;
    }
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        const { run, promise } = await options.operation();
        return await this.runWithTimeout({
          workflowName: options.workflowName,
          operation: promise,
          onTimeout: async () => {
            console.warn(`GTM AI client ${options.workflowName} timed out. Cancelling run ${run.runId}...`);
            try {
              await run.cancel();
            } catch (cancelError) {
              console.error(`Failed to cancel run ${run.runId}:`, cancelError);
            }
          },
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
      onTimeout?: () => Promise<void>;
    }
  ): Promise<T> {
    const timeoutPromise: Promise<never> = new Promise((_, reject) => {
      const timer = setTimeout(async () => {
        if (options.onTimeout) {
          await options.onTimeout();
        }
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
  async scoreLead(lead: LeadScoreAndAnalysisInput, context: any): Promise<GtmAiScoreResult> {
    const workflow = this.client.getWorkflow("leadScoreWorkflow");

    const result = await this.runWithRetries({
      workflowName: "leadScoreWorkflow",
      operation: async () => {
        const run = await workflow.createRun();
        return {
          run,
          promise: run.startAsync({
            inputData: lead,
            requestContext: context,
          }),
        };
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
  async analyzeLead(lead: LeadScoreAndAnalysisInput, context: any): Promise<GtmAiAnalysisResult> {
    const workflow = this.client.getWorkflow("leadAnalysisWorkflow");

    const result = await this.runWithRetries({
      workflowName: "leadAnalysisWorkflow",
      operation: async () => {
        const run = await workflow.createRun();
        return {
          run,
          promise: run.startAsync({
            inputData: lead,
            requestContext: context,
          }),
        };
      },
    });

    if (result.status !== "success") {
      const errorMsg = result.status === "failed" ? `: ${result.error.message}` : "";
      throw new Error(`GTM AI analysis workflow failed with status ${result.status}${errorMsg}`);
    }

    return result.result as GtmAiAnalysisResult;
  }

  /**
   * Calls the search term generation workflow to produce query strings for a site.
   */
  async generateSearchTerms(input: SearchTermGenerationInput, context: any): Promise<SearchTermGenerationOutput> {
    const workflow = this.client.getWorkflow("search-term-generation-workflow");

    const result = await this.runWithRetries({
      workflowName: "search-term-generation-workflow",
      operation: async () => {
        const run = await workflow.createRun();
        return {
          run,
          promise: run.startAsync({
            inputData: input,
            requestContext: context,
          }),
        };
      },
    });

    if (result.status !== "success") {
      const errorMsg = result.status === "failed" ? `: ${result.error.message}` : "";
      throw new Error(`Search term generation workflow failed with status ${result.status}${errorMsg}`);
    }

    return result.result as SearchTermGenerationOutput;
  }

  /**
   * Calls the search-and-filter workflow. Accepts state fields via initialState
   * since the workflow's input schema is empty and all data lives in state.
   */
  async searchAndFilter(state: SearchAndFilterState, context: any): Promise<SearchAndFilterOutput> {
    const workflow = this.client.getWorkflow("search-and-filter-workflow");

    const result = await this.runWithRetries({
      workflowName: "search-and-filter-workflow",
      operation: async () => {
        const run = await workflow.createRun();
        return {
          run,
          promise: run.startAsync({
            inputData: {},
            initialState: state,
            requestContext: context,
          }),
        };
      },
    });

    if (result.status !== "success") {
      const errorMsg = result.status === "failed" ? `: ${result.error.message}` : "";
      throw new Error(`Search and filter workflow failed with status ${result.status}${errorMsg}`);
    }

    return result.result as SearchAndFilterOutput;
  }
}

/**
 * Maps a database lead row to the GTM AI input shape.
 */
export function mapLeadToAiLeadScoreAndAnalysisInput(lead: Lead, targetDescription: string): LeadScoreAndAnalysisInput {
  return {
    id: lead.id,
    platform: lead.platform,
    url: lead.url,
    content: lead.content,
    targetDescription,
  };
}
