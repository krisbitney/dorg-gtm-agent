import { LeadRepository } from "../storage/repositories/lead-repository.js";
import type { GtmAiClientInterface } from "../clients/gtm-ai-client.js";
import type { DorgApiClientInterface } from "../clients/dorg-api-client.js";
import { LeadStatus } from "../constants/lead-status.js";
import { mapPostToAiInput } from "../clients/gtm-ai-client.js";
import { buildSurfaceBrief } from "../worker/build-surface-brief.js";
import { appEnv } from "../config/app-env.js";

/**
 * Use case to process a single post through the AI and dOrg pipeline.
 */
export class ProcessLeadJob {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly gtmAiClient: GtmAiClientInterface,
    private readonly dorgApiClient: DorgApiClientInterface,
    private readonly workerRunId: string
  ) {}

  /**
   * Orchestrates the AI scoring, analysis, and dOrg claim/surface flow.
   */
  async execute(leadId: string) {
    console.log(`[Lead ${leadId}] Starting post processing job...`);

    // 1. Load the post
    const lead = await this.leadRepository.findById(leadId);
    if (!lead) {
      console.error(`[Lead ${leadId}] Lead not found in repository.`);
      throw new Error(`Lead not found: ${leadId}`);
    }

    // 2. Skip if already in a terminal state
    const terminalStatuses = [
      LeadStatus.BELOW_THRESHOLD,
      LeadStatus.NOT_A_LEAD,
      LeadStatus.COMPLETED,
    ];
    if (terminalStatuses.includes(lead.status as any)) {
      console.log(`[Lead ${leadId}] Lead is already in terminal state "${lead.status}", skipping.`);
      return;
    }

    const aiInput = mapPostToAiInput(lead);
    const context = {
      postId: leadId,
      platform: lead.platform,
      source: "worker",
      workerRunId: this.workerRunId,
    };

    // 3. Scoring
    if (lead.status === LeadStatus.PENDING || lead.status === LeadStatus.SCORING) {
      console.log(`[Lead ${leadId}] Step: Scoring post...`);
      await this.leadRepository.updateStatus(leadId, LeadStatus.SCORING);
      const scoreResult = await this.gtmAiClient.scoreLead(aiInput, context);
      
      console.log(`[Lead ${leadId}] Scoring complete. Probability: ${scoreResult.leadProbability}`);

      if (scoreResult.leadProbability < appEnv.LEAD_SCORE_THRESHOLD) {
        console.log(`[Lead ${leadId}] Lead probability ${scoreResult.leadProbability} is below threshold ${appEnv.LEAD_SCORE_THRESHOLD}. Marking as BELOW_THRESHOLD.`);
        await this.leadRepository.saveScore(leadId, scoreResult.leadProbability, LeadStatus.BELOW_THRESHOLD);
        return;
      }
      
      await this.leadRepository.saveScore(leadId, scoreResult.leadProbability, LeadStatus.ANALYZING);
      // Refresh local post object or just proceed as we know it's ANALYZING now
      lead.status = LeadStatus.ANALYZING;
    }

    // 4. Analysis
    if (lead.status === LeadStatus.ANALYZING) {
      console.log(`[Lead ${leadId}] Step: Analyzing post...`);
      const analysisResult = await this.gtmAiClient.analyzeLead(aiInput, context);
      
      console.log(`[Lead ${leadId}] Analysis complete. isLead: ${analysisResult.isLead}`);

      if (!analysisResult.isLead) {
        console.log(`[Lead ${leadId}] AI determined this is not a lead. Marking as NOT_A_LEAD.`);
        await this.leadRepository.updateStatus(leadId, LeadStatus.NOT_A_LEAD);
        return;
      }
      
      console.log(`[Lead ${leadId}] AI determined this IS a lead. Saving analysis.`);
      await this.leadRepository.saveAnalysis(
        leadId,
        {
          whyFit: analysisResult.whyFit,
          needs: analysisResult.needs,
          timing: analysisResult.timing,
          contactInfo: analysisResult.contactInfo,
        },
        LeadStatus.CLAIMING
      );
      lead.status = LeadStatus.CLAIMING;
      lead.whyFit = analysisResult.whyFit;
      lead.needs = analysisResult.needs;
      lead.timing = analysisResult.timing;
      lead.contactInfo = analysisResult.contactInfo;
    }

    // 5. dOrg Claim
    if (lead.status === LeadStatus.CLAIMING) {
      console.log(`[Lead ${leadId}] Step: Claiming lead in dOrg...`);
      // Idempotency check: if dorgLeadId already exists, skip claim
      if (lead.dorgLeadId) {
        console.log(`[Lead ${leadId}] Already has dorgLeadId ${lead.dorgLeadId}, skipping claim.`);
      } else {
        const claimResult = await this.dorgApiClient.claimLead({
          identifier: lead.url,
          channel: lead.platform,
        });

        if (!claimResult.success) {
          console.error(`[Lead ${leadId}] dOrg claim failed: ${claimResult.message}`);
          await this.leadRepository.markClaimFailed(leadId, claimResult.message || "Unknown claim failure");
          return;
        }

        console.log(`[Lead ${leadId}] dOrg claim successful. leadId: ${claimResult.leadId}`);
        await this.leadRepository.saveDorgLeadId(leadId, claimResult.leadId!, LeadStatus.SURFACING);
        lead.dorgLeadId = claimResult.leadId!;
      }
      lead.status = LeadStatus.SURFACING;
    }

    // 6. dOrg Surface
    if (lead.status === LeadStatus.SURFACING) {
      console.log(`[Lead ${leadId}] Step: Surfacing lead to dOrg...`);
      const brief = buildSurfaceBrief(lead);
      const surfaceResult = await this.dorgApiClient.surfaceLead({
        leadId: lead.dorgLeadId!,
        brief,
      });

      if (!surfaceResult.success) {
        console.error(`[Lead ${leadId}] dOrg surface failed: ${surfaceResult.message}`);
        throw new Error(surfaceResult.message || "Failed to surface lead");
      }

      console.log(`[Lead ${leadId}] dOrg surface successful. Marking as COMPLETED.`);
      await this.leadRepository.markCompleted(leadId);

      try {
        console.log(`[Lead ${leadId}] Step: Sending surface brief as message...`);
        const sendMessageResult = await this.dorgApiClient.sendMessage({ content: brief })
        if (!sendMessageResult.success) {
          console.error(`[Lead ${leadId}] Failed to send message to dOrg. Status: ${sendMessageResult.status}. Message: ${sendMessageResult.message}`);
          return;
        }
        console.log(`[Lead ${leadId}] Message sent successfully.`);
      } catch (e) {
        console.error(`[Lead ${leadId}] Error sending message to dOrg:`, e);
        return;
      }
    }
    console.log(`[Lead ${leadId}] Lead processing job completed successfully.`);
  }
}
