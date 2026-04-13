import { PostRepository } from "../storage/repositories/post-repository.js";
import type { GtmAiClientInterface } from "../clients/gtm-ai-client.js";
import type { DorgApiClientInterface } from "../clients/dorg-api-client.js";
import { PostStatus } from "../constants/post-status.js";
import { mapPostToAiInput } from "../clients/gtm-ai-client.js";
import { buildSurfaceBrief } from "../worker/build-surface-brief.js";
import { appEnv } from "../config/app-env.js";

/**
 * Use case to process a single post through the AI and dOrg pipeline.
 */
export class ProcessPostJob {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly gtmAiClient: GtmAiClientInterface,
    private readonly dorgApiClient: DorgApiClientInterface,
    private readonly workerRunId: string
  ) {}

  /**
   * Orchestrates the AI scoring, analysis, and dOrg claim/surface flow.
   */
  async execute(postId: string) {
    // 1. Load the post
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    // 2. Skip if already in a terminal state
    const terminalStatuses = [
      PostStatus.BELOW_THRESHOLD,
      PostStatus.NOT_A_LEAD,
      PostStatus.COMPLETED,
    ];
    if (terminalStatuses.includes(post.status as any)) {
      console.log(`Post ${postId} is already in terminal state ${post.status}, skipping.`);
      return;
    }

    const aiInput = mapPostToAiInput(post);
    const context = {
      postId,
      platform: post.platform,
      source: "worker",
      workerRunId: this.workerRunId,
    };

    // 3. Scoring
    if (post.status === PostStatus.PENDING || post.status === PostStatus.SCORING) {
      await this.postRepository.updateStatus(postId, PostStatus.SCORING);
      const scoreResult = await this.gtmAiClient.scorePost(aiInput, context);
      
      if (scoreResult.leadProbability < appEnv.LEAD_SCORE_THRESHOLD) {
        await this.postRepository.saveScore(postId, scoreResult.leadProbability, PostStatus.BELOW_THRESHOLD);
        return;
      }
      
      await this.postRepository.saveScore(postId, scoreResult.leadProbability, PostStatus.ANALYZING);
      // Refresh local post object or just proceed as we know it's ANALYZING now
      post.status = PostStatus.ANALYZING;
    }

    // 4. Analysis
    if (post.status === PostStatus.ANALYZING) {
      const analysisResult = await this.gtmAiClient.analyzePost(aiInput, context);
      
      if (!analysisResult.isLead) {
        await this.postRepository.updateStatus(postId, PostStatus.NOT_A_LEAD);
        return;
      }
      
      await this.postRepository.saveAnalysis(
        postId,
        {
          whyFit: analysisResult.whyFit,
          needs: analysisResult.needs,
          timing: analysisResult.timing,
          contactInfo: analysisResult.contactInfo,
        },
        PostStatus.CLAIMING
      );
      post.status = PostStatus.CLAIMING;
      post.whyFit = analysisResult.whyFit;
      post.needs = analysisResult.needs;
      post.timing = analysisResult.timing;
      post.contactInfo = analysisResult.contactInfo;
    }

    // 5. dOrg Claim
    if (post.status === PostStatus.CLAIMING) {
      // Idempotency check: if dorgLeadId already exists, skip claim
      if (post.dorgLeadId) {
        console.log(`Post ${postId} already has dorgLeadId ${post.dorgLeadId}, skipping claim.`);
      } else {
        const claimResult = await this.dorgApiClient.claimLead({
          identifier: post.url,
          channel: post.platform,
        });

        if (!claimResult.success) {
          await this.postRepository.markClaimFailed(postId, claimResult.message || "Unknown claim failure");
          return;
        }

        await this.postRepository.saveDorgLeadId(postId, claimResult.leadId!, PostStatus.SURFACING);
        post.dorgLeadId = claimResult.leadId!;
      }
      post.status = PostStatus.SURFACING;
    }

    // 6. dOrg Surface
    if (post.status === PostStatus.SURFACING) {
      const brief = buildSurfaceBrief(post);
      const surfaceResult = await this.dorgApiClient.surfaceLead({
        leadId: post.dorgLeadId!,
        brief,
      });

      if (!surfaceResult.success) {
        throw new Error(surfaceResult.message || "Failed to surface lead");
      }

      await this.postRepository.markCompleted(postId);

      try {
        const sendMessageResult = await this.dorgApiClient.sendMessage({ content: brief })
        if (!sendMessageResult.success) {
          console.error(`Failed to send message to dOrg. Status: ${sendMessageResult.status}. Message: ${sendMessageResult.message}`);
          return;
        }
      } catch (e) {
        console.error("Failed to send message to dOrg:", e);
        return;
      }
    }
  }
}
