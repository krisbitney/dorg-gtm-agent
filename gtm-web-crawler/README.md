# GTM Web Crawler

GTM Web Crawler is an Apify Actor designed to find leads in Reddit subreddits. It uses Crawlee with Playwright and Camoufox (a hardened Firefox browser) to scrape Reddit posts while avoiding anti-scraping measures.

### Key Parameters
- `startUrls`: (Required) List of subreddit URLs to start crawling (e.g., `https://www.reddit.com/r/webdev/`).
- `maxCrawlDepth`: Maximum depth for the crawl (default: `10`).
- `maxRequestsPerCrawl`: Maximum total requests to perform.
- `maxRequestsPerMinute`: Rate limiting for requests (default: `20`).
- `maxConcurrency`: Maximum concurrent browser instances (default: `1`).
- `sameDomainDelaySecs`: Delay between requests to the same domain (default: `0`).

## Output Data
The crawler saves results to the Apify dataset. The "Overview" table in the Apify platform displays:
- **Subreddit**: The subreddit name.
- **Username**: The post author.
- **Upvotes**: Number of upvotes.
- **Comments**: Number of comments.
- **Link**: Canonical URL of the post.
- **Posted At**: Timestamp of the post.
- **Content**: The full post content (Title + Body).
