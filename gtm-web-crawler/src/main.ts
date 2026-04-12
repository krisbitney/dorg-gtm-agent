// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, log } from 'crawlee';

import { createRouter } from './routes.js';
import { redditStartUrls } from "./constants/start-urls.js";
import { appConfig } from "./config/appConfig.js";
import { extractSubredditName } from "./lib/reddit-url.js";
import { ROUTE_LABELS } from "./constants/route-labels.js";
import { createSubredditUserData, getSubredditUniqueKey } from "./lib/request-metadata.js";
import { Actor } from 'apify';
import {firefox} from "playwright";
import {launchOptions} from "camoufox-js";

// 3. Create the router
const router = createRouter();

// 4. Configure the crawler
await Actor.init();
const proxyConfiguration = await Actor.createProxyConfiguration({
    checkAccess: true,
    groups: ['RESIDENTIAL'],
    countryCode: 'US',
});
const crawler = new PlaywrightCrawler({
    requestHandler: router,
    maxRequestsPerCrawl: appConfig.CRAWLER_MAX_REQUESTS_PER_CRAWL ?? undefined,
    maxCrawlDepth: appConfig.CRAWLER_MAX_CRAWL_DEPTH,
    maxConcurrency: appConfig.CRAWLER_MAX_CONCURRENCY,
    maxRequestsPerMinute: appConfig.CRAWLER_MAX_REQUESTS_PER_MINUTE,
    sameDomainDelaySecs: appConfig.CRAWLER_SAME_DOMAIN_DELAY_SECS,
    maxRequestRetries: 1,
    maxSessionRotations: 10,
    requestHandlerTimeoutSecs: Math.floor(appConfig.CRAWLER_REQUEST_TIMEOUT_MS / 1000),
    navigationTimeoutSecs: Math.floor(appConfig.CRAWLER_NAVIGATION_TIMEOUT_MS / 1000),
    proxyConfiguration,
    browserPoolOptions: {
        // Disable the default fingerprint spoofing to avoid conflicts with Camoufox.
        useFingerprints: false,
    },
    launchContext: {
        launcher: firefox,
        launchOptions: await launchOptions({
            headless: true,
            proxy: await proxyConfiguration?.newUrl(),
            humanize: 1.5,
            geoip: true,
            locale: "en-US",
            block_webrtc: true,
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
    const subreddit = extractSubredditName(url) || 'unknown';
    return {
        url,
        label: ROUTE_LABELS.SUBREDDIT,
        userData: createSubredditUserData(subreddit),
        uniqueKey: getSubredditUniqueKey(url),
    };
});

log.info(`Starting crawl with ${startRequests.length} seed URLs.`, { seedCount: startRequests.length });
await crawler.run(startRequests);
log.info('Crawl finished.');

await Actor.exit();
