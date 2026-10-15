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

    const scrapeUrl = isRedditUrl(url) ? toOldRedditJson(url) : url;
    if (url !== scrapeUrl) {
      logger?.info(`Modified scrape URL to: ${scrapeUrl}`);
    }

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

      return {
        url,
        content: response.result.content
      };
    } catch (e: unknown) {
      const error = e?.toString();
      logger?.error(`Scrapfly error while scraping: ${error}`);
      return { url, content: "" };
    }
  }
}

function isRedditUrl(input: string): boolean {
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const parsed = new URL(withProtocol);

    return (
      parsed.hostname === "reddit.com" ||
      parsed.hostname === "www.reddit.com" ||
      parsed.hostname === "old.reddit.com"
    );
  } catch {
    return false;
  }
}

function toOldRedditJson(input: string): string {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const parsed = new URL(withProtocol);

  if (
    parsed.hostname === "reddit.com" ||
    parsed.hostname === "www.reddit.com" ||
    parsed.hostname === "old.reddit.com"
  ) {
    parsed.hostname = "old.reddit.com";

    if (!parsed.pathname.endsWith(".json")) {
      parsed.pathname = parsed.pathname.replace(/\/$/, "") + ".json";
    }
  }

  return parsed.toString();
}