import { LeadAnalysisRawResult } from "../schemas/lead-analysis-raw-result-schema";
import { LeadAnalysisResult } from "../schemas/lead-analysis-result-schema";

/**
 * Normalizes the raw lead analysis result into the public discriminated union.
 * Ensures mandatory fields are present for leads and handles missing optional fields.
 */
export const normalizeLeadAnalysisResult = (result: LeadAnalysisRawResult): LeadAnalysisResult => {
  if (!result.isLead) {
    return { isLead: false };
  }

  // If it is a lead, ensure mandatory fields are present
  if (!result.whyFit || !result.needs) {
    throw new Error('Lead analysis result is missing mandatory fields: whyFit or needs');
  }

  return {
    isLead: true,
    whyFit: result.whyFit.trim(),
    needs: result.needs.trim(),
    timing: result.timing?.trim() || null,
    contactInfo: result.contactInfo?.trim() || null,
  };
};
