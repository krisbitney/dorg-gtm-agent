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

    const scrapeUrl = url
      .replace(/^(https?:\/\/)www\./, "$1")
      .replace(
        /^(https?:\/\/)(?:www\.)?reddit\.com(\/.*?)\/?$/,
        "$1old.reddit.com$2.json",
      );

    try {
      const response = await this.scrapfly.scrape(new ScrapeConfig({
        url: scrapeUrl,
        asp: true,
        render_js: !scrapeUrl.includes("old.reddit.com"),
        country: "us",
        format_options: ["no_images", "only_content"],
        format: "markdown",
      })) as ScrapeResult;

      if (!response.result.success) {
        throw new Error(`Scrapfly scrape failed with API error: ${JSON.stringify(response.result.error, null, 2)}`);
      }

      console.log(response.result.content);

      return {
        url: response.result.url,
        content: response.result.content
      };
    } catch (e: unknown) {
      const error = e?.toString();
      logger?.error(`Scrapfly error while scraping: ${error}`);
      return { url, content: "" };
    }
  }
}
