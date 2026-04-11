import { test, expect, describe, mock, beforeEach } from "bun:test";
import { createRouter } from "../../src/routes.js";
import { ROUTE_LABELS } from "../../src/constants/ROUTE_LABELS.js";

// Mock the config module
mock.module("../../src/config/appConfig.js", () => {
  return {
    appConfig: {
      CRAWLER_SUBREDDIT_MAX_POST_AGE_DAYS: 1,
      CRAWLER_SUBREDDIT_MAX_PAGES: 4,
      CRAWLER_SUBREDDIT_STOP_ON_DUPLICATE: true,
    },
  };
});

describe("Subreddit Route Age Stopping", () => {
  let mockPostProcessor: any;
  let mockLog: any;
  let mockEnqueueLinks: any;
  let router: any;

  beforeEach(() => {
    mockPostProcessor = {
      isDuplicate: mock(async () => false),
      process: mock(async () => "inserted"),
    };
    mockLog = {
      info: mock(() => {}),
      error: mock(() => {}),
      warning: mock(() => {}),
      debug: mock(() => {}),
    };
    mockEnqueueLinks = mock(async () => {});
    router = createRouter(mockPostProcessor as any);
  });

  test("should stop crawling if top post is too old", async () => {
    const tooOldDate = new Date(Date.now() - 1.1 * 24 * 60 * 60 * 1000).toISOString(); // 1.1 days ago

    const mockPage = {
      title: mock(async () => "Reddit"),
      url: mock(() => "https://old.reddit.com/r/test"),
      innerText: mock(async () => "Welcome to Reddit"),
      $eval: mock(async (selector: string, fn: any) => {
        if (selector === ".thing.link time") {
          return fn({ dateTime: tooOldDate });
        }
        return null;
      }),
      $$eval: mock(async () => []),
      $: mock(async () => null),
    };

    const request = {
      url: "https://old.reddit.com/r/test",
      userData: { label: ROUTE_LABELS.SUBREDDIT },
      label: ROUTE_LABELS.SUBREDDIT,
    };

    await router({ page: mockPage, enqueueLinks: mockEnqueueLinks, request, log: mockLog });

    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining("is too old"));
    expect(mockEnqueueLinks).not.toHaveBeenCalled();
  });

  test("should continue crawling if top post is new enough", async () => {
    const newEnoughDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

    const mockPage = {
      title: mock(async () => "Reddit"),
      url: mock(() => "https://old.reddit.com/r/test"),
      innerText: mock(async () => "Welcome to Reddit"),
      $eval: mock(async (selector: string, fn: any) => {
        if (selector === ".thing.link time") {
          return fn({ dateTime: newEnoughDate });
        }
        return null;
      }),
      $$eval: mock(async () => ["https://old.reddit.com/r/test/comments/1/title"]),
      $: mock(async () => null),
    };

    const request = {
      url: "https://old.reddit.com/r/test",
      userData: { label: ROUTE_LABELS.SUBREDDIT },
      label: ROUTE_LABELS.SUBREDDIT,
    };

    await router({ page: mockPage, enqueueLinks: mockEnqueueLinks, request, log: mockLog });

    expect(mockEnqueueLinks).toHaveBeenCalled();
    expect(mockLog.info).not.toHaveProperty("calls.args", expect.arrayContaining([expect.stringContaining("is too old")]));
  });
});
