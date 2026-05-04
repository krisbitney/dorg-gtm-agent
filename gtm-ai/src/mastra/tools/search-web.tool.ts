import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { appEnv } from "../config/app-env.js";
import { SerperProvider } from "../providers/serper-provider.js";

const serper = new SerperProvider({
  apiKey: appEnv.SERPER_API_KEY ?? "",
});

export const searchWebTool = createTool({
  id: "search-web",
  description:
    "Searches the web using a SERP API. Returns ranked results with URLs, titles, and snippets.",
  inputSchema: z.object({
    query: z.string(),
    site: z.string(),
    startDateTime: z.string(),
    endDateTime: z.string(),
    page: z.number().default(1)
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        snippet: z.string(),
      }),
    ),
  }),
  execute: async (inputData) => {
    return serper.search({
      query: inputData.query,
      site: inputData.site,
      startDateTime: inputData.startDateTime,
      endDateTime: inputData.endDateTime,
      page: inputData.page,
    });
  },
});
