/**
 * Builds a structured log context for crawler events.
 * @param topic The subreddit topic.
 * @param url The canonical URL.
 * @param extra Any extra fields.
 */
export function buildCrawlerLogContext(topic: string | undefined, url: string, extra: Record<string, any> = {}) {
    return {
        topic: topic || 'unknown',
        url,
        ...extra,
    };
}
