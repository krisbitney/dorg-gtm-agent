import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { appEnv } from "../config/app-env.js";
import { ContextDevProvider } from "../providers/context-dev-provider.js";

const contextDev = new ContextDevProvider({
  apiKey: appEnv.CONTEXT_DEV_API_KEY ?? "",
});

export const scrapePageTool = createTool({
  id: "scrape-page",
  description:
    "Fetches a web page URL, extracts the core relevant content while dropping irrelevant junk (navigation, ads, sidebar, etc.), and returns the content for downstream processing. Summarization by webSummarizationAgent is applied by the calling workflow step, not within this tool.",
  inputSchema: z.object({
    url: z.url(),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
  }),
  execute: async (inputData) => {
    return contextDev.scrape({ url: inputData.url });
  },
});
