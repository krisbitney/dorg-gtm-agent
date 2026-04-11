import { test, expect, describe } from "bun:test";
import { detectBlock } from "../../src/lib/block-detection.js";

describe("detectBlock", () => {
    const mockPage = (title: string, content: string, url: string = "https://reddit.com") => {
        return {
            title: async () => title,
            content: async () => content,
            url: () => url,
        } as any;
    };

    test("should detect Cloudflare", async () => {
        const page = mockPage("Attention Required! | Cloudflare", "Please verify you are human");
        const result = await detectBlock(page);
        expect(result).toBe("cloudflare");
    });

    test("should detect login wall", async () => {
        const page = mockPage("Reddit Login", "Log in to Reddit", "https://www.reddit.com/login");
        const result = await detectBlock(page);
        expect(result).toBe("login-wall");
    });

    test("should detect rate limiting", async () => {
        const page = mockPage("Reddit", "429 Too Many Requests");
        const result = await detectBlock(page);
        expect(result).toBe("rate-limited");
    });

    test("should detect captcha", async () => {
        const page = mockPage("Reddit", "Please verify you are a human <div class='g-recaptcha'></div>");
        const result = await detectBlock(page);
        expect(result).toBe("captcha");
    });

    test("should detect access denied", async () => {
        const page = mockPage("Access Denied", "Your IP has been blocked");
        const result = await detectBlock(page);
        expect(result).toBe("access-denied");
    });

    test("should return null for normal pages", async () => {
        const page = mockPage("Post Title", "Some content about crypto");
        const result = await detectBlock(page);
        expect(result).toBeNull();
    });
});
