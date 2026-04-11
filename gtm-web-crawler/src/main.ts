// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, log } from 'crawlee';

import { createRouter } from './routes.js';
import { redditStartUrls } from "./start-urls.js";
import { appConfig } from "./config/appConfig.js";
import { PostProcessor } from "./services/post-processor.js";
import { extractSubredditName } from "./lib/reddit-url.js";
import { ROUTE_LABELS } from "./constants/ROUTE_LABELS.js";
import { DrizzlePostRepository } from "./storage/drizzle-post-repository.js";
import { RedisQueuePublisher } from "./storage/redis-queue-publisher.js";
import { RedisProcessedUrlStore } from "./storage/redis-processed-url-store.js";
import { RealIdGen, RealClock } from "./services/simple.js";
import { createSubredditUserData, getSubredditUniqueKey } from "./lib/request-metadata.js";
import { buildCrawlerOptions } from "./lib/crawler-options.js";

// 1. Initialize services (Checkpoint 7: SQL/Redis)
const urlStore = new RedisProcessedUrlStore();
const postRepo = new DrizzlePostRepository();
const queuePublisher = new RedisQueuePublisher();
const idGen = new RealIdGen();
const clock = new RealClock();

// 2. Create the orchestrator
const postProcessor = new PostProcessor(
    urlStore,
    postRepo,
    queuePublisher,
    idGen,
    clock
);

// 3. Create the router
const router = createRouter(postProcessor);

// 4. Configure the crawler
const crawlerOptions = await buildCrawlerOptions(appConfig, router);
const crawler = new PlaywrightCrawler(crawlerOptions);

// 5. Run the crawler with seed requests
const startRequests = redditStartUrls.map(url => {
    const topic = extractSubredditName(url) || 'unknown';
    return {
        url,
        label: ROUTE_LABELS.SUBREDDIT,
        userData: createSubredditUserData(topic),
        uniqueKey: getSubredditUniqueKey(url),
    };
});

log.info(`Starting crawl with ${startRequests.length} seed URLs.`);
await crawler.run(startRequests);
log.info('Crawl finished.');
