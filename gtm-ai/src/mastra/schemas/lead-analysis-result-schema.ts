import { z } from "zod";

/**
 * Schema for the output of the lead analysis workflow.
 * This is a discriminated union to allow branching logic in callers.
 */
export const LeadAnalysisResultSchema = z.discriminatedUnion("isLead", [
  z.object({
    isLead: z.literal(false),
  }).strict(),
  z.object({
    isLead: z.literal(true),
    whyFit: z.string(),
    needs: z.string(),
    timing: z.string(),
    contactInfo: z.string(),
  }).strict(),
]);

export type LeadAnalysisResult = z.infer<typeof LeadAnalysisResultSchema>;
