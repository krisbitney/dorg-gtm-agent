import { ROUTE_LABELS } from '../constants/route-labels.js';
import { isPostUrl, isSubredditUrl, extractSubredditName } from './reddit-url.js';
import { createPostUserData, getPostUniqueKey, createSubredditUserData, getSubredditUniqueKey } from './request-metadata.js';

/**
 * Transforms a discovered link into a labeled POST request.
 * @param url The URL of the discovered link.
 * @param subreddit The current subreddit.
 * @returns A request object or false to ignore.
 */
export function transformPostRequest(url: string, subreddit: string) {
    if (!isPostUrl(url)) return false;

    return {
        url,
        label: ROUTE_LABELS.POST,
        userData: createPostUserData(subreddit),
        uniqueKey: getPostUniqueKey(url),
    };
}

/**
 * Transforms a discovered link into a labeled SUBREDDIT request.
 * @param url The URL of the discovered link.
 * @param pageNumber The current page number (default 1).
 * @returns A request object or false to ignore.
 */
export function transformSubredditRequest(url: string, pageNumber: number = 1) {
    if (!isSubredditUrl(url)) return false;

    const subreddit = extractSubredditName(url);
    if (!subreddit) return false;

    return {
        url,
        label: ROUTE_LABELS.SUBREDDIT,
        userData: createSubredditUserData(subreddit, pageNumber),
        uniqueKey: getSubredditUniqueKey(url),
    };
}
