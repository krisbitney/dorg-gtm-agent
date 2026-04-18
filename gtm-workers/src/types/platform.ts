import {z} from "zod";
import {apifyRedditPostSchema} from "./post-schemas/apify-reddit-post-schema.ts";
import {apifyTwitterPostSchema} from "./post-schemas/apify-twitter-post-schema.ts";

const platforms = ["reddit", "twitter"] as const;
export type Platform = (typeof platforms)[number];

export function isPlatform(platform: unknown): platform is Platform {
  return typeof platform === "string" && platforms.includes(platform as Platform);
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
  twitter: apifyTwitterPostSchema,
};
