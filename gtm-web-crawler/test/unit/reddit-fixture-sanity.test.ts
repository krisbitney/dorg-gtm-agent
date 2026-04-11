import { test, expect, describe } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dir, "../fixtures/reddit");

describe("Reddit Fixture Sanity", () => {
  const fixtures = [
    "subreddit-listing.html",
    "subreddit-listing-pagination.html",
    "post-detail.html",
    "post-detail-edge-case.html",
  ];

  for (const fixture of fixtures) {
    test(`fixture ${fixture} should load and not be empty`, async () => {
      const content = await readFile(join(FIXTURE_DIR, fixture), "utf-8");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('class="thing');
    });
  }

  test("subreddit-listing.html should contain multiple posts", async () => {
    const content = await readFile(join(FIXTURE_DIR, "subreddit-listing.html"), "utf-8");
    const postCount = (content.match(/class="thing/g) || []).length;
    expect(postCount).toBeGreaterThanOrEqual(2);
  });

  test("subreddit-listing-pagination.html should contain next link", async () => {
    const content = await readFile(join(FIXTURE_DIR, "subreddit-listing-pagination.html"), "utf-8");
    expect(content).toContain('rel="nofollow next"');
  });

  test("post-detail-edge-case.html should contain deleted marker", async () => {
    const content = await readFile(join(FIXTURE_DIR, "post-detail-edge-case.html"), "utf-8");
    expect(content).toContain("[deleted]");
  });
});
