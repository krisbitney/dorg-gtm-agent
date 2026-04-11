import { describe, it, expect } from "bun:test";
import { transformPostRequest, transformSubredditRequest } from "../../src/lib/route-helpers.js";
import { LABELS } from "../../src/constants/labels.js";

describe("Route Metadata (via Route Helpers)", () => {
    describe("transformPostRequest", () => {
        const topic = "CryptoCurrency";
        
        it("should attach correct label, topic and uniqueKey for valid post URLs", () => {
            const url = "https://www.reddit.com/r/CryptoCurrency/comments/123/title/";
            const result = transformPostRequest(url, topic);
            
            expect(result).not.toBe(false);
            if (result) {
                expect(result.label).toBe(LABELS.POST);
                expect(result.userData.topic).toBe(topic);
                expect(result.userData.label).toBe(LABELS.POST);
                expect(result.uniqueKey).toBe("https://old.reddit.com/r/CryptoCurrency/comments/123/title");
            }
        });

        it("should return false for non-post URLs", () => {
            const url = "https://www.reddit.com/r/CryptoCurrency/new/";
            const result = transformPostRequest(url, topic);
            expect(result).toBe(false);
        });
    });

    describe("transformSubredditRequest", () => {
        it("should attach correct label, topic and uniqueKey for valid subreddit URLs", () => {
            const url = "https://www.reddit.com/r/Bitcoin/new/";
            const result = transformSubredditRequest(url);
            
            expect(result).not.toBe(false);
            if (result) {
                expect(result.label).toBe(LABELS.SUBREDDIT);
                expect(result.userData.topic).toBe("Bitcoin");
                expect(result.userData.label).toBe(LABELS.SUBREDDIT);
                expect(result.uniqueKey).toBe("https://old.reddit.com/r/Bitcoin/new");
            }
        });

        it("should return false for non-subreddit URLs", () => {
            const url = "https://www.google.com";
            const result = transformSubredditRequest(url);
            expect(result).toBe(false);
        });
    });
});
