import { test, expect, describe, beforeAll } from "bun:test";
import * as cheerio from "cheerio";
import { extractScore, extractCommentCount } from "../../src/parsers/reddit-post-parser.js";
import { readFile } from "fs/promises";
import { join } from "path";

describe("extract-metrics", () => {
  let happyPath$: cheerio.CheerioAPI;

  beforeAll(async () => {
    const html = await readFile(join(import.meta.dirname, "../fixtures/reddit/post-detail.html"), "utf-8");
    happyPath$ = cheerio.load(html);
  });

  test("should extract score from happy path fixture", () => {
    expect(extractScore(happyPath$)).toBe(123);
  });

  test("should extract comment count from happy path fixture", () => {
    expect(extractCommentCount(happyPath$)).toBe(45);
  });

  test("should handle missing score", () => {
    const $ = cheerio.load("<div></div>");
    expect(extractScore($)).toBeNull();
  });

  test("should handle missing comment count", () => {
    const $ = cheerio.load("<div></div>");
    expect(extractCommentCount($)).toBe(0);
  });

  test("should parse abbreviated metrics", () => {
    const $ = cheerio.load(`
      <div class="thing link">
        <div class="midcol"><div class="score unvoted">1.2k</div></div>
        <ul class="flat-list"><li><a class="comments">2.5k comments</a></li></ul>
      </div>
    `);
    expect(extractScore($)).toBe(1200);
    expect(extractCommentCount($)).toBe(2500);
  });
});
