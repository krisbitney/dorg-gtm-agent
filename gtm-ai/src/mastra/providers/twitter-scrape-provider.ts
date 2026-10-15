import type { PageScraperInterface, ScrapedPage } from "../interfaces/page-scraper-interface.js";
import { IMastraLogger } from "@mastra/core/logger";
import { twitterAgent } from "../agents/twitter-agent";

/**
 * Concrete implementation of PageScraperInterface using the Twitter Agent.
 *
 * Delegates to the Grok-powered Twitter Agent to retrieve the contents,
 * author, and datetime of an X (Twitter) post from its URL.
 */
export class TwitterScrapeProvider implements PageScraperInterface {
  async scrape({ url }: { url: string }, logger?: IMastraLogger): Promise<ScrapedPage> {
    logger?.info(`Fetching tweet content from URL: ${url}`);

    try {
      const result = await twitterAgent.generate(url);
      return {
        url,
        content: result.text ?? "",
      };
    } catch (e: unknown) {
      const error = e?.toString();
      logger?.error(`Twitter agent error while scraping: ${error}`);
      return { url, content: "" };
    }
  }
}
