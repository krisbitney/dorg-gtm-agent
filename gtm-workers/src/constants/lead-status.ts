/**
 * Enumeration of all possible states for a post as it moves through the worker pipeline.
 */
export const LeadStatus = {
  PENDING: "pending",
  SCORING: "scoring",
  BELOW_THRESHOLD: "below_threshold",
  ANALYZING: "analyzing",
  NOT_A_LEAD: "not_a_lead",
  CLAIMING: "claiming",
  CLAIM_FAILED: "claim_failed",
  SURFACING: "surfacing",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type LeadStatusType = typeof LeadStatus[keyof typeof LeadStatus];
