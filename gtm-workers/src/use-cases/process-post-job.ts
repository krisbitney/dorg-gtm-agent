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
    console.log(`[Post ${postId}] Starting post processing job...`);

    // 1. Load the post
    const post = await this.postRepository.findById(postId);
    if (!post) {
      console.error(`[Post ${postId}] Post not found in repository.`);
      throw new Error(`Post not found: ${postId}`);
    }

    // 2. Skip if already in a terminal state
    const terminalStatuses = [
      PostStatus.BELOW_THRESHOLD,
      PostStatus.NOT_A_LEAD,
      PostStatus.COMPLETED,
    ];
    if (terminalStatuses.includes(post.status as any)) {
      console.log(`[Post ${postId}] Post is already in terminal state "${post.status}", skipping.`);
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
      console.log(`[Post ${postId}] Step: Scoring post...`);
      await this.postRepository.updateStatus(postId, PostStatus.SCORING);
      const scoreResult = await this.gtmAiClient.scorePost(aiInput, context);
      
      console.log(`[Post ${postId}] Scoring complete. Probability: ${scoreResult.leadProbability}`);

      if (scoreResult.leadProbability < appEnv.LEAD_SCORE_THRESHOLD) {
        console.log(`[Post ${postId}] Lead probability ${scoreResult.leadProbability} is below threshold ${appEnv.LEAD_SCORE_THRESHOLD}. Marking as BELOW_THRESHOLD.`);
        await this.postRepository.saveScore(postId, scoreResult.leadProbability, PostStatus.BELOW_THRESHOLD);
        return;
      }
      
      await this.postRepository.saveScore(postId, scoreResult.leadProbability, PostStatus.ANALYZING);
      // Refresh local post object or just proceed as we know it's ANALYZING now
      post.status = PostStatus.ANALYZING;
    }

    // 4. Analysis
    if (post.status === PostStatus.ANALYZING) {
      console.log(`[Post ${postId}] Step: Analyzing post...`);
      const analysisResult = await this.gtmAiClient.analyzePost(aiInput, context);
      
      console.log(`[Post ${postId}] Analysis complete. isLead: ${analysisResult.isLead}`);

      if (!analysisResult.isLead) {
        console.log(`[Post ${postId}] AI determined this is not a lead. Marking as NOT_A_LEAD.`);
        await this.postRepository.updateStatus(postId, PostStatus.NOT_A_LEAD);
        return;
      }
      
      console.log(`[Post ${postId}] AI determined this IS a lead. Saving analysis.`);
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
      console.log(`[Post ${postId}] Step: Claiming lead in dOrg...`);
      // Idempotency check: if dorgLeadId already exists, skip claim
      if (post.dorgLeadId) {
        console.log(`[Post ${postId}] Already has dorgLeadId ${post.dorgLeadId}, skipping claim.`);
      } else {
        const claimResult = await this.dorgApiClient.claimLead({
          identifier: post.url,
          channel: post.platform,
        });

        if (!claimResult.success) {
          console.error(`[Post ${postId}] dOrg claim failed: ${claimResult.message}`);
          await this.postRepository.markClaimFailed(postId, claimResult.message || "Unknown claim failure");
          return;
        }

        console.log(`[Post ${postId}] dOrg claim successful. leadId: ${claimResult.leadId}`);
        await this.postRepository.saveDorgLeadId(postId, claimResult.leadId!, PostStatus.SURFACING);
        post.dorgLeadId = claimResult.leadId!;
      }
      post.status = PostStatus.SURFACING;
    }

    // 6. dOrg Surface
    if (post.status === PostStatus.SURFACING) {
      console.log(`[Post ${postId}] Step: Surfacing lead to dOrg...`);
      const brief = buildSurfaceBrief(post);
      const surfaceResult = await this.dorgApiClient.surfaceLead({
        leadId: post.dorgLeadId!,
        brief,
      });

      if (!surfaceResult.success) {
        console.error(`[Post ${postId}] dOrg surface failed: ${surfaceResult.message}`);
        throw new Error(surfaceResult.message || "Failed to surface lead");
      }

      console.log(`[Post ${postId}] dOrg surface successful. Marking as COMPLETED.`);
      await this.postRepository.markCompleted(postId);

      try {
        console.log(`[Post ${postId}] Step: Sending surface brief as message...`);
        const sendMessageResult = await this.dorgApiClient.sendMessage({ content: brief })
        if (!sendMessageResult.success) {
          console.error(`[Post ${postId}] Failed to send message to dOrg. Status: ${sendMessageResult.status}. Message: ${sendMessageResult.message}`);
          return;
        }
        console.log(`[Post ${postId}] Message sent successfully.`);
      } catch (e) {
        console.error(`[Post ${postId}] Error sending message to dOrg:`, e);
        return;
      }
    }
    console.log(`[Post ${postId}] Post processing job completed successfully.`);
  }
}
