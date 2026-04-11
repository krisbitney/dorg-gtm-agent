import { createPlaywrightRouter } from 'crawlee';
import { LABELS } from './constants/labels.js';
import { extractSubredditName } from './lib/reddit-url.js';
import { transformPostRequest } from './lib/route-helpers.js';
import type { PostProcessor } from './services/post-processor.js';

/**
 * Creates the Playwright router for Reddit.
 * @param postProcessor The orchestrator for processing posts.
 */
export function createRouter(postProcessor: PostProcessor) {
    const router = createPlaywrightRouter();

    /**
     * Handler for subreddit listing pages.
     * Discovers post links and enqueues them.
     */
    router.addHandler(LABELS.SUBREDDIT, async ({ enqueueLinks, request, log }) => {
        const topic = request.userData.topic || extractSubredditName(request.url);
        log.info(`Processing subreddit: ${topic}`, { url: request.url });

        // Enqueue post links
        await enqueueLinks({
            selector: 'a[href*="/comments/"]',
            label: LABELS.POST,
            transformRequestFunction: (req) => {
                const transformed = transformPostRequest(req.url, topic);
                if (transformed) {
                    req.userData = transformed.userData;
                    req.uniqueKey = transformed.uniqueKey;
                    return req;
                }
                return false;
            },
        });
        
        // TODO: Enqueue pagination if needed in later checkpoints
    });

    /**
     * Handler for post detail pages.
     * Extracts post data and hands it to the post processor.
     */
    router.addHandler(LABELS.POST, async ({ page, request, log }) => {
        const url = page.url();
        const topic = request.userData.topic;
        log.info(`Processing post: ${url}`, { topic });

        const html = await page.content();
        const processedPost = await postProcessor.process(url, html, topic);
        log.info(`Post processing result: ${processedPost}`, { url });
    });

    /**
     * Default handler for unknown labels or direct seed hits that might not be labeled.
     */
    router.addDefaultHandler(async ({ request, log, enqueueLinks }) => {
        log.info(`Default handler for ${request.url}`);

        const subredditName = extractSubredditName(request.url);
        if (subredditName) {
            // Treat as subreddit if it looks like one
            await enqueueLinks({
                urls: [request.url],
                label: LABELS.SUBREDDIT,
                transformRequestFunction: (req) => {
                    req.userData = { topic: subredditName };
                    return req;
                }
            });
        }
    });

    return router;
}
