import { ROUTE_LABELS } from '../constants/route-labels.js';
import { isPostUrl, isSubredditUrl, extractSubredditName } from './reddit-url.js';
import { createPostUserData, getPostUniqueKey, createSubredditUserData, getSubredditUniqueKey } from './request-metadata.js';

/**
 * Transforms a discovered link into a labeled POST request.
 * @param url The URL of the discovered link.
 * @param topic The current subreddit topic.
 * @returns A request object or false to ignore.
 */
export function transformPostRequest(url: string, topic: string) {
    if (!isPostUrl(url)) return false;

    return {
        url,
        label: ROUTE_LABELS.POST,
        userData: createPostUserData(topic),
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

    const topic = extractSubredditName(url);
    if (!topic) return false;

    return {
        url,
        label: ROUTE_LABELS.SUBREDDIT,
        userData: createSubredditUserData(topic, pageNumber),
        uniqueKey: getSubredditUniqueKey(url),
    };
}
