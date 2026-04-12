import { z } from "zod";

/**
 * Schema for the dOrg claim lead response.
 */
export const dorgClaimResponseSchema = z.object({
  lead_id: z.string().min(1),
});

export type DorgClaimResponse = z.infer<typeof dorgClaimResponseSchema>;
