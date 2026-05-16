/**
 * Type definition for the GTM service request context.
 * Used for traceability across spans and linking runs back to leads.
 */
export interface GtmRequestContext {
  leadId: string;
  platform: string;
  source: 'worker' | 'studio' | 'manual-test';
  workerRunId?: string | null;
}

export type RequestContext = GtmRequestContext;
