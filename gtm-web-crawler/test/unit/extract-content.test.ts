import { test, expect, describe, beforeAll } from "bun:test";
import * as cheerio from "cheerio";
import { extractPostTitle, extractPostBody, extractPostContent } from "../../src/parsers/reddit-post-parser.js";
import { readFile } from "fs/promises";
import { join } from "path";

describe("extract-content", () => {
  let happyPath$: cheerio.CheerioAPI;

  beforeAll(async () => {
    const html = await readFile(join(import.meta.dirname, "../fixtures/reddit/post-detail.html"), "utf-8");
    happyPath$ = cheerio.load(html);
  });

  test("should extract title from happy path fixture", () => {
    expect(extractPostTitle(happyPath$)).toBe("Is anyone actually using crypto for anything besides holding?");
  });

  test("should extract body from happy path fixture", () => {
    const body = extractPostBody(happyPath$);
    expect(body).toContain("I'm really starting to miss the days when crypto wasn't just sitting in a wallet");
    expect(body).toContain("waiting for the next big price surge.");
  });

  test("should combine title and body cleanly", () => {
    const content = extractPostContent(happyPath$);
    expect(content).toContain("Is anyone actually using crypto for anything besides holding?");
    expect(content).toContain("\n\n");
    expect(content).toContain("I'm really starting to miss the days");
  });

  test("should handle title-only posts", () => {
    const $ = cheerio.load(`
      <div class="thing link">
        <p class="title"><a class="title">Just a title</a></p>
      </div>
    `);
    expect(extractPostContent($)).toBe("Just a title");
  });

  test("should return null if both title and body are missing", () => {
    const $ = cheerio.load("<div></div>");
    expect(extractPostContent($)).toBeNull();
  });
});
