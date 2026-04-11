// For more information, see https://crawlee.dev/
import { launchOptions } from 'camoufox-js';
import { PlaywrightCrawler } from 'crawlee';
import { firefox } from 'playwright';

import { createRouter } from './routes.js';
import { redditStartUrls } from "./start-urls.js";
import { config } from "./config/config.js";
import { PostProcessor } from "./services/post-processor.js";
import { extractSubredditName } from "./lib/reddit-url.js";
import { LABELS } from "./constants/labels.js";
import { 
    FakeUrlStore, 
    FakePostRepo, 
    FakeQueuePublisher, 
    RealIdGen, 
    RealClock 
} from "./services/fakes.js";
import {createSubredditUserData, getSubredditUniqueKey} from "./lib/request-metadata.js";

// 1. Initialize services (Checkpoint 7 will replace these with real SQL/Redis)
const urlStore = new FakeUrlStore();
const postRepo = new FakePostRepo();
const queuePublisher = new FakeQueuePublisher();
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
const crawler = new PlaywrightCrawler({
    requestHandler: router,
    maxRequestsPerCrawl: config.CRAWLER_MAX_REQUESTS_PER_CRAWL,
    maxConcurrency: config.CRAWLER_MAX_CONCURRENCY,
    requestHandlerTimeoutSecs: Math.floor(config.CRAWLER_REQUEST_TIMEOUT_MS / 1000),
    navigationTimeoutSecs: Math.floor(config.CRAWLER_NAVIGATION_TIMEOUT_MS / 1000),
    browserPoolOptions: {
        // Disable the default fingerprint spoofing to avoid conflicts with Camoufox.
        useFingerprints: false,
    },
    launchContext: {
        launcher: firefox,
        launchOptions: await launchOptions({
            headless: config.CRAWLER_HEADLESS,
        }),
    },
    postNavigationHooks: [
        async ({ handleCloudflareChallenge }) => {
            await handleCloudflareChallenge();
        },
    ],
});

// 5. Run the crawler with seed requests
const startRequests = redditStartUrls.map(url => {
    const topic = extractSubredditName(url) || 'unknown';
    return {
        url,
        label: LABELS.SUBREDDIT,
        userData: createSubredditUserData(topic),
        uniqueKey: getSubredditUniqueKey(url),
    };
});

await crawler.run(startRequests);
