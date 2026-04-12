import { z } from "zod";

/**
 * Schema for the dOrg surface lead response.
 */
export const dorgSurfaceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}).optional();

export type DorgSurfaceResponse = z.infer<typeof dorgSurfaceResponseSchema>;
