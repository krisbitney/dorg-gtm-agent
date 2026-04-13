// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, log } from 'crawlee';

import { createRouter } from './routes.js';
import { redditStartUrls } from "./constants/start-urls.js";
import { inputSchema } from "./config/appConfig.js";
import {extractSubredditName, isSubredditUrl} from "./lib/reddit-url.js";
import { ROUTE_LABELS } from "./constants/route-labels.js";
import { createSubredditUserData, getSubredditUniqueKey } from "./lib/request-metadata.js";
import { Actor } from 'apify';
import {firefox} from "playwright";
import {launchOptions} from "camoufox-js";

// 3. Create the router
const router = createRouter();

// 4. Configure the crawler
await Actor.init();

const input = await Actor.getInput() || {};
const appConfig = inputSchema.parse(input);

const proxyConfiguration = await Actor.createProxyConfiguration({
    checkAccess: true,
    groups: ['RESIDENTIAL'],
    countryCode: 'US',
});
const crawler = new PlaywrightCrawler({
    requestHandler: router,
    maxRequestsPerCrawl: appConfig.maxRequestsPerCrawl,
    maxCrawlDepth: appConfig.maxCrawlDepth,
    maxConcurrency: appConfig.maxConcurrency,
    maxRequestsPerMinute: appConfig.maxRequestsPerMinute,
    sameDomainDelaySecs: appConfig.sameDomainDelaySecs,
    maxRequestRetries: appConfig.maxRequestRetries,
    maxSessionRotations: appConfig.maxSessionRotations,
    requestHandlerTimeoutSecs: Math.floor(appConfig.requestTimeoutMs / 1000),
    navigationTimeoutSecs: Math.floor(appConfig.navigationTimeoutMs / 1000),
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
const startRequests = appConfig.startUrls.filter((url) => {
    if (isSubredditUrl(url)) return true;
    log.warning(`startUrl ${url} is not a subreddit URL. Skipping.`)
    return false;
}).map(url => {
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
