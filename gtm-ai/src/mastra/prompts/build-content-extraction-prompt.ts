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
You are an expert Data Extraction Specialist and B2B Lead Researcher. Your objective is to parse raw, scraped web page content (often noisy markdown or json) and extract the raw content that may be relevant to qualifying a B2B lead for the target consultancy.

### Scraped Page Data
URL: ${params.lead.url}

--- START RAW CONTENT (Truncated to ${MAX_CONTENT_LENGTH} characters) ---
${params.lead.content.slice(0, MAX_CONTENT_LENGTH)}
--- END RAW CONTENT ---

### Extraction Directives
Your goal is to extract the core content (e.g., the user post if it is a reddit post).

✅ **WHAT TO EXTRACT & PRESERVE:**
- **Core Narrative:** The main post body, RFP description, project announcement, or press release detailing a recent funding round/capital raise.
- **Metadata:** Author/Poster name, usernames, company name, and exact date/time posted.
- **Contact Info:** Email addresses, direct links, social handles, or application portals.
- **Business & Financial Parameters:** Explicit mentions of budget, timelines, milestones, hiring urgency, specific funding rounds (e.g., Seed, Series A), or amount of capital raised (e.g., "$10 million").
- **Technical Scope:** The required tech stack, architecture, specific blockers, or project scope that needs scaling.
- **Author Follow-ups:** Any replies or comments made *specifically by the original author* that add context to the project.
- **Other useful content:** Any additional details or context that might be relevant to the lead.

❌ **WHAT TO STRIP OUT & IGNORE:**
- Boilerplate UI elements (navigation menus, footers, sidebars, cookie banners, login prompts).
- Irrelevant user comments, forum banter, or off-topic replies.
- Advertisements, promotional links, "related posts" feeds, or generic site disclaimers.
- Irrelevant metadata.

### Output Formatting Rules
- Structure the extracted 'content' string as clean, readable Markdown. 
- Use headers, bold text, and bullet points to make it highly legible for a human sales rep.
- DO NOT hallucinate or infer missing details.

### Output JSON Format
Return ONLY a valid JSON object of the form: { "url": "${params.lead.url}", "content": "<your_cleaned_markdown_string>" }.

Example format:
{
  "url": "https://example.com/news/startup-raises-10m",
  "content": "**Company:** TechFlow\\n**Date:** Oct 24, 2024\\n\\n**Project & Funding Details:**\\nTechFlow just raised $10M in Series A funding to scale their platform and is actively looking to expand their external dev teams.\\n\\n**Tech Stack:** React, Node.js\\n**Capital Raised:** $10M"
}
`.trim();
};