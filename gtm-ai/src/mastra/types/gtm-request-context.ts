/**
 * Type definition for the GTM service request context.
 * Used for traceability across spans and linking runs back to posts.
 */
export interface GtmRequestContext {
  postId: string;
  platform: string;
  topic: string;
  source: 'worker' | 'studio' | 'manual-test';
  workerRunId?: string | null;
}

export type RequestContext = GtmRequestContext;
