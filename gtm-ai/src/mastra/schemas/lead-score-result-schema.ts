import { z } from "zod";

/**
 * Schema for the output of the lead score workflow.
 */
export const LeadScoreResultSchema = z.object({
  leadProbability: z.number().min(0).max(1),
});

export type LeadScoreResult = z.infer<typeof LeadScoreResultSchema>;
