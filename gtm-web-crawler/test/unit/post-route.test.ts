import { describe, it, expect, mock } from "bun:test";

describe("Post Route Core Logic", () => {
    it("should delegate to the post processor with the right arguments", async () => {
        const mockPostProcessor = {
            process: mock(async (url: string, html: string, topic: string) => "inserted")
        };
        const mockLog = {
            info: mock((msg: string, ctx?: any) => {})
        };
        
        const url = "https://www.old.reddit.com/r/CryptoCurrency/comments/123/title";
        const html = "<html><body>Post content</body></html>";
        const topic = "CryptoCurrency";

        const result = await mockPostProcessor.process(url, html, topic);
        
        expect(result).toBe("inserted");
        expect(mockPostProcessor.process).toHaveBeenCalledWith(url, html, topic);
        expect(mockLog.info).toHaveBeenCalled();
    });
});
