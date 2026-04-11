import { test, expect, describe, beforeAll } from "bun:test";
import * as cheerio from "cheerio";
import { extractAuthor } from "../../src/parsers/reddit-post-parser.js";
import { readFile } from "fs/promises";
import { join } from "path";

describe("extractAuthor", () => {
  let happyPath$: cheerio.CheerioAPI;

  beforeAll(async () => {
    const html = await readFile(join(import.meta.dirname, "../fixtures/reddit/post-detail.html"), "utf-8");
    happyPath$ = cheerio.load(html);
  });

  test("should extract author from happy path fixture", () => {
    expect(extractAuthor(happyPath$)).toBe("liftcookrepeat");
  });

  test("should handle missing author", () => {
    const $ = cheerio.load("<div></div>");
    expect(extractAuthor($)).toBeNull();
  });

  test("should extract author from data attribute if available", () => {
    const $ = cheerio.load('<div class="thing link" data-author="data-attr-user"></div>');
    expect(extractAuthor($)).toBe("data-attr-user");
  });
});
