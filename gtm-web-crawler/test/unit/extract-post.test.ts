import { test, expect, describe, beforeAll } from "bun:test";
import { parsePostPage } from "../../src/parsers/reddit-post-parser.js";
import { readFile } from "fs/promises";
import { join } from "path";

describe("extract-post", () => {
  let happyPathHtml: string;

  beforeAll(async () => {
    happyPathHtml = await readFile(join(import.meta.dirname, "../fixtures/reddit/post-detail.html"), "utf-8");
  });

  test("should parse a happy path post detail page", () => {
    const post = parsePostPage(happyPathHtml);
    
    expect(post).not.toBeNull();
    if (post) {
      expect(post.username).toBe("liftcookrepeat");
      expect(post.content).toContain("Is anyone actually using crypto");
      expect(post.postedAt).toBe(new Date("2026-04-10T12:00:00Z").getTime());
      expect(post.nLikes).toBe(123);
      expect(post.nComments).toBe(45);
      expect(post.topic).toBe("CryptoCurrency");
    }
  });

  test("should use fallback topic if extraction fails", () => {
    const minimalHtml = `
      <div class="thing link" data-author="user1">
        <p class="title"><a class="title">Title</a></p>
        <time datetime="2026-04-11T00:00:00Z"></time>
      </div>
    `;
    const post = parsePostPage(minimalHtml, "FallbackTopic");
    expect(post?.topic).toBe("FallbackTopic");
  });

  test("should return null if essential fields are missing", () => {
    const brokenHtml = "<div>Broken</div>";
    const post = parsePostPage(brokenHtml);
    expect(post).toBeNull();
  });
});
