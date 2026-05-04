/**
 * Raw scraped page content before summarization.
 */
export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
}

/**
 * Interface for a web page scraper (e.g., Context.dev).
 * Fetches a URL and returns the extracted content.
 */
export interface PageScraperInterface {
  scrape(options: { url: string }): Promise<ScrapedPage>;
}
