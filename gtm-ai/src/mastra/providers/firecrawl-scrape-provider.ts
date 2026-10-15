import type { PageScraperInterface, ScrapedPage } from "../interfaces/page-scraper-interface.js";
import {IMastraLogger} from "@mastra/core/logger";
import Firecrawl from '@mendable/firecrawl-js';

// TODO: respect rate limits (e.g., 1 scrape call per second, configurable)
// TODO: handle retries (on retriable errors) with exponential backoff
/**
 * Concrete implementation of PageScraperInterface using the firecrawl SDK.
 */
export class FirecrawlScrapeProvider implements PageScraperInterface {
  private readonly firecrawl: Firecrawl;
  private readonly timeout: number = 30000;

  constructor(options: { apiKey: string }) {
    this.firecrawl = new Firecrawl({ apiKey: options.apiKey });
  }

  async scrape({ url }: { url: string }, logger?: IMastraLogger): Promise<ScrapedPage> {

    logger?.info(`Scraping content from URL: ${url}`)

    try {
      const data = await this.firecrawl.scrape(url, {
        formats: ['markdown'],
        timeout: this.timeout
      });
      return {
        url,
        content: data.markdown ?? "",
      };
    } catch (e: unknown) {
      const error = e?.toString();
      logger?.error(`Firecrawl error while scraping: ${error}`);
      return { url, content: ""}
    }
  }
}
