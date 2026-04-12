import { createPlaywrightRouter } from 'crawlee';
import { appConfig } from './config/appConfig.js';
import { ROUTE_LABELS } from './constants/route-labels.js';
import { extractSubredditName } from './lib/reddit-url.js';
import { transformPostRequest, transformSubredditRequest } from './lib/route-helpers.js';
import { detectBlock } from './lib/block-detection.js';
import type { PostProcessor } from './services/post-processor.js';
import {buildCrawlerLogContext} from "./lib/logging.js";
import * as fs from "fs";

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

        // 1. Get all post links on the current page
        // TODO: why am i being served a "blocked" page
        await page.waitForLoadState('domcontentloaded');
        await page.waitForSelector('body');
        await page.waitForFunction(() => document.querySelectorAll('a').length > 1);

        fs.writeFileSync("test.html", await page.content());

        // debug logs
        const allLinks = await page.locator('a').count();
        const commentLinks = await page.locator('a[href*="/comments/"]').count();
        log.info("issue", { allLinks, commentLinks, url: page.url() });

        const postLinks = await page.locator('a[href*="/comments/"]').evaluateAll((links) => {
            return [...new Set(
              links.map((a) => (a as HTMLAnchorElement).href)
            )];
        });
        log.info(`Found ${postLinks.length} post links on page ${pageNumber}`)

        const linksToEnqueue = [];
        let duplicateFound = false;

        for (const url of postLinks) {
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
        if (duplicateFound && appConfig.CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE) {
            log.info(`Stopping pagination because a duplicate post was encountered`, buildCrawlerLogContext(topic, request.url, { stopOnDuplicate: true }));
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
        // TODO: NEED TO NAVIGATE TO NEXT PAGE
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
