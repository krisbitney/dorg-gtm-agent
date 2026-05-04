import { LeadInput } from "../schemas/lead-input-schema";

/**
 * Formats a potential lead into a deterministic text block for LLM prompts.
 */
export const formatLeadForLlm = (input: LeadInput): string => {

  return `
### Target Consultancy
${input.targetDescription}
  
### Potential Lead
  
Lead ID: ${input.id}
Platform: ${input.platform}
URL: ${input.url}

Content: ${JSON.stringify(input.content)};
`.trim();
};
