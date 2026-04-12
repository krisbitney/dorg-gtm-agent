/**
 * Builds a structured log context for crawler events.
 * @param subreddit The subreddit subreddit.
 * @param url The canonical URL.
 * @param extra Any extra fields.
 */
export function buildCrawlerLogContext(subreddit: string | undefined, url: string, extra: Record<string, any> = {}) {
    return {
        subreddit: subreddit || 'unknown',
        url,
        ...extra,
    };
}
