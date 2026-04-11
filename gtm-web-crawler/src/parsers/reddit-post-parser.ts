import * as cheerio from "cheerio";
import type { ExtractedRedditPost } from "../domain/reddit.js";
import { normalizeWhitespace, parseCompactNumber } from "../lib/parse-utils.js";

/**
 * Extracts the author's username from a Reddit post.
 * @param $ Cheerio API instance.
 */
export function extractAuthor($: cheerio.CheerioAPI): string | null {
  const author = $(".thing.link").first().attr("data-author");
  if (author) return author;
  
  const authorLink = $(".thing.link .tagline a.author").first();
  return authorLink.text().trim() || null;
}

/**
 * Extracts the post title.
 * @param $ Cheerio API instance.
 */
export function extractPostTitle($: cheerio.CheerioAPI): string | null {
  const title = $(".thing.link p.title a.title").first().text();
  return title ? normalizeWhitespace(title) : null;
}

/**
 * Extracts the post body (self-text).
 * @param $ Cheerio API instance.
 */
export function extractPostBody($: cheerio.CheerioAPI): string | null {
  const body = $(".thing.link .usertext-body .md").first().text();
  return body ? normalizeWhitespace(body) : null;
}

/**
 * Extracts the combined post content (title + body).
 * @param $ Cheerio API instance.
 */
export function extractPostContent($: cheerio.CheerioAPI): string | null {
  const title = extractPostTitle($) || "";
  const body = extractPostBody($) || "";
  
  if (!title && !body) return null;
  return `${title}\n\n${body}`.trim();
}

/**
 * Extracts the post timestamp (Unix epoch in milliseconds).
 * @param $ Cheerio API instance.
 */
export function extractPostTimestamp($: cheerio.CheerioAPI): number | null {
  const timeAttr = $(".thing.link time").first().attr("datetime");
  if (timeAttr) {
    return new Date(timeAttr).getTime();
  }
  return null;
}

/**
 * Extracts the score (likes).
 * @param $ Cheerio API instance.
 */
export function extractScore($: cheerio.CheerioAPI): number | null {
  const scoreText = $(".thing.link .midcol .score.unvoted").first().text();
  return parseCompactNumber(scoreText);
}

/**
 * Extracts the comment count.
 * @param $ Cheerio API instance.
 */
export function extractCommentCount($: cheerio.CheerioAPI): number | null {
  const commentsText = $(".thing.link a.comments").first().text();
  // Expects text like "15 comments" or "comment" or "1.2k comments"
  if (!commentsText) return 0;
  
  const match = commentsText.match(/^([\d.,km]+)\s*comment/i);
  if (match) {
    return parseCompactNumber(match[1]);
  }
  return 0;
}

/**
 * Extracts the topic (subreddit name) from the page.
 * @param $ Cheerio API instance.
 */
export function extractTopicFromPage($: cheerio.CheerioAPI): string | null {
  const subredditLink = $(".thing.link .tagline a.subreddit").first().text();
  if (subredditLink) {
    // Expected format: r/CryptoCurrency
    const match = subredditLink.match(/^r\/(.+)$/);
    return match ? match[1] : subredditLink;
  }
  return null;
}

/**
 * Parses a complete Reddit post detail page.
 * @param html The HTML content of the page.
 * @param fallbackTopic Optional topic to use if extraction fails.
 */
export function parsePostPage(html: string, fallbackTopic?: string): ExtractedRedditPost | null {
  const $ = cheerio.load(html);
  
  const username = extractAuthor($);
  const content = extractPostContent($);
  const postedAt = extractPostTimestamp($);
  const nLikes = extractScore($) ?? 0;
  const nComments = extractCommentCount($) ?? 0;
  const topic = extractTopicFromPage($) || fallbackTopic;
  
  if (!username || !content || !postedAt || !topic) {
    return null;
  }
  
  return {
    username,
    content,
    postedAt,
    nLikes,
    nComments,
    topic,
  };
}
