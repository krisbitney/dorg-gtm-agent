import type { SearchParams, SearchResponse, SearchResult, SearchProviderInterface } from "../interfaces/search-provider.interface.js";

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

  async search({ query, site, startDateTime, endDateTime, page }: SearchParams): Promise<SearchResponse> {

    const tbs = this.buildTbs(startDateTime, endDateTime);
    const q = `site:${site} ${tbs} ${query}`;

    const body: Record<string, unknown> = { q, page };


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
   * Converts ISO 8601 datetimes to Google's cdr (custom date range) tbs format.
   * Format: `cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY`
   */
  private buildTbs(startDateTime?: string, endDateTime?: string): string | undefined {
    if (!startDateTime && !endDateTime) {
      return undefined;
    }

    const formatDate = (iso: string): string => {
      const d = new Date(iso);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };

    const now = new Date();
    const defaultMin = formatDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString());
    const defaultMax = formatDate(now.toISOString());

    const cdMin = startDateTime ? formatDate(startDateTime) : defaultMin;
    const cdMax = endDateTime ? formatDate(endDateTime) : defaultMax;

    return `cdr:1,cd_min:${cdMin},cd_max:${cdMax}`;
  }
}
