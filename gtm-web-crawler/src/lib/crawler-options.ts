import { firefox } from 'playwright';
import { launchOptions } from 'camoufox-js';
import {PlaywrightCrawler, PlaywrightCrawlerOptions, ProxyConfiguration, Router} from 'crawlee';
import type { Config } from '../config/config.js';

/**
 * Builds the PlaywrightCrawler options based on the configuration.
 * @param config The validated configuration.
 * @param router The crawler router.
 * @returns PlaywrightCrawlerOptions
 */
export async function buildCrawlerOptions(
    config: Config,
    router: Router
): Promise<PlaywrightCrawlerOptions> {
    let proxyConfiguration: ProxyConfiguration | undefined;
    if (config.CRAWLER_PROXY_URLS && config.CRAWLER_PROXY_URLS.length > 0) {
        proxyConfiguration = new ProxyConfiguration({
            proxyUrls: config.CRAWLER_PROXY_URLS,
        });
    }

    return {
        requestHandler: router,
        maxRequestsPerCrawl: config.CRAWLER_MAX_REQUESTS_PER_CRAWL,
        maxCrawlDepth: config.CRAWLER_MAX_CRAWL_DEPTH,
        maxConcurrency: config.CRAWLER_MAX_CONCURRENCY,
        maxRequestsPerMinute: config.CRAWLER_MAX_REQUESTS_PER_MINUTE,
        requestHandlerTimeoutSecs: Math.floor(config.CRAWLER_REQUEST_TIMEOUT_MS / 1000),
        navigationTimeoutSecs: Math.floor(config.CRAWLER_NAVIGATION_TIMEOUT_MS / 1000),
        proxyConfiguration,
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
    };
}
