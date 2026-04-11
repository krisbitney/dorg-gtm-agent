import { test, expect, describe } from "bun:test";
import {
  isSubredditUrl,
  isPostUrl,
  extractSubredditName,
  canonicalizePostUrl,
  canonicalizeListingUrl,
} from "../../src/lib/reddit-url.js";

describe("Reddit URL Utilities", () => {
  describe("isSubredditUrl", () => {
    test("should return true for valid subreddit URLs", () => {
      expect(isSubredditUrl("https://www.reddit.com/r/CryptoCurrency")).toBe(true);
      expect(isSubredditUrl("https://www.reddit.com/r/Bitcoin/")).toBe(true);
    });

    test("should return false for post URLs", () => {
      expect(isSubredditUrl("https://www.reddit.com/r/CryptoCurrency/comments/123/title")).toBe(false);
    });

    test("should return false for invalid URLs", () => {
      expect(isSubredditUrl("https://google.com")).toBe(false);
      expect(isSubredditUrl("not-a-url")).toBe(false);
    });
  });

  describe("isPostUrl", () => {
    test("should return true for valid post URLs", () => {
      expect(isPostUrl("https://www.reddit.com/r/CryptoCurrency/comments/123/title/")).toBe(true);
      expect(isPostUrl("https://www.reddit.com/r/Bitcoin/comments/456/slug")).toBe(true);
    });

    test("should return false for subreddit listing URLs", () => {
      expect(isPostUrl("https://www.reddit.com/r/CryptoCurrency")).toBe(false);
    });
  });

  describe("extractSubredditName", () => {
    test("should extract subreddit name from various URLs", () => {
      expect(extractSubredditName("https://www.reddit.com/r/CryptoCurrency")).toBe("CryptoCurrency");
      expect(extractSubredditName("https://www.reddit.com/r/Bitcoin/comments/123/title")).toBe("Bitcoin");
    });

    test("should return null for non-subreddit URLs", () => {
      expect(extractSubredditName("https://www.reddit.com/u/user")).toBe(null);
    });
  });

  describe("canonicalizePostUrl", () => {
    test("should remove tracking parameters and fragments", () => {
      const url = "https://www.reddit.com/r/CryptoCurrency/comments/123/title/?utm_source=share&utm_medium=web2x&context=3#fragment";
      const expected = "https://www.reddit.com/r/CryptoCurrency/comments/123/title";
      expect(canonicalizePostUrl(url)).toBe(expected);
    });

    test("should ensure hostname is www.reddit.com", () => {
      const url = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
      const expected = "https://www.reddit.com/r/CryptoCurrency/comments/123/title";
      expect(canonicalizePostUrl(url)).toBe(expected);
    });
    
    test("should remove trailing slash", () => {
      const url = "https://www.reddit.com/r/CryptoCurrency/comments/123/title/";
      const expected = "https://www.reddit.com/r/CryptoCurrency/comments/123/title";
      expect(canonicalizePostUrl(url)).toBe(expected);
    });
  });

  describe("canonicalizeListingUrl", () => {
    test("should preserve pagination parameters", () => {
      const url = "https://www.reddit.com/r/CryptoCurrency/?after=t3_xyz&count=25&other=ignore";
      const result = canonicalizeListingUrl(url);
      expect(result).toContain("after=t3_xyz");
      expect(result).toContain("count=25");
      expect(result).not.toContain("other=ignore");
    });

    test("should normalize hostname and remove fragment", () => {
      const url = "https://sh.reddit.com/r/CryptoCurrency/#top";
      const expected = "https://www.reddit.com/r/CryptoCurrency";
      expect(canonicalizeListingUrl(url)).toBe(expected);
    });
  });
});
