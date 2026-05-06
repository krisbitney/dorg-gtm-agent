import type { ScrapedLead } from "../schemas/search-and-filter-schema";

const MAX_CONTENT_LENGTH = 400_000;

/**
 * Builds the prompt for extracting relevant lead content from a single scraped page.
 * Strips filler, ads, navigation, and unrelated sections — keeping only
 * the content that matters for evaluating whether the page is a lead.
 */
export const buildContentExtractionPrompt = (params: {
  targetDescription: string;
  lead: ScrapedLead;
}): string => {
  return `
You are an expert Data Extraction Specialist and B2B Lead Researcher. Your objective is to parse raw, scraped web page content (often noisy markdown) and extract ONLY the high-signal information relevant to qualifying a B2B lead for the target consultancy.

### Target Consultancy Context
${params.targetDescription}

### Scraped Page Data
URL: ${params.lead.url}

--- START RAW CONTENT (Truncated to ${MAX_CONTENT_LENGTH} characters) ---
${params.lead.content.slice(0, MAX_CONTENT_LENGTH)}
--- END RAW CONTENT ---

### Extraction Directives
Your goal is to distill the raw text into a clean, concise summary of the actual lead opportunity.

✅ **WHAT TO EXTRACT & PRESERVE:**
- **Core Narrative:** The main post body, RFP description, or project announcement.
- **Metadata:** Author/Poster name, usernames, company name, and exact date/time posted.
- **Contact Info:** Email addresses, direct links, social handles, or application portals.
- **Business Parameters:** Explicit mentions of budget, timelines, milestones, or hiring urgency.
- **Technical Scope:** The required tech stack, architecture, specific blockers, or project scope.
- **Author Follow-ups:** Any replies or comments made *specifically by the original author* that add context to the project.

❌ **WHAT TO STRIP OUT & IGNORE:**
- Boilerplate UI elements (navigation menus, footers, sidebars, cookie banners, login prompts).
- Irrelevant user comments, forum banter, or off-topic replies.
- Advertisements, promotional links, "related posts" feeds, or generic site disclaimers.

### Output Formatting Rules
- Structure the extracted 'content' string as clean, readable Markdown. 
- Use headers, bold text, and bullet points to make it highly legible for a human sales rep.
- DO NOT hallucinate or infer missing details. If a budget or tech stack isn't mentioned, omit it.

### Output JSON Format
Return ONLY a valid JSON object containing a "leads" array. 
- If the page contains valid lead content, the array should contain exactly one object: { "url": "${params.lead.url}", "content": "<your_cleaned_markdown_string>" }.
- If the full page reveals this is a false positive (e.g., it is actually a W-2 job posting, SEO spam, or contains no actionable project info), return an empty array: { "leads": [] }.

Example format for a valid lead:
{
  "leads": [
    {
      "url": "https://example.com/forum/post",
      "content": "**Author:** username123\\n**Date:** Oct 24, 2024\\n\\n**Project Details:**\\nLooking for an agency to build our MVP...\\n\\n**Tech Stack:** React, Node.js\\n**Budget:** $50k"
    }
  ]
}
`.trim();
};