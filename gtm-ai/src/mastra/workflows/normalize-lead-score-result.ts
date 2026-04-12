import { LeadScoreResult } from "../schemas/lead-score-result-schema";

/**
 * Normalizes the raw lead score result by clamping it between 0 and 1
 * and rounding to 3 decimal places.
 */
export const normalizeLeadScoreResult = (result: LeadScoreResult): LeadScoreResult => {
  const clamped = Math.max(0, Math.min(1, result.leadProbability));
  const rounded = Math.round(clamped * 1000) / 1000;
  return { leadProbability: rounded };
};
