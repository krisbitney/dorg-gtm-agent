import { test, expect, describe } from "bun:test";
import { redditStartUrls } from "../../src/start-urls";

describe("redditStartUrls", () => {
  test("every seed URL is a valid Reddit subreddit URL", () => {
    const redditSubredditRegex = /^https:\/\/www\.reddit\.com\/r\/[a-zA-Z0-9_]+\/?$/;
    for (const url of redditStartUrls) {
      expect(url).toMatch(redditSubredditRegex);
    }
  });

  test("there are no duplicate seed URLs after normalization", () => {
    const normalizedUrls = redditStartUrls.map(url => url.replace(/\/$/, "").toLowerCase());
    const uniqueUrls = new Set(normalizedUrls);
    expect(uniqueUrls.size).toBe(normalizedUrls.length);
  });
});
