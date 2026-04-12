import { appEnv } from "../config/app-env.js";
import type { Post } from "../storage/schema/posts-table.js";

/**
 * Input for the GTM AI workflows.
 */
export interface GtmAiInput {
  id: string;
  platform: string;
  topic: string;
  url: string;
  username: string | null;
  content: string;
  likes: number | null;
  nComments: number | null;
  postedAt: string; // ISO datetime
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
 * Concrete implementation of GtmAiClient using HTTP to communicate with the mastra service.
 */
export class GtmAiClient implements GtmAiClientInterface {
  private readonly baseUrl = appEnv.GTM_AI_BASE_URL;
  private readonly timeout = appEnv.GTM_AI_REQUEST_TIMEOUT_MS;

  /**
   * Calls the GTM AI score workflow.
   */
  async scorePost(post: GtmAiInput, context: any): Promise<GtmAiScoreResult> {
    const response = await fetch(`${this.baseUrl}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post, context }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`GTM AI score request failed: ${response.statusText}`);
    }

    return (await response.json()) as GtmAiScoreResult;
  }

  /**
   * Calls the GTM AI analysis workflow.
   */
  async analyzePost(post: GtmAiInput, context: any): Promise<GtmAiAnalysisResult> {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post, context }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`GTM AI analysis request failed: ${response.statusText}`);
    }

    return (await response.json()) as GtmAiAnalysisResult;
  }
}

/**
 * Maps a database post row to the GTM AI input shape.
 */
export function mapPostToAiInput(post: Post): GtmAiInput {
  return {
    id: post.id,
    platform: post.platform,
    topic: post.topic,
    url: post.url,
    username: post.username,
    content: post.content,
    postedAt: post.postedAt.toISOString(),
    likes: post.likes,
    nComments: post.nComments,
  };
}
