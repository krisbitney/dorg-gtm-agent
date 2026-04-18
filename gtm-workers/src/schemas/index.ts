import { z } from "zod";
import {apifyRedditPostSchema, redditPostUrlPropName} from "./apify-reddit-post-schema.js";

export type Platform = "reddit";

export function isPlatform(platform: unknown): platform is Platform {
  return typeof platform === "string" && platform === "reddit";
}

export const platformSchema = z.custom<Platform>((value: unknown): value is Platform => {
  return isPlatform(value);
}, {
  message: "Invalid platform",
});

/**
 * Mapping of platform names to their respective Apify dataset item schemas.
 */
export const platformSchemas: Record<Platform, z.ZodSchema<any>> = {
  reddit: apifyRedditPostSchema,
};

/**
 * Mapping of platform names to their respective Apify dataset url prop names.
 */
export const postUrlPropNames: Record<Platform, string> = {
  reddit: redditPostUrlPropName,
};

/**
 * Gets the Apify dataset item schema for a given platform.
 */
export function getPlatformSchema(platform: Platform): z.ZodSchema<any> {
  const schema = platformSchemas[platform];
  if (!schema) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return schema;
}

export function getPostUrlPropName(platform: Platform): string {
  const propName = postUrlPropNames[platform];
  if (!propName) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return propName;
}
