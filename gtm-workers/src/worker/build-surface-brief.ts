import type { Post } from "../storage/schema/posts-table.js";

/**
 * Pure helper to build a surface brief for dOrg.
 */
export function buildSurfaceBrief(post: Post): string {
  const parts = [];

  parts.push(`Source: ${post.platform} (${post.url})`);
  
  if (post.whyFit) {
    parts.push(`\nWhy it's a fit:\n${post.whyFit}`);
  }
  
  if (post.needs) {
    parts.push(`\nNeeds:\n${post.needs}`);
  }
  
  if (post.timing) {
    parts.push(`\nTiming: ${post.timing}`);
  }
  
  if (post.contactInfo) {
    parts.push(`\nContact: ${post.contactInfo}`);
  }

  return parts.join("\n");
}
