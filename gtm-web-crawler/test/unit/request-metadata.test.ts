import { test, expect, describe } from "bun:test";
import { ROUTE_LABELS } from "../../src/constants/route-labels.js";
import {
  createSubredditUserData,
  createPostUserData,
  getPostUniqueKey,
  getSubredditUniqueKey,
} from "../../src/lib/request-metadata.js";

describe("Request Metadata Helpers", () => {
  test("createSubredditUserData should return correct object", () => {
    const topic = "CryptoCurrency";
    const result = createSubredditUserData(topic);
    expect(result).toEqual({
      label: ROUTE_LABELS.SUBREDDIT,
      topic: "CryptoCurrency",
      pageNumber: 1,
    });
  });

  test("createPostUserData should return correct object", () => {
    const topic = "Bitcoin";
    const result = createPostUserData(topic);
    expect(result).toEqual({
      label: ROUTE_LABELS.POST,
      topic: "Bitcoin",
    });
  });

  test("getPostUniqueKey should return canonical post URL", () => {
    const url = "https://www.reddit.com/r/CryptoCurrency/comments/123/title/?utm_source=share";
    const expected = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
    expect(getPostUniqueKey(url)).toBe(expected);
  });

  test("getSubredditUniqueKey should return canonical listing URL", () => {
    const url = "https://www.reddit.com/r/CryptoCurrency/?after=t3_xyz&count=25&ignore=me";
    const result = getSubredditUniqueKey(url);
    expect(result).toContain("after=t3_xyz");
    expect(result).toContain("count=25");
    expect(result).not.toContain("ignore=me");
  });
});
