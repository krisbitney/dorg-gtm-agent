/**
 * Formats a Twitter post into a text block for LLM prompts.
 */
export const formatTwitterPost = (id: string, url: string, postJson: unknown): string => {

return `
Post ID: ${id}
Platform: X (formerly Twitter)
Post URL: ${url}

Post: ${JSON.stringify(postJson)};
`.trim();
};
