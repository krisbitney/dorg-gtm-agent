import { describe, it, expect, mock } from "bun:test";

// Mock camoufox-js before importing crawler-options
mock.module("camoufox-js", () => ({
  launchOptions: async (options: any) => ({ ...options, mockLaunchOptions: true }),
}));

import { buildCrawlerOptions } from "../../src/lib/crawler-options.js";
import type {AppConfig} from "../../src/config/appConfig.ts";

describe("Crawler Options", () => {
    const mockRouter = {} as any;
    const baseConfig: AppConfig = {
        DATABASE_URL: "postgres://localhost:5432",
        REDIS_URL: "redis://localhost:6379",
        CRAWLER_HEADLESS: true,
        CRAWLER_MAX_REQUESTS_PER_MINUTE: 100,
        CRAWLER_MAX_REQUESTS_PER_CRAWL: 20,
        CRAWLER_MAX_CONCURRENCY: 1,
        CRAWLER_MAX_CRAWL_DEPTH: 5,
        CRAWLER_REQUEST_TIMEOUT_MS: 60000,
        CRAWLER_NAVIGATION_TIMEOUT_MS: 30000,
        CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE: true,
    };

    it("should build base options", async () => {
        const options = await buildCrawlerOptions(baseConfig, mockRouter);
        
        expect(options.maxRequestsPerCrawl).toBe(20);
        expect(options.maxConcurrency).toBe(1);
        expect(options.requestHandlerTimeoutSecs).toBe(60);
        expect(options.navigationTimeoutSecs).toBe(30);
        expect(options.browserPoolOptions?.useFingerprints).toBe(false);
        expect(options.proxyConfiguration).toBeUndefined();
        
        const launchOptions = options.launchContext?.launchOptions as any;
        expect(launchOptions.headless).toBe(true);
        expect(launchOptions.mockLaunchOptions).toBe(true);
    });

    it("should apply proxy configuration if provided", async () => {
        const configWithProxy = {
            ...baseConfig,
            CRAWLER_PROXY_URLS: ["http://proxy:8080"],
        };
        
        const options = await buildCrawlerOptions(configWithProxy, mockRouter);
        expect(options.proxyConfiguration).toBeDefined();
        // @ts-ignore
        expect(options.proxyConfiguration.proxyUrls).toContain("http://proxy:8080");
    });
});
