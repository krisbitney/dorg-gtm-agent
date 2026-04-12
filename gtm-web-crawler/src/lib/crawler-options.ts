import { firefox } from 'playwright';
import { launchOptions } from 'camoufox-js';
import {
    createPlaywrightRouter,
    PlaywrightCrawlerOptions,
    ProxyConfiguration,
} from 'crawlee';
import type { AppConfig } from '../config/appConfig.js';


/**
 * Builds the PlaywrightCrawler options based on the configuration.
 * @param config The validated configuration.
 * @param router The crawler router.
 * @returns PlaywrightCrawlerOptions
 */
export async function buildCrawlerOptions(
    config: AppConfig,
    router: ReturnType<typeof createPlaywrightRouter>
): Promise<PlaywrightCrawlerOptions> {
    let proxyConfiguration: ProxyConfiguration | undefined;
    if (config.CRAWLER_PROXY_URLS && config.CRAWLER_PROXY_URLS.length > 0) {
        proxyConfiguration = new ProxyConfiguration({
            proxyUrls: config.CRAWLER_PROXY_URLS,
        });
    }

    return {
        requestHandler: router,
        maxRequestsPerCrawl: config.CRAWLER_MAX_REQUESTS_PER_CRAWL ?? undefined,
        maxCrawlDepth: config.CRAWLER_MAX_CRAWL_DEPTH,
        maxConcurrency: config.CRAWLER_MAX_CONCURRENCY,
        maxRequestsPerMinute: config.CRAWLER_MAX_REQUESTS_PER_MINUTE,
        sameDomainDelaySecs: config.CRAWLER_SAME_DOMAIN_DELAY_SECS,
        maxRequestRetries: 1,
        maxSessionRotations: 10,
        requestHandlerTimeoutSecs: Math.floor(config.CRAWLER_REQUEST_TIMEOUT_MS / 1000),
        navigationTimeoutSecs: Math.floor(config.CRAWLER_NAVIGATION_TIMEOUT_MS / 1000),
        ignoreIframes: true,
        ignoreShadowRoots: true,
        useSessionPool: true,
        persistCookiesPerSession: true,
        proxyConfiguration,
        browserPoolOptions: {
            // Disable the default fingerprint spoofing to avoid conflicts with Camoufox.
            useFingerprints: false,
        },
        launchContext: {
            launcher: firefox,
            launchOptions: await launchOptions({
                headless: config.CRAWLER_HEADLESS,
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
    };
}
