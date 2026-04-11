import { createPlaywrightRouter } from 'crawlee';
import { config } from './config/config.js';
import { LABELS } from './constants/labels.js';
import { extractSubredditName } from './lib/reddit-url.js';
import { transformPostRequest, transformSubredditRequest } from './lib/route-helpers.js';
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
    router.addHandler(LABELS.SUBREDDIT, async ({ page, enqueueLinks, request, log }) => {
        const topic = request.userData.topic || extractSubredditName(request.url);
        const pageNumber = request.userData.pageNumber || 1;
        log.info(`Processing subreddit: ${topic} (page ${pageNumber})`, { url: request.url });

        // 0. Check age of the top post if configured
        if (config.CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS !== undefined) {
            const topPostTimestamp = await page.$eval('.thing.link time', (time) => {
                return (time as HTMLTimeElement).dateTime;
            }).catch(() => null);

            if (topPostTimestamp) {
                const postDate = new Date(topPostTimestamp).getTime();
                const now = Date.now();
                const ageDays = (now - postDate) / (1000 * 60 * 60 * 24);

                if (ageDays > config.CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS) {
                    log.info(`Top post on ${topic} (page ${pageNumber}) is too old: ${ageDays.toFixed(2)} days (max: ${config.CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS}). Stopping crawl.`);
                    return; // Stop processing this page and don't paginate
                }
            } else {
                log.info(`Could not find top post timestamp on ${topic} (page ${pageNumber})`);
            }
        }

        // 1. Get all post links on the current page
        const postLinks = await page.$$eval('a', (links) => {
            return links
                .map(a => a.href)
                .filter(href => href.includes('/comments/'));
        });

        // Use a Set to get unique URLs on the page (e.g. title and comments links)
        const uniquePostUrls = [...new Set(postLinks)];

        const linksToEnqueue = [];
        let duplicateFound = false;

        for (const url of uniquePostUrls) {
            if (await postProcessor.isDuplicate(url)) {
                log.info(`Duplicate post encountered: ${url}`);
                duplicateFound = true;
                if (config.CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE) {
                    break;
                }
            } else {
                linksToEnqueue.push(url);
            }
        }

        // 2. Enqueue the discovered posts
        if (linksToEnqueue.length > 0) {
            await enqueueLinks({
                urls: linksToEnqueue,
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
        }

        // 3. Handle pagination
        const shouldStop = duplicateFound && config.CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE;
        if (!shouldStop && pageNumber < config.CRAWLER_SUBREDDIT_MAX_PAGES) {
            // Check for next button (supports both old and new Reddit structures)
            const nextButton = await page.$('.next-button a, a[rel="next"]');
            if (nextButton) {
                await enqueueLinks({
                    selector: '.next-button a, a[rel="next"]',
                    label: LABELS.SUBREDDIT,
                    transformRequestFunction: (req) => {
                        const transformed = transformSubredditRequest(req.url, pageNumber + 1);
                        if (transformed) {
                            req.userData = transformed.userData;
                            req.uniqueKey = transformed.uniqueKey;
                            return req;
                        }
                        return false;
                    }
                });
            } else {
                log.info(`No next button found for ${topic} on page ${pageNumber}`);
            }
        } else if (shouldStop) {
            log.info(`Stopping pagination for ${topic} because a duplicate post was encountered.`);
        } else {
            log.info(`Reached max pages (${config.CRAWLER_SUBREDDIT_MAX_PAGES}) or no more pages for ${topic}.`);
        }
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
                    const transformed = transformSubredditRequest(req.url, 1);
                    if (transformed) {
                        req.userData = transformed.userData;
                        req.uniqueKey = transformed.uniqueKey;
                        return req;
                    }
                    return false;
                }
            });
        }
    });

    return router;
}
