import { z } from "zod";

/**
 * Schema for the main lead processing queue payload.
 */
export const queuePayloadSchema = z.object({
  id: z.uuid(),
  url: z.string(),
});

export type QueuePayload = z.infer<typeof queuePayloadSchema>;
