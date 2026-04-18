import {getRedditActorInputs, redditActorId} from "./crawler-start-urls/reddit.ts";
import type {Platform} from "../schemas";

export const getCrawlerConfig = (platform: Platform): { actorId: string; input: Record<string, any>} => {
  switch (platform) {
    case "reddit":
      return {
        actorId: redditActorId,
        input: getRedditActorInputs(),
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};
