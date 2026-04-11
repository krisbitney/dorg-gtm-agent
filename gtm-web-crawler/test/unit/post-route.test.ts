import { describe, it, expect, mock, beforeEach } from "bun:test";
import { createRouter } from "../../src/routes.js";
import { ROUTE_LABELS } from "../../src/constants/route-labels.js";

describe("Post Route Core Logic", () => {
    let mockPostProcessor: any;
    let mockLog: any;
    let router: any;

    beforeEach(() => {
        mockPostProcessor = {
            process: mock(async () => "inserted"),
            isDuplicate: mock(async () => false),
        };
        mockLog = {
            info: mock(() => {}),
            debug: mock(() => {}),
            error: mock(() => {}),
            warning: mock(() => {}),
        };
        router = createRouter(mockPostProcessor);
    });

    it("should delegate to the post processor with the right arguments", async () => {
        const url = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
        const html = "<html><body>Post content</body></html>";
        const topic = "CryptoCurrency";

        const mockPage = {
            url: () => url,
            content: async () => html,
            title: mock(async () => "Post Title"),
            innerText: mock(async () => "Post content"),
        };
        const mockCrawler = {
            stop: mock(async () => {}),
        };
        const request = {
            userData: { topic },
            label: ROUTE_LABELS.POST,
        };

        await router({ page: mockPage, request, log: mockLog, crawler: mockCrawler });
        
        expect(mockPostProcessor.process).toHaveBeenCalledWith(url, html, topic);
        expect(mockLog.info).toHaveBeenCalled();
    });
});
