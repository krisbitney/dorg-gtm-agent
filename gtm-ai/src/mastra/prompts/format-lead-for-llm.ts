import { LeadInput } from "../schemas/lead-input-schema";

/**
 * Formats a potential lead into a deterministic text block for LLM prompts.
 */
export const formatLeadForLlm = (input: LeadInput): string => {
  return `
### Target Consultancy Context
${input.targetDescription}

---

### Potential Lead Data
Lead ID: ${input.id}
Platform: ${input.platform}
URL: ${input.url}

### Extracted Content
${input.content}
  `.trim();
};
