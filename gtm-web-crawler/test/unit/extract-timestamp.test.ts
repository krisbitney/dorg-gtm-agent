import { test, expect, describe, beforeAll } from "bun:test";
import * as cheerio from "cheerio";
import { extractPostTimestamp } from "../../src/parsers/reddit-post-parser.js";
import { readFile } from "fs/promises";
import { join } from "path";

describe("extract-timestamp", () => {
  let happyPath$: cheerio.CheerioAPI;

  beforeAll(async () => {
    const html = await readFile(join(import.meta.dirname, "../fixtures/reddit/post-detail.html"), "utf-8");
    happyPath$ = cheerio.load(html);
  });

  test("should extract timestamp from happy path fixture", () => {
    const ts = extractPostTimestamp(happyPath$);
    expect(ts).toBe(new Date("2026-04-10T12:00:00Z").getTime());
  });

  test("should handle missing timestamp", () => {
    const $ = cheerio.load("<div></div>");
    expect(extractPostTimestamp($)).toBeNull();
  });
});
