import { z } from "zod";

/**
 * Schema for the dead-letter queue payload.
 */
export const deadLetterPayloadSchema = z.object({
  id: z.string().optional(),
  platform: z.string().optional(),
  stage: z.string().min(1),
  errorMessage: z.string().min(1),
  failedAt: z.iso.datetime(),
  originalPayload: z.string(),
});

export type DeadLetterPayload = z.infer<typeof deadLetterPayloadSchema>;
