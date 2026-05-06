import type { SearchParams, SearchResponse, SearchResult, SearchProviderInterface } from "../interfaces/search-provider-interface.js";
import {IMastraLogger} from "@mastra/core/logger";

// TODO: respect rate limits (e.g., 50 search calls per second, configurable)
// TODO: handle retries (on retriable errors) with exponential backoff
/**
 * Concrete implementation of SearchProviderInterface using the serper.dev SERP API.
 *
 * Translates site and time-range parameters into Serper's query and tbs formats:
 * - `site` is prepended to the query as `site:<domain>`.
 * - `startDateTime` / `endDateTime` are converted to Google's `cdr` tbs format.
 */
export class SerperProvider implements SearchProviderInterface {
  private readonly apiKey: string;
  private readonly timeout: number = 30000;

  constructor(options: { apiKey: string }) {
    this.apiKey = options.apiKey;
  }

  async search({ query, sourceUrl, startDateTime, endDateTime, page }: SearchParams, logger?: IMastraLogger): Promise<SearchResponse> {

    const tbs = this.buildTbs(startDateTime, endDateTime) ?? "";
    const q = `site:${sourceUrl} ${tbs} ${query}`;

    const body: Record<string, unknown> = { q, ...(page ? { page } : {}) };

    logger?.info(`Executing Serper.dev search with query: ${q}`)
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Serper search failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      organic?: Array<{ title: string; link: string; snippet: string }>;
    };

    const results: SearchResult[] = (data.organic ?? []).map((r) => ({
      url: r.link,
      title: r.title,
      snippet: r.snippet ?? "",
    }));

    return { results };
  }

  /**
   * Converts ISO 8601 datetimes to Google's search operator tbs format.
   * Format: `after:YYYY-MM-DD before:YYYY-MM-DD`
   */
  private buildTbs(startDateTime?: string, endDateTime?: string): string | undefined {
    if (!startDateTime && !endDateTime) {
      return undefined;
    }

    const formatDate = (iso: string): string => {
      const d = new Date(iso);
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${yyyy}-${mm}-${dd}`;
    };

    const now = new Date();
    const defaultMin = formatDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString());
    const defaultMax = formatDate(now.toISOString());

    const dateMin = startDateTime ? formatDate(startDateTime) : defaultMin;
    const dateMax = endDateTime ? formatDate(endDateTime) : defaultMax;

    return `after:${dateMin} before:${dateMax}`;
  }
}
