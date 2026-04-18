import { z } from "zod";
import { apifyRedditPostSchema } from "./apify-reddit-post-schema.js";

/**
 * Mapping of platform names to their respective Apify dataset item schemas.
 */
export const platformSchemas: Record<string, z.ZodSchema<any>> = {
  reddit: apifyRedditPostSchema,
};

/**
 * Gets the Apify dataset item schema for a given platform.
 */
export function getPlatformSchema(platform: string): z.ZodSchema<any> {
  const schema = platformSchemas[platform];
  if (!schema) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return schema;
}

export function getPostUrlPropName(platform: string): string {
  switch (platform) {
    case "reddit":
      return "url";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
