import { z } from "zod";

/**
 * Schema for the raw output from the lead analysis agent.
 * This is used as an intermediate step before normalizing into the public union result.
 */
export const LeadAnalysisRawResultSchema = z.object({
  isLead: z.boolean(),
  whyFit: z.string().nullable().describe("Why the lead is a fit for dOrg's tech/dev consultancy"),
  needs: z.string().nullable().describe("What the lead source (the post writer) needs"),
  timing: z.string().nullable().describe("If the user states a timeframe, what it is"),
  contactInfo: z.string().nullable().describe("Any available contact information"),
});

export type LeadAnalysisRawResult = z.infer<typeof LeadAnalysisRawResultSchema>;