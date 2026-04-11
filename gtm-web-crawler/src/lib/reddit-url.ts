/**
 * Utility functions for handling Reddit URLs.
 */

const REDDIT_HOSTNAMES = ["www.reddit.com", "old.reddit.com", "www.old.reddit.com", "sh.reddit.com"];
const CANONICAL_HOSTNAME = "old.reddit.com";

/**
 * Checks if a URL is a subreddit listing page.
 * @param url The URL to check.
 */
export function isSubredditUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!REDDIT_HOSTNAMES.includes(parsed.hostname)) return false;
    
    // Patterns: /r/<subreddit_name>/ or /r/<subreddit_name>/new/ etc.
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0] !== "r") return false;
    
    // Subreddit listing pages are usually /r/<name>/ or /r/<name>/<suffix>/
    // But they are NOT /r/<name>/comments/...
    return parts[2] !== "comments";
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is a Reddit post detail page.
 * @param url The URL to check.
 */
export function isPostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!REDDIT_HOSTNAMES.includes(parsed.hostname)) return false;
    
    // Pattern: /r/<subreddit_name>/comments/<id>/<slug>/
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.length >= 4 && parts[0] === "r" && parts[2] === "comments";
  } catch {
    return false;
  }
}

/**
 * Extracts the subreddit name from a Reddit URL.
 * @param url The URL to extract from.
 */
export function extractSubredditName(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "r" && parts[1]) {
      return parts[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Canonicalizes a Reddit post URL for deduplication and persistence.
 * Removes tracking parameters and fragments.
 * @param url The URL to canonicalize.
 */
export function canonicalizePostUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Ensure we are on the canonical domain for consistency
    parsed.hostname = CANONICAL_HOSTNAME;
    // Clear all query params for post URLs as they are usually tracking or UI state
    parsed.search = "";
    // Clear fragment
    parsed.hash = "";
    
    // Remove trailing slash if present for consistency
    let pathname = parsed.pathname;
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Canonicalizes a subreddit listing URL while preserving pagination tokens.
 * @param url The URL to canonicalize.
 */
export function canonicalizeListingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = CANONICAL_HOSTNAME;
    parsed.hash = "";
    
    const preservedParams = ["after", "before", "count"];
    const searchParams = new URLSearchParams();
    
    for (const param of preservedParams) {
      const value = parsed.searchParams.get(param);
      if (value) {
        searchParams.set(param, value);
      }
    }
    
    parsed.search = searchParams.toString();
    
    // Remove trailing slash if present for consistency
    let pathname = parsed.pathname;
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    
    return parsed.toString();
  } catch {
    return url;
  }
}
