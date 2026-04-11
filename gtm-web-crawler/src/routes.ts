import { createPlaywrightRouter } from 'crawlee';
import { appConfig } from './config/appConfig.js';
import { ROUTE_LABELS } from './constants/ROUTE_LABELS.js';
import { extractSubredditName } from './lib/reddit-url.js';
import { transformPostRequest, transformSubredditRequest } from './lib/route-helpers.js';
import { detectBlock } from './lib/block-detection.js';
import type { PostProcessor } from './services/post-processor.js';
import {buildCrawlerLogContext} from "./lib/logging.js";

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
    router.addHandler(ROUTE_LABELS.SUBREDDIT, async ({ page, enqueueLinks, request, log, crawler }) => {
        const topic = request.userData.topic || extractSubredditName(request.url);
        const pageNumber = request.userData.pageNumber || 1;
        log.info(`Processing subreddit`, buildCrawlerLogContext(topic, request.url, { pageNumber }));

        // 0. Check for blocks
        const blockType = await detectBlock(page);
        if (blockType) {
            log.error(`Blocked detected`, buildCrawlerLogContext(topic, request.url, { blockType }));
            await crawler.stop();
            return;
        }

        // 0.5 Check age of the top post if configured
        if (appConfig.CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS !== undefined) {
            const topPostTimestamp = await page.$eval('.thing.link time', (time) => {
                return (time as HTMLTimeElement).dateTime;
            }).catch(() => null);

            if (topPostTimestamp) {
                const postDate = new Date(topPostTimestamp).getTime();
                const now = Date.now();
                const ageDays = (now - postDate) / (1000 * 60 * 60 * 24);

                if (ageDays > appConfig.CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS) {
                    log.info(`Top post on ${topic} (page ${pageNumber}) is too old: ${ageDays.toFixed(2)} days (max: ${appConfig.CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS}). Stopping crawl.`);
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
                log.info(`Duplicate post encountered`, buildCrawlerLogContext(topic, url, { isDuplicate: true }));
                duplicateFound = true;
                if (appConfig.CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE) {
                    break;
                }
            } else {
                linksToEnqueue.push(url);
            }
        }

        // 2. Enqueue the discovered posts
        if (linksToEnqueue.length > 0) {
            log.info(`Enqueuing new posts`, buildCrawlerLogContext(topic, request.url, { discoveredCount: linksToEnqueue.length }));
            await enqueueLinks({
                urls: linksToEnqueue,
                label: ROUTE_LABELS.POST,
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
        if (duplicateFound && appConfig.CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE) {
            log.info(`Stopping pagination because a duplicate post was encountered`, buildCrawlerLogContext(topic, request.url, { stopOnDuplicate: true }));
        }
    });

    /**
     * Handler for post detail pages.
     * Extracts post data and hands it to the post processor.
     */
    router.addHandler(ROUTE_LABELS.POST, async ({ page, request, log, crawler }) => {
        const url = page.url();
        const topic = request.userData.topic;
        log.info(`Processing post`, buildCrawlerLogContext(topic, url));

        // Check for blocks
        const blockType = await detectBlock(page);
        if (blockType) {
            log.error(`Blocked detected`, buildCrawlerLogContext(topic, url, { blockType }));
            await crawler.stop();
            return;
        }

        const html = await page.content();
        const processedPost = await postProcessor.process(url, html, topic);
        log.info(`Post processing result`, buildCrawlerLogContext(topic, url, { result: processedPost }));
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
