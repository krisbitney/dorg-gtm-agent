import type { PageScraperInterface, ScrapedPage } from "../interfaces/page-scraper-interface.js";
import { IMastraLogger } from "@mastra/core/logger";
import {ScrapflyClient, ScrapeConfig, ScrapeResult} from 'scrapfly-sdk';

// TODO: respect rate limits (e.g., 1 scrape call per second, configurable)
// TODO: handle retries (on retriable errors) with exponential backoff
/**
 * Concrete implementation of PageScraperInterface using the Scrapfly API.
 *
 * Calls POST https://api.scrapfly.io/scrape and extracts page content
 * as plain text for downstream summarization.
 */
export class ScrapflyScrapeProvider implements PageScraperInterface {
  private readonly scrapfly: ScrapflyClient;

  constructor(options: { apiKey: string }) {
    this.scrapfly = new ScrapflyClient({ key: options.apiKey });
  }

  async scrape({ url }: { url: string }, logger?: IMastraLogger): Promise<ScrapedPage> {
    logger?.info(`Scraping content from URL: ${url}`);

    try {
      const result = await this.scrapfly.scrape(new ScrapeConfig({
        url: url,
        asp: true,
        render_js: true,
        country: "us",
        extraction_model: "social_media_post",
      })) as unknown as { result: { success: boolean, error?: unknown, url: string; extracted_data: { data: string }}};

      if (!result.result.success) {
        throw new Error(`Scrapfly scrape failed with API error: ${JSON.stringify(result.result.error, null, 2)}`);
      }

      console.log(JSON.stringify(result.result.extracted_data.data, null, 2));

      return {
        url: result.result.url,
        content: result.result.extracted_data.data
      };
    } catch (e: unknown) {
      const error = e?.toString();
      logger?.error(`Scrapfly error while scraping: ${error}`);
      return { url, content: "" };
    }
  }
}
