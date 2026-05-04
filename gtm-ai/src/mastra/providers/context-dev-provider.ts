import type { PageScraperInterface, ScrapedPage } from "../interfaces/page-scraper.interface.js";

/**
 * Concrete implementation of PageScraperInterface using the context.dev API.
 *
 * Calls GET /web/scrape/markdown with `useMainContentOnly` to extract only the
 * core page content (excluding headers, footers, sidebars, and navigation).
 * Returns GitHub Flavored Markdown for downstream summarization.
 */
export class ContextDevProvider implements PageScraperInterface {
  private readonly apiKey: string;
  private readonly timeout: number = 30000;

  constructor(options: { apiKey: string }) {
    this.apiKey = options.apiKey;
  }

  async scrape({ url }: { url: string }): Promise<ScrapedPage> {
    const params = new URLSearchParams({
      url,
      useMainContentOnly: "true",
    });

    const response = await fetch(`https://api.context.dev/v1//web/scrape/markdown?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ContextDev scrape failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      markdown: string;
      url: string;
    };

    return {
      url: data.url ?? url,
      title: "",
      content: data.markdown ?? "",
    };
  }
}
