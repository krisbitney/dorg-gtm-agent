import { test, expect, describe } from "bun:test";
import { buildCrawlerLogContext } from "../../src/lib/logging.js";

describe("buildCrawlerLogContext", () => {
    test("should build a structured log context", () => {
        const result = buildCrawlerLogContext("crypto", "https://reddit.com/post/123", { extra: "data" });
        expect(result).toEqual({
            topic: "crypto",
            url: "https://reddit.com/post/123",
            extra: "data",
        } as any);
    });

    test("should use 'unknown' if topic is missing", () => {
        const result = buildCrawlerLogContext(undefined, "https://reddit.com/post/123");
        expect(result.topic).toBe("unknown");
        expect(result.url).toBe("https://reddit.com/post/123");
    });
});
