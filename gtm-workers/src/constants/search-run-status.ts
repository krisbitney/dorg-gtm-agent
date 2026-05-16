export const SearchRunStatus = {
  SEARCHING: "searching",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type SearchRunStatusType = typeof SearchRunStatus[keyof typeof SearchRunStatus];
