import {createPlaywrightRouter, Dataset } from 'crawlee';
import { ROUTE_LABELS } from './constants/route-labels.js';
import {canonicalizePostUrl, extractSubredditName} from './lib/reddit-url.js';
import { transformPostRequest, transformSubredditRequest } from './lib/route-helpers.js';
import {buildCrawlerLogContext} from "./lib/logging.js";
import type {RedditPost} from "./domain/post.js";
import {parsePostPage} from "./parsers/reddit-post-parser.js";

/**
 * Creates the Playwright router for Reddit.
 */
export function createRouter() {
    const router = createPlaywrightRouter();

    /**
     * Handler for subreddit listing pages.
     * Discovers post links and enqueues them.
     */
    router.addHandler(ROUTE_LABELS.SUBREDDIT, async ({ page, enqueueLinks, request, log }) => {
        const subreddit = request.userData.subreddit || extractSubredditName(request.url);
        const pageNumber = request.userData.pageNumber || 1;
        log.info(`Processing subreddit`, buildCrawlerLogContext(subreddit, request.url, { pageNumber }));

        // 1. Enqueue posts
            log.info(`Enqueuing new posts`, buildCrawlerLogContext(subreddit, request.url));
            await enqueueLinks({
                selector: 'a[href*="/comments/"]',
                label: ROUTE_LABELS.POST,
                transformRequestFunction: (req) => {
                    const transformed = transformPostRequest(req.url, subreddit);
                    if (transformed) {
                        req.userData = transformed.userData;
                        req.uniqueKey = transformed.uniqueKey;
                        return req;
                    }
                    return false;
                },
            });

        // 3. Handle pagination
        const nextPageUrl = await page.locator('span.next-button > a').first().getAttribute('href');
        if (nextPageUrl) {
            log.info(`Enqueuing next subreddit page`, buildCrawlerLogContext(subreddit, nextPageUrl, { pageNumber: pageNumber + 1 }));
            await enqueueLinks({
                urls: [nextPageUrl],
                label: ROUTE_LABELS.SUBREDDIT,
                transformRequestFunction: (req) => {
                    const transformed = transformSubredditRequest(req.url, pageNumber + 1);
                    if (transformed) {
                        req.userData = transformed.userData;
                        req.uniqueKey = transformed.uniqueKey;
                        return req;
                    }
                    return false;
                },
            });
        } else {
            log.info(`No next page found`, buildCrawlerLogContext(subreddit, request.url, { pageNumber }));
        }
    });

    /**
     * Handler for post detail pages.
     * Extracts post data and hands it to the post processor.
     */
    router.addHandler(ROUTE_LABELS.POST, async ({ page, request, log }) => {
        const url = page.url();
        const subreddit = request.userData.subreddit;
        log.info(`Processing post`, buildCrawlerLogContext(subreddit, url));

        const html = await page.content();
        const canonicalUrl = canonicalizePostUrl(url);
        const extracted = parsePostPage(html, subreddit);
        if (!extracted) {
            log.error(`Failed to parse post content. The page shape might have changed.`, buildCrawlerLogContext(subreddit, canonicalUrl));
            return;
        }
        const record: RedditPost = {
            ...extracted,
            url: canonicalUrl,
        };
        await Dataset.pushData(record);
        log.info(`Post processing result`, buildCrawlerLogContext(subreddit, url, { record }));
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
                label: ROUTE_LABELS.SUBREDDIT,
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
