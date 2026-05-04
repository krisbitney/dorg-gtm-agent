import type { Lead } from "../storage/schema/leads-table.js";

/**
 * Pure helper to build a surface brief for dOrg.
 */
export function buildSurfaceBrief(lead: Lead): string {
  const parts = [];

  parts.push(`Source: ${lead.platform} (${lead.url})`);
  
  if (lead.whyFit) {
    parts.push(`\nWhy it's a fit:\n${lead.whyFit}`);
  }
  
  if (lead.needs) {
    parts.push(`\nNeeds:\n${lead.needs}`);
  }
  
  if (lead.timing) {
    parts.push(`\nTiming: ${lead.timing}`);
  }
  
  if (lead.contactInfo) {
    parts.push(`\nContact: ${lead.contactInfo}`);
  }

  return parts.join("\n");
}
